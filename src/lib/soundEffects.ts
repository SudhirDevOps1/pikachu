// ============================================================================
// Pika AI Assistant — Simple Web Audio generated UI sounds (no files needed)
// ============================================================================

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.08) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export const sounds = {
  enabled: true,
  click() {
    if (!this.enabled) return;
    tone(520, 0.06, "triangle", 0.05);
  },
  success() {
    if (!this.enabled) return;
    tone(660, 0.1, "sine", 0.07);
    setTimeout(() => tone(880, 0.12, "sine", 0.07), 90);
  },
  error() {
    if (!this.enabled) return;
    tone(220, 0.18, "sawtooth", 0.06);
  },
  notification() {
    if (!this.enabled) return;
    tone(784, 0.1, "sine", 0.07);
    setTimeout(() => tone(1047, 0.14, "sine", 0.07), 100);
  },
  connect() {
    if (!this.enabled) return;
    tone(440, 0.08, "sine", 0.06);
    setTimeout(() => tone(660, 0.1, "sine", 0.06), 80);
  },
};
