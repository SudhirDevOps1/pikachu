import { useCallback, useEffect, useRef } from "react";
import { useStore } from "@/store/assistantStore";

// ============================================================================
// useVoice — captures the microphone for waveform visualization and uses the
// browser SpeechRecognition API (when available) for quick client-side STT.
// The backend Vosk pipeline is preferred when connected; this is the fallback.
// ============================================================================

export function useVoice(onFinal: (text: string) => void, sendRaw?: (msg: any) => void) {
  const setListening = useStore((s) => s.setListening);
  const setWaveform = useStore((s) => s.setWaveform);
  const setPartial = useStore((s) => s.setPartial);
  const isListening = useStore((s) => s.isListening);

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);

  const stopWaveform = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setWaveform(new Array(20).fill(0.1));
  }, [setWaveform]);

  const runWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      analyser.getByteFrequencyData(buf);
      const bars: number[] = [];
      const step = Math.floor(buf.length / 20);
      for (let i = 0; i < 20; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += buf[i * step + j];
        bars.push(Math.min(1, sum / step / 180));
      }
      setWaveform(bars);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, [setWaveform]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC({ sampleRate: 16000 });
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const sttEngine = useStore.getState().settings.sttEngine || "webspeech";

      if (sttEngine !== "webspeech") {
        if (useStore.getState().isConnected && sendRaw) {
          sendRaw(JSON.stringify({ type: "voice_start", engine: sttEngine }));
        }
        // Add ScriptProcessor for sending binary PCM16 audio to backend (Vosk/Whisper STT)
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          if (!useStore.getState().isListening) return;
          if (useStore.getState().isConnected && sendRaw) {
            const channel = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(channel.length);
            for (let i = 0; i < channel.length; i++) {
              let s = Math.max(-1, Math.min(1, channel[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            sendRaw(pcm16.buffer);
          }
        };
        analyser.connect(processor);
        
        // Prevent feedback loop while keeping the node active
        const gain = ctx.createGain();
        gain.gain.value = 0;
        processor.connect(gain);
        gain.connect(ctx.destination);
      }

      setListening(true);
      runWaveform();

      if (sttEngine === "webspeech") {
        // Browser speech recognition (Chrome / Edge)
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SR) {
          const rec = new SR();
          rec.lang = useStore.getState().settings.voiceSettings.language || "hi-IN";
          rec.interimResults = true;
          rec.continuous = true; // Keep listening continuously
          rec.onresult = (e: any) => {
            let interim = "";
            let final = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const t = e.results[i][0].transcript;
              if (e.results[i].isFinal) final += t;
              else interim += t;
            }
            const current = (interim || final).trim();
            if (current) {
              setPartial(current);
            }
            if (final) {
              const cleaned = final.trim();
              if (/(?:hey|hello|namaste|suno|oye)?\s*pika\b/i.test(cleaned)) {
                try { sounds.chime(); } catch {}
              }
              onFinal(cleaned);
              setPartial("");
            }
          };
          rec.onerror = (e: any) => {
            console.warn("Speech recognition notice:", e.error);
          };
          rec.onend = () => {
            // Safe auto-restart for continuous listening
            if (useStore.getState().isListening) {
              window.setTimeout(() => {
                if (useStore.getState().isListening && recognitionRef.current) {
                  try { recognitionRef.current.start(); } catch {}
                }
              }, 200);
            }
          };
          recognitionRef.current = rec;
          try {
            rec.start();
          } catch (err) {
            console.warn("Failed to start speech recognition:", err);
          }
        } else {
          // If browser has no Web Speech API, fallback to backend Vosk
          if (useStore.getState().isConnected && sendRaw) {
            sendRaw(JSON.stringify({ type: "voice_start", engine: "vosk" }));
          }
        }
      }
    } catch {
      useStore.getState().addToast({ type: "error", message: "माइक्रोफोन एक्सेस नहीं मिला" });
      setListening(false);
    }
  }, [runWaveform, setListening, setPartial, onFinal, sendRaw]);

  const stopListening = useCallback(() => {
    setListening(false);
    setPartial("");
    stopWaveform();
    if (useStore.getState().isConnected && sendRaw) {
      sendRaw(JSON.stringify({ type: "voice_stop" }));
    }
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
  }, [setListening, setPartial, stopWaveform, sendRaw]);

  const toggle = useCallback(() => {
    if (useStore.getState().isListening) stopListening();
    else startListening();
  }, [startListening, stopListening]);

  useEffect(() => () => stopWaveform(), [stopWaveform]);

  return { isListening, startListening, stopListening, toggle };
}
