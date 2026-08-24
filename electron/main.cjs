/**
 * ============================================================================
 *  PIKA AI — Electron Main Process
 * ----------------------------------------------------------------------------
 *  Yeh file desktop app ka "dil" hai. Iska kaam:
 *    1. BrowserWindow banana (frameless, glassy, dark)
 *    2. Python pc_bridge.py ko child process ki tarah auto-start karna
 *    3. System Tray icon + context menu dena
 *    4. Global hotkey (Ctrl+Shift+Space) register karna — kahin se bhi voice on
 *    5. Mini "Always on Top" mode toggle karna
 *    6. IPC handlers (window minimize/maximize/close, bridge restart, etc.)
 *
 *  Security note: contextIsolation ON + nodeIntegration OFF rakha hai.
 *  Renderer (React) ko Node ka direct access NAHI milta — sab kuch preload.cjs
 *  ke contextBridge se hi jaata hai. Yeh production-grade security practice hai.
 * ============================================================================
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, dialog, nativeImage, crashReporter } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const os = require("os");

// ─── Auto-Update (electron-updater) ───────────────────────────────────────
let autoUpdater;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch (e) {
  console.log("[pika] electron-updater not available, auto-update disabled");
}

// ─── Constants ──────────────────────────────────────────────────────────────
const IS_DEV = !app.isPackaged;
const VITE_DEV_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:3000";
const ROOT = path.join(__dirname, "..");

// Window size presets
const NORMAL_SIZE = { width: 1440, height: 900, minWidth: 900, minHeight: 600 };
const MINI_SIZE = { width: 340, height: 480 };

/** @type {BrowserWindow|null} */
let mainWindow = null;
/** @type {Tray|null} */
let tray = null;
/** @type {import('child_process').ChildProcess|null} */
let bridgeProcess = null;
let bridgeRestartCount = 0;
let isMiniMode = false;
let isQuitting = false;

// ─── Single instance lock ───────────────────────────────────────────────────
// Agar user do baar app kholta hai toh dusri instance band karke pehli ko focus karo
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── Python Bridge Auto-Start ───────────────────────────────────────────────
/**
 * pc_bridge.py ko find karke run karta hai.
 * Priority: venv python > system python > py launcher
 * Agar Python mila hi nahi toh silently skip — app demo mode mein chalega.
 */
function resolvePythonExecutable() {
  const isWin = process.platform === "win32";
  const venvPy = isWin
    ? path.join(ROOT, "venv", "Scripts", "python.exe")
    : path.join(ROOT, "venv", "bin", "python");

  if (fs.existsSync(venvPy)) return venvPy;
  return isWin ? "python" : "python3";
}

