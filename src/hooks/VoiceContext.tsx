import { createContext, useContext } from "react";

// Shared voice-control API so only ONE SpeechRecognition instance exists
// app-wide (used by the HUD orb, transcript input and the PiP window alike).
export interface VoiceApi {
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggle: () => void;
}

export const VoiceContext = createContext<VoiceApi | null>(null);

export function useVoiceApi(): VoiceApi {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceApi must be used within VoiceContext");
  return ctx;
}
