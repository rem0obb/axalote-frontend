const { contextBridge, ipcRenderer } = require("electron");

async function bootstrap() {
  const appInfo = await ipcRenderer.invoke("app:getInfo");

  contextBridge.exposeInMainWorld("electronAPI", {
    appInfo: {
      isElectron: appInfo.isElectron,
      platform: appInfo.platform,
    },
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  });

  contextBridge.exposeInMainWorld("__AXALOTE_API__", {
    baseUrl: appInfo.apiBaseUrl,
  });

  // Expose persistent config API to renderer
  contextBridge.exposeInMainWorld("axaloteConfig", {
    getAll: () => ipcRenderer.invoke("config:getAll"),
    get: (section) => ipcRenderer.invoke("config:get", section),
    set: (section, value) => ipcRenderer.invoke("config:set", section, value),
    setKey: (section, key, value) =>
      ipcRenderer.invoke("config:setKey", section, key, value),
    reset: () => ipcRenderer.invoke("config:reset"),
    resetSection: (section) => ipcRenderer.invoke("config:resetSection", section),
    getPath: () => ipcRenderer.invoke("config:getPath"),
  });
}

bootstrap().catch((error) => {
  console.error("Failed to initialize preload bridge", error);
});