function startPythonBridge() {
  // Production: use bundled pc_bridge.exe; Development: use Python script
  let bridgeCmd, bridgeArgs, bridgeCwd;
  
  if (!IS_DEV && app.isPackaged) {
    // Production mode — bundled executable
    const bundledExe = path.join(process.resourcesPath, "bin", "pc_bridge.exe");
    const devExe = path.join(ROOT, "dist-bin", "pc_bridge.exe");
    
    if (fs.existsSync(bundledExe)) {
      bridgeCmd = bundledExe;
      bridgeArgs = [];
      bridgeCwd = path.dirname(bundledExe);
      console.log(`[pika] Production mode: ${bridgeCmd}`);
    } else if (fs.existsSync(devExe)) {
      bridgeCmd = devExe;
      bridgeArgs = [];
      bridgeCwd = path.dirname(devExe);
      console.log(`[pika] Dev-build mode: ${bridgeCmd}`);
    } else {
      console.warn("[pika] pc_bridge.exe not found — running in DEMO mode.");
      return;
    }
  } else {
    // Development mode — Python script
    const bridgeScript = path.join(ROOT, "pc_bridge.py");
    if (!fs.existsSync(bridgeScript)) {
      console.warn("[pika] pc_bridge.py not found — running in DEMO mode.");
      return;
    }
    bridgeCmd = resolvePythonExecutable();
    bridgeArgs = [bridgeScript];
    bridgeCwd = ROOT;
    console.log(`[pika] Development mode: ${bridgeCmd} ${bridgeScript}`);
  }

  try {
    bridgeProcess = spawn(bridgeCmd, bridgeArgs, {
      cwd: bridgeCwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
      windowsHide: true,
    });

    bridgeProcess.stdout.on("data", (d) => {
      const line = d.toString().trim();
      if (line) console.log(`[bridge] ${line}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("bridge:log", line);
      }
    });

    bridgeProcess.stderr.on("data", (d) => {
      const line = d.toString().trim();
      if (line) console.error(`[bridge:err] ${line}`);
    });

    bridgeProcess.on("close", (code) => {
      console.log(`[pika] Bridge exited with code ${code}`);
      bridgeProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("bridge:status", { running: false, code });
      }
      // Auto-restart bridge if it crashed (not intentional stop)
      if (code !== 0 && !isQuitting && bridgeRestartCount < 3) {
        bridgeRestartCount++;
        console.log(`[pika] Auto-restarting bridge (attempt ${bridgeRestartCount}/3)...`);
        setTimeout(() => startPythonBridge(), 2000 * bridgeRestartCount);
      } else if (bridgeRestartCount >= 3) {
        console.log("[pika] Bridge restart limit reached. Manual restart required.");
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("bridge:status", { running: false, code, maxRetries: true });
        }
      }
    });

    bridgeProcess.on("error", (err) => {
      console.error(`[pika] Bridge spawn failed: ${err.message}`);
      bridgeProcess = null;
    });
    // Reset restart counter on successful start
    bridgeRestartCount = 0;
  } catch (err) {
    console.error("[pika] Could not start Python bridge:", err);
  }
}

function stopPythonBridge() {
  if (!bridgeProcess) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(bridgeProcess.pid), "/f", "/t"]);
    } else {
      bridgeProcess.kill("SIGTERM");
    }
  } catch (err) {
    console.error("[pika] Failed to stop bridge:", err);
  }
  bridgeProcess = null;
}

// ─── Tray Icon ──────────────────────────────────────────────────────────────
/** Simple inline SVG → PNG data URL so we don't need an external asset file. */
function createTrayIcon() {
  const iconPath = path.join(__dirname, "icon.png");
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00f0ff"/><stop offset="100%" stop-color="#ff00ff"/>
    </linearGradient></defs>
    <rect width="32" height="32" rx="8" fill="url(#g)"/>
    <path d="M18 6 L10 18 h5 l-1 8 8-12 h-5 z" fill="white"/>
  </svg>`;
  return nativeImage.createFromDataURL(
    "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64")
  );
}

function createTray() {
  try {
    tray = new Tray(createTrayIcon());
    const menu = Menu.buildFromTemplate([
      { label: "⚡ Pika AI", enabled: false },
      { type: "separator" },
      { label: "Show / Hide Window", click: () => toggleWindow() },
      { label: "Mini Mode (Always on Top)", type: "checkbox", checked: isMiniMode, click: () => toggleMiniMode() },
      { label: "Dispatch: Scheduled Jobs", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.webContents.send("nav:scheduler"); } } },
      { label: "Connectors: Gmail/Calendar", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.webContents.send("nav:connectors"); } } },
      { type: "separator" },
      { label: "Restart PC Bridge", click: () => { stopPythonBridge(); setTimeout(startPythonBridge, 600); } },
      { label: "Open Logs Folder", click: () => shell.openPath(ROOT) },
      { type: "separator" },
      { label: "Quit Pika", click: () => { isQuitting = true; app.quit(); } },
    ]);
    tray.setToolTip("Pika AI Assistant — tray: dispatch + connectors added");
    tray.setContextMenu(menu);
    tray.on("double-click", () => toggleWindow());
  } catch (err) {
    console.error("[pika] Tray creation failed:", err);
  }
}

