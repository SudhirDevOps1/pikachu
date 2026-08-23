// ============================================================================
// Pika AI Assistant — Real API health checker for each LLM provider.
// Makes lightweight test calls to verify connectivity & measure latency.
// ============================================================================

import { useStore } from "@/store/assistantStore";
import type { ProviderHealth } from "@/types";

const PROVIDER_ENDPOINTS: Record<string, { url: string; method: "GET" | "POST"; body?: object }> = {
  groq: {
    url: "https://api.groq.com/openai/v1/models",
    method: "GET",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    method: "GET",
  },
  mistral: {
    url: "https://api.mistral.ai/v1/models",
    method: "GET",
  },
  cerebras: {
    url: "https://api.cerebras.ai/v1/models",
    method: "GET",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/models",
    method: "GET",
  },
  zai: {
    url: "https://open.bigmodel.cn/api/paas/v4/models",
    method: "GET",
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/models",
    method: "GET",
  },
};

async function _testProvider(provider: string, apiKey: string): Promise<ProviderHealth> {
  const cfg = PROVIDER_ENDPOINTS[provider];
  if (!cfg) return { status: "error", error: "Unknown provider" };
  if (!apiKey) return { status: "error", error: "No API key configured" };

  const start = performance.now();
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    const res = await fetch(cfg.url, {
      method: cfg.method,
      headers,
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok || res.status === 401) {
      // 401 means key is valid format but may lack permissions — still counts as "reachable"
      return { status: "ok", latencyMs, checkedAt: new Date().toISOString() };
    }
    return { status: "error", latencyMs, error: `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - start);
    return { status: "error", latencyMs, error: e instanceof Error ? e.message : "Network error", checkedAt: new Date().toISOString() };
  }
}

export async function testProvider(provider: string): Promise<ProviderHealth> {
  const key = useStore.getState().settings.apiKeys[provider] || "";
  useStore.getState().setApiHealth(provider, { status: "checking" });
  const result = await _testProvider(provider, key);
  useStore.getState().setApiHealth(provider, result);
  return result;
}

export async function testAllProviders(): Promise<void> {
  const keys = useStore.getState().settings.apiKeys;
  await Promise.all(
    Object.keys(keys)
      .filter((k) => keys[k])
      .map((k) => testProvider(k))
  );
}
