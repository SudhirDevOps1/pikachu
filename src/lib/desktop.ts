// ============================================================================
//  PIKA AI — Desktop (Electron) Bridge for the Renderer
// ----------------------------------------------------------------------------
//  Yeh file `window.pika` (preload se aaya) ko type-safe wrapper deti hai.
//  Agar app browser mein chal raha hai (Electron nahi), toh saare functions
//  safely no-op ho jaate hain — isse SAME codebase browser + desktop dono
//  jagah bina crash ke chalta hai. Yeh "graceful degradation" pattern hai.
// ============================================================================

export interface AppInfo {
  version: string;
  electron: string;
  node: string;
  chrome: string;
  platform: string;
  arch: string;
  hostname: string;
  isDesktop: boolean;
}

export interface PikaDesktopApi {
  isDesktop: boolean;
  minimize: () => Promise<void>;
  maximize: () => Promise<boolean>;
  close: () => Promise<void>;
  toggleMiniMode: () => Promise<boolean>;
  bridgeStatus: () => Promise<{ running: boolean }>;
  restartBridge: () => Promise<boolean>;
  appInfo: () => Promise<AppInfo>;
  openExternal: (url: string) => Promise<void>;
  openPath: (p: string) => Promise<string>;
  pickFile: () => Promise<string | null>;
  pickFolder: () => Promise<string | null>;
  onBridgeLog: (cb: (line: string) => void) => () => void;
  onBridgeStatus: (cb: (d: { running: boolean; code?: number }) => void) => () => void;
  onVoiceHotkey: (cb: () => void) => () => void;
  onMiniMode: (cb: (isMini: boolean) => void) => () => void;
  onWindowState: (cb: (s: { maximized: boolean }) => void) => () => void;
}

declare global {
  interface Window {
    pika?: PikaDesktopApi;
  }
}

/** Kya hum Electron desktop app ke andar chal rahe hain? */
export const isDesktopApp = (): boolean =>
  typeof window !== "undefined" && Boolean(window.pika?.isDesktop);

/** Safe no-op fallback — browser mein bhi code crash na ho. */
const noopUnsub = () => () => {};

export const desktop: PikaDesktopApi = {
  isDesktop: isDesktopApp(),
  minimize: async () => window.pika?.minimize(),
  maximize: async () => (await window.pika?.maximize()) ?? false,
  close: async () => window.pika?.close(),
  toggleMiniMode: async () => (await window.pika?.toggleMiniMode()) ?? false,
  bridgeStatus: async () => (await window.pika?.bridgeStatus()) ?? { running: false },
  restartBridge: async () => (await window.pika?.restartBridge()) ?? false,
  appInfo: async () =>
    (await window.pika?.appInfo()) ?? {
      version: "web", electron: "-", node: "-", chrome: navigator.userAgent,
      platform: "browser", arch: "-", hostname: "browser", isDesktop: false,
    },
  openExternal: async (url) => {
    if (window.pika) return window.pika.openExternal(url);
    window.open(url, "_blank", "noopener");
  },
  openPath: async (p) => (await window.pika?.openPath(p)) ?? "",
  pickFile: async () => (await window.pika?.pickFile()) ?? null,
  pickFolder: async () => (await window.pika?.pickFolder()) ?? null,
  onBridgeLog: (cb) => window.pika?.onBridgeLog(cb) ?? noopUnsub(),
  onBridgeStatus: (cb) => window.pika?.onBridgeStatus(cb) ?? noopUnsub(),
  onVoiceHotkey: (cb) => window.pika?.onVoiceHotkey(cb) ?? noopUnsub(),
  onMiniMode: (cb) => window.pika?.onMiniMode(cb) ?? noopUnsub(),
  onWindowState: (cb) => window.pika?.onWindowState(cb) ?? noopUnsub(),
};