// ─── Window Management ──────────────────────────────────────────────────────
function createMainWindow() {
  const iconPath = path.join(__dirname, "icon.png");
  mainWindow = new BrowserWindow({
    ...NORMAL_SIZE,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    frame: false,               // custom title bar — humara apna HUD look
    titleBarStyle: "hidden",
    backgroundColor: "#0a0b10", // flash-of-white avoid karne ke liye
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,   // ✅ security
      nodeIntegration: false,   // ✅ security
      sandbox: false,           // preload needs limited node APIs
      webSecurity: true,
    },
  });

  // Dev mein Vite server, production mein built single-file HTML
  if (IS_DEV) {
    mainWindow.loadURL(VITE_DEV_URL);
  } else {
    mainWindow.loadFile(path.join(ROOT, "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  // Close button → tray mein minimize (background mein chalta rahe)
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // External links default browser mein khulein, app ke andar nahi
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("maximize", () => mainWindow.webContents.send("window:state", { maximized: true }));
  mainWindow.on("unmaximize", () => mainWindow.webContents.send("window:state", { maximized: false }));
}

function toggleWindow() {
  if (!mainWindow) return createMainWindow();
  if (mainWindow.isVisible()) mainWindow.hide();
  else { mainWindow.show(); mainWindow.focus(); }
}

function toggleMiniMode() {
  if (!mainWindow) return;
  isMiniMode = !isMiniMode;
  if (isMiniMode) {
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.setSize(MINI_SIZE.width, MINI_SIZE.height, true);
    mainWindow.setResizable(false);
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setResizable(true);
    mainWindow.setSize(NORMAL_SIZE.width, NORMAL_SIZE.height, true);
    mainWindow.center();
  }
  mainWindow.webContents.send("window:mini-mode", isMiniMode);
}

// ─── IPC Handlers (Renderer → Main) ─────────────────────────────────────────
function registerIpcHandlers() {
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle("window:close", () => mainWindow?.hide());
  ipcMain.handle("window:toggle-mini", () => { toggleMiniMode(); return isMiniMode; });

  ipcMain.handle("bridge:status", () => ({ running: bridgeProcess !== null }));
  ipcMain.handle("bridge:restart", () => {
    stopPythonBridge();
    setTimeout(startPythonBridge, 600);
    return true;
  });

  ipcMain.handle("app:info", () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    isDesktop: true,
  }));

  ipcMain.handle("shell:open-external", (_e, url) => {
    try {
      const u = new URL(url);
      if (!["http:", "https:", "mailto:"].includes(u.protocol)) {
        console.warn("[pika] blocked open-external non-http:", url.slice(0,80));
        return Promise.resolve({ error: "blocked: only http/https/mailto allowed" });
      }
      return shell.openExternal(url);
    } catch { return Promise.resolve({ error: "invalid url" }); }
  });
  ipcMain.handle("shell:open-path", (_e, p) => {
    // Allow only under HOME or ROOT, block Windows/System32
    try {
      const path = require("path");
      const rp = path.resolve(String(p));
      if (/Windows\\System32/i.test(rp) || /^\w:\\Windows/i.test(rp)) return Promise.resolve({ error: "blocked" });
      return shell.openPath(p);
    } catch { return shell.openPath(p); }
  });

  ipcMain.handle("dialog:pick-file", async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"] });
    return res.canceled ? null : res.filePaths[0];
  });
  ipcMain.handle("dialog:pick-folder", async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
    return res.canceled ? null : res.filePaths[0];
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Crash reporter for debugging
  crashReporter.start({
    productName: "PikaAI",
    submitURL: "",  // No remote server — local only
    uploadToServer: false,
    compress: true,
  });
  registerIpcHandlers();
  createMainWindow();
  createTray();
  startPythonBridge();

  // Auto-update check (non-blocking, runs in background)
  if (autoUpdater && !IS_DEV) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    autoUpdater.on("update-available", (info) => {
      console.log(`[pika] Update available: ${info.version}`);
      if (mainWindow) {
        mainWindow.webContents.send("update:available", { version: info.version });
      }
    });
    autoUpdater.on("download-progress", (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send("update:progress", { percent: progress.percent });
      }
    });
    autoUpdater.on("update-downloaded", () => {
      console.log("[pika] Update downloaded, will install on quit");
    });
  }

  // Global hotkeys: kahin se bhi Pika ko bulao + always-on dispatch
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("hotkey:voice-toggle");
  });
  // Extra: Ctrl+Shift+Alt+P = pause, Ctrl+Shift+Alt+S = stop (Thio-style interrupt)
  try {
    globalShortcut.register("CommandOrControl+Shift+Alt+P", () => {
      if (mainWindow) mainWindow.webContents.send("hotkey:pause");
    });
    globalShortcut.register("CommandOrControl+Shift+Alt+S", () => {
      if (mainWindow) mainWindow.webContents.send("hotkey:stop");
    });
    globalShortcut.register("CommandOrControl+Shift+D", () => {
      if (mainWindow) mainWindow.webContents.send("hotkey:dispatch");
    });
  } catch (e) { console.warn("[pika] extra hotkey failed", e.message); }
  // Keep app awake for dispatch (prevent sleep during scheduled jobs)
  try {
    const { powerSaveBlocker } = require("electron");
    const blockerId = powerSaveBlocker.start("prevent-app-suspension");
    console.log("[pika] powerSaveBlocker", blockerId, powerSaveBlocker.isStarted(blockerId));
  } catch (e) { console.warn("[pika] powerSaveBlocker failed", e.message); }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  // macOS pe app dock mein rehta hai — Windows/Linux pe tray mein
  if (process.platform !== "darwin") { /* tray keeps it alive */ }
});

app.on("before-quit", () => { isQuitting = true; });

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopPythonBridge();
});

process.on("uncaughtException", (err) => console.error("[pika] Uncaught:", err));
