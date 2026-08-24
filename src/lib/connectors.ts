// Additive connectors skeleton — Gmail / Calendar / Slack / Notion / GitHub
// Stores OAuth tokens in pika_data.json vault via WS save_data (no deletion of existing)
export type ConnectorId = 'gmail'|'calendar'|'slack'|'notion'|'github'|'drive';
export interface Connector { id: ConnectorId; name: string; connected: boolean; scopes: string[]; }

const CATALOG: Record<ConnectorId, {name:string; scopes:string[]}> = {
  gmail: { name: 'Gmail', scopes: ['gmail.readonly','gmail.send'] },
  calendar: { name: 'Google Calendar', scopes: ['calendar.readonly','calendar.events'] },
  slack: { name: 'Slack', scopes: ['channels:read','chat:write'] },
  notion: { name: 'Notion', scopes: ['notion.read','notion.write'] },
  github: { name: 'GitHub', scopes: ['repo','user'] },
  drive: { name: 'Google Drive', scopes: ['drive.readonly'] },
};

export function listConnectors(connected: Record<string,boolean>={}): Connector[] {
  return (Object.keys(CATALOG) as ConnectorId[]).map(id=>({ id, name: CATALOG[id].name, scopes: CATALOG[id].scopes, connected: !!connected[id] }));
}

// Backend will implement cmd_connectors via OAuth code exchange — frontend just triggers WS
export function connectConnector(sendRaw:(m:any)=>void, id: ConnectorId) {
  sendRaw(JSON.stringify({ type: 'command', category: 'connectors', action: 'connect', params: { id } }));
}
export function disconnectConnector(sendRaw:(m:any)=>void, id: ConnectorId) {
  sendRaw(JSON.stringify({ type: 'command', category: 'connectors', action: 'disconnect', params: { id } }));
}
