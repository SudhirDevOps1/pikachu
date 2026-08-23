/**
 * ============================================================================
 *  PIKA AI — Electron Preload Script (Security Bridge)
 * ----------------------------------------------------------------------------
 *  Yeh script renderer (React) aur main process ke beech ka "safe darwaaza" hai.
 *
 *  Kyun zaroori hai? Agar hum nodeIntegration: true kar dete, toh koi bhi
 *  malicious script `require('fs')` karke user ki poori hard disk padh leta.
 *  Isliye hum contextBridge use karte hain — sirf woh functions expose karo
 *  jinki zaroorat hai, baaki sab locked.
 *
 *  Renderer mein use karo:  window.pika.minimize()
 * ============================================================================
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pika", {
  // ─── Marker: React ko pata chale ki hum desktop app mein hain ───
  isDesktop: true,

  // ─── Window controls (custom title bar ke liye) ───
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  toggleMiniMode: () => ipcRenderer.invoke("window:toggle-mini"),

  // ─── Python bridge control ───
  bridgeStatus: () => ipcRenderer.invoke("bridge:status"),
  restartBridge: () => ipcRenderer.invoke("bridge:restart"),

  // ─── App / system info ───
  appInfo: () => ipcRenderer.invoke("app:info"),

  // ─── Shell helpers ───
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  openPath: (p) => ipcRenderer.invoke("shell:open-path", p),

  // ─── Native file dialogs ───
  pickFile: () => ipcRenderer.invoke("dialog:pick-file"),
  pickFolder: () => ipcRenderer.invoke("dialog:pick-folder"),

  // ─── Event listeners (Main → Renderer) ───
  // Har listener ek unsubscribe function return karta hai (memory leak se bacho)
  onBridgeLog: (cb) => {
    const handler = (_e, line) => cb(line);
    ipcRenderer.on("bridge:log", handler);
    return () => ipcRenderer.removeListener("bridge:log", handler);
  },
  onBridgeStatus: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("bridge:status", handler);
    return () => ipcRenderer.removeListener("bridge:status", handler);
  },
  onVoiceHotkey: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("hotkey:voice-toggle", handler);
    return () => ipcRenderer.removeListener("hotkey:voice-toggle", handler);
  },
  onMiniMode: (cb) => {
    const handler = (_e, isMini) => cb(isMini);
    ipcRenderer.on("window:mini-mode", handler);
    return () => ipcRenderer.removeListener("window:mini-mode", handler);
  },
  onWindowState: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on("window:state", handler);
    return () => ipcRenderer.removeListener("window:state", handler);
  },
});
