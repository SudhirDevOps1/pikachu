// ============================================================================
// Pika AI Assistant — Real API health checker for each LLM provider.
// Makes lightweight test calls to verify connectivity & measure latency.
// ============================================================================

import { useStore } from "@/store/assistantStore";
import type { ProviderHealth } from "@/types";

const PROVIDER_ENDPOINTS: Record<string, { url: string | ((k: string) => string); method: "GET" | "POST"; authType?: "bearer" | "query" | "none" }> = {
  groq: {
    url: "https://api.groq.com/openai/v1/models",
    method: "GET",
    authType: "bearer",
  },
  gemini: {
    url: (k: string) => `https://generativelanguage.googleapis.com/v1beta/models?key=${k.split(",")[0].trim()}`,
    method: "GET",
    authType: "query",
  },
  nvidia: {
    url: "https://integrate.api.nvidia.com/v1/models",
    method: "GET",
    authType: "bearer",
  },
  together: {
    url: "https://api.together.xyz/v1/models",
    method: "GET",
    authType: "bearer",
  },
  cohere: {
    url: "https://api.cohere.ai/v1/models",
    method: "GET",
    authType: "bearer",
  },
  mistral: {
    url: "https://api.mistral.ai/v1/models",
    method: "GET",
    authType: "bearer",
  },
  cerebras: {
    url: "https://api.cerebras.ai/v1/models",
    method: "GET",
    authType: "bearer",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/models",
    method: "GET",
    authType: "bearer",
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/models",
    method: "GET",
    authType: "bearer",
  },
  ollama: {
    url: "http://localhost:11434/v1/models",
    method: "GET",
    authType: "none",
  },
  zai: {
    url: "https://open.bigmodel.cn/api/paas/v4/models",
    method: "GET",
    authType: "bearer",
  },
  omniroute: {
    url: "http://localhost:20128/v1/models",
    method: "GET",
    authType: "bearer",
  },
};

export async function testCustomProvider(baseUrl: string, apiKey: string): Promise<ProviderHealth> {
  const start = performance.now();
  try {
    const cleanBase = baseUrl.trim().replace(/\/chat\/completions\/?$/, "").replace(/\/+$/, "");
    if (!cleanBase) {
      return { status: "error", error: "Base URL is required" };
    }
    const singleKey = apiKey.split(",")[0].trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (singleKey) {
      headers["Authorization"] = `Bearer ${singleKey}`;
    }

    // Try /v1/models or /models
    const modelsUrl = cleanBase.endsWith("/v1") ? `${cleanBase}/models` : `${cleanBase}/v1/models`;
    let res: Response;
    try {
      res = await fetch(modelsUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(6000),
      });
    } catch {
      // Fallback to direct /models
      res = await fetch(`${cleanBase}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(6000),
      });
    }

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      let modelsList: string[] = [];

      if (Array.isArray(data)) {
        modelsList = data.map((m: any) => m.id || m.name).filter(Boolean);
      } else if (Array.isArray(data.data)) {
        modelsList = data.data.map((m: any) => m.id || m.name).filter(Boolean);
      } else if (Array.isArray(data.models)) {
        modelsList = data.models.map((m: any) => (m.name || m.id || "").replace(/^models\//, "")).filter(Boolean);
      }

      modelsList = Array.from(new Set(modelsList)).filter((m) => typeof m === "string" && m.length > 0);

      return {
        status: "ok",
        latencyMs,
        models: modelsList.length > 0 ? modelsList : undefined,
        checkedAt: new Date().toISOString(),
      };
    }

    if (res.status === 401) {
      return { status: "error", latencyMs, error: "Invalid API Key (401)", checkedAt: new Date().toISOString() };
    }
    return { status: "error", latencyMs, error: `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - start);
    return { status: "error", latencyMs, error: e instanceof Error ? e.message : "Network error / CORS blocked", checkedAt: new Date().toISOString() };
  }
}

async function _testProvider(provider: string, apiKey: string): Promise<ProviderHealth> {
  const cfg = PROVIDER_ENDPOINTS[provider];
  if (!cfg) return { status: "error", error: "Unknown provider" };
  const singleKey = apiKey.split(",")[0].trim();
  if (!singleKey && cfg.authType !== "none") {
    return { status: "error", error: "No API key configured" };
  }

  const start = performance.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cfg.authType === "bearer" && singleKey) {
      headers["Authorization"] = `Bearer ${singleKey}`;
    }

    const endpointUrl = typeof cfg.url === "function" ? cfg.url(singleKey) : cfg.url;
    let res: Response;
    try {
      res = await fetch(endpointUrl, {
        method: cfg.method,
        headers,
        signal: AbortSignal.timeout(9000),
      });
    } catch (err) {
      // If OmniRoute fails on 20128, fallback to 8000
      if (provider === "omniroute") {
        res = await fetch("http://localhost:8000/v1/models", {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(5000),
        });
      } else {
        throw err;
      }
    }

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      let modelsList: string[] = [];

      if (Array.isArray(data)) {
        modelsList = data.map((m: any) => m.id || m.name).filter(Boolean);
      } else if (Array.isArray(data.data)) {
        modelsList = data.data.map((m: any) => m.id || m.name).filter(Boolean);
      } else if (Array.isArray(data.models)) {
        modelsList = data.models.map((m: any) => (m.name || m.id || "").replace(/^models\//, "")).filter(Boolean);
      }

      // Filter and sort unique models
      modelsList = Array.from(new Set(modelsList)).filter((m) => typeof m === "string" && m.length > 0);

      return {
        status: "ok",
        latencyMs,
        models: modelsList.length > 0 ? modelsList : undefined,
        checkedAt: new Date().toISOString(),
      };
    }

    if (res.status === 401) {
      return { status: "error", latencyMs, error: "Invalid API Key (401 Unauthorized)", checkedAt: new Date().toISOString() };
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
