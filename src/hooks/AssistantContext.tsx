import { createContext, useContext } from "react";
import type { WSMessage } from "@/types";

export interface AssistantApi {
  processInput: (text: string) => void;
  resolveConfirmation: (approve: boolean) => void;
  connect: () => void;
  disconnect: () => void;
  sendRaw: (msg: WSMessage) => void;
}

export const AssistantContext = createContext<AssistantApi | null>(null);

export function useAssistantApi(): AssistantApi {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistantApi must be used within AssistantContext");
  return ctx;
}
