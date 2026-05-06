const { app, BrowserWindow, ipcMain, shell, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { registerConfigIPC, readConfig } = require("./config-store.cjs");

const isWatchMode = process.env.ELECTRON_WATCH === "1";
const distDir = path.join(__dirname, "../dist");
const distIndex = path.join(distDir, "index.html");
const distRenderer = path.join(distDir, "renderer.js");

// In production (packaged), icons are in resources/ via extraResources.
// In development, they are in public/ relative to the project root.
function getIconPath() {
  const isPackaged = app.isPackaged;
  if (process.platform === 'win32') {
    return isPackaged
      ? path.join(process.resourcesPath, "icon.ico")
      : path.resolve(__dirname, "../public/favicon.ico");
  }
  return isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.resolve(__dirname, "../public/logo/axalote.png");
}

app.setName("AXALOTE");
if (process.platform === "win32") { app.setAppUserModelId("com.axalote.app"); }

let mainWindow = null;
let reloadTimeout = null;

function reloadWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(distIndex);
    }
  }, 150);
}

function startRendererWatch() {
  if (!isWatchMode) return;

  for (const file of [distIndex, distRenderer]) {
    fs.watchFile(file, { interval: 300 }, () => {
      reloadWindow();
    });
  }
}

function stopRendererWatch() {
  for (const file of [distIndex, distRenderer]) {
    fs.unwatchFile(file);
  }
}

function createWindow() {
  const iconFile = getIconPath();
  console.log("[AXALOTE] Icon path:", iconFile);
  console.log("[AXALOTE] Icon exists:", fs.existsSync(iconFile));
  console.log("[AXALOTE] app.isPackaged:", app.isPackaged);

  let appIcon;
  try {
    appIcon = nativeImage.createFromPath(iconFile);
    console.log("[AXALOTE] Icon loaded, isEmpty:", appIcon.isEmpty());
  } catch (err) {
    console.error("[AXALOTE] Failed to load icon:", err);
  }

  mainWindow = new BrowserWindow({
    title: "AXALOTE",
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0b0f0c",
    autoHideMenuBar: true,
    icon: appIcon || iconFile,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.loadFile(distIndex);

  if (isWatchMode) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Failed to load:", { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("shell:openExternal", async (_event, url) => {
  if (typeof url !== "string" || !url.trim()) return;
  await shell.openExternal(url);
});

ipcMain.handle("app:getInfo", () => {
  const config = readConfig();
  return {
    isElectron: true,
    platform: process.platform,
    apiBaseUrl: config.engine?.baseUrl || "http://127.0.0.1:8081",
  };
});

app.whenReady().then(() => {
  registerConfigIPC();
  createWindow();
  startRendererWatch();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  stopRendererWatch();
});
