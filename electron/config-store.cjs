/**
 * Axalote Config Store
 * Persistent JSON config file stored in the Electron userData directory.
 * All settings are stored in a single `axalote-config.json` file.
 */
const { app, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const CONFIG_FILENAME = "axalote-config.json";

const DEFAULT_CONFIG = {
  engine: {
    baseUrl: "http://127.0.0.1:8081",
  },
  ui: {
    animations: true,
    colorTheme: "default",
    density: "normal",
    fontSize: "medium",
    borderRadius: "medium",
    highContrast: false,
    blurEffects: false,
    monacoTheme: "vs-dark",
    navbarPosition: "side",
    sidebarWidth: "normal",
    sidebarTextVisible: true,
    sidebarAlignment: "left",
    topbarTextVisible: true,
    topbarAlignment: "center",
  },
};

let configCache = null;

function getConfigPath() {
  return path.join(app.getPath("userData"), CONFIG_FILENAME);
}

function readConfig() {
  if (configCache) return configCache;

  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      // Deep merge with defaults to handle new keys
      configCache = deepMerge(structuredClone(DEFAULT_CONFIG), parsed);
      return configCache;
    }
  } catch (error) {
    console.error("Failed to read config file, using defaults:", error.message);
  }

  configCache = structuredClone(DEFAULT_CONFIG);
  writeConfig(configCache);
  return configCache;
}

function writeConfig(config) {
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    configCache = config;
  } catch (error) {
    console.error("Failed to write config file:", error.message);
  }
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Register IPC handlers for config operations.
 * Must be called after app.whenReady().
 */
function registerConfigIPC() {
  // Get the entire config
  ipcMain.handle("config:getAll", () => {
    return readConfig();
  });

  // Get a specific section (e.g., "engine", "ui")
  ipcMain.handle("config:get", (_event, section) => {
    const config = readConfig();
    return config[section] ?? null;
  });

  // Update a specific section (e.g., "engine", "ui")
  ipcMain.handle("config:set", (_event, section, value) => {
    const config = readConfig();
    if (typeof value === "object" && value !== null) {
      config[section] = { ...(config[section] || {}), ...value };
    } else {
      config[section] = value;
    }
    writeConfig(config);
    return config;
  });

  // Update a single key within a section
  ipcMain.handle("config:setKey", (_event, section, key, value) => {
    const config = readConfig();
    if (!config[section]) config[section] = {};
    config[section][key] = value;
    writeConfig(config);
    return config;
  });

  // Reset config to defaults
  ipcMain.handle("config:reset", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    writeConfig(config);
    return config;
  });

  // Reset a specific section
  ipcMain.handle("config:resetSection", (_event, section) => {
    const config = readConfig();
    config[section] = structuredClone(DEFAULT_CONFIG[section] || {});
    writeConfig(config);
    return config;
  });

  // Get config file path (for debugging)
  ipcMain.handle("config:getPath", () => {
    return getConfigPath();
  });
}

module.exports = { registerConfigIPC, readConfig, writeConfig, DEFAULT_CONFIG };
