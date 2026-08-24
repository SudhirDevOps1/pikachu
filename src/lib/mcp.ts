// Additive MCP helper — exposes ROUTES as MCP tools without deleting anything
export type McpTool = { name: string; description: string; inputSchema: any };

let cached: McpTool[] | null = null;

export async function fetchMcpTools(sendRaw: (msg: any) => void): Promise<McpTool[]> {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "mcp_tools" && Array.isArray(d.data)) {
          cached = d.data;
          window.removeEventListener("message", handler as any);
          resolve(d.data);
        }
      } catch {}
    };
    // Fallback: ask via WS
    sendRaw(JSON.stringify({ type: "mcp_list_tools" }));
    setTimeout(() => resolve(cached || []), 2500);
  });
}

export function callMcpTool(sendRaw: (msg: any) => void, name: string, params: Record<string, any> = {}) {
  sendRaw(JSON.stringify({ type: "mcp_call_tool", name, params }));
}
