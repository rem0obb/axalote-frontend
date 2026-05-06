/**
 * Axalote Persistent Config Service
 *
 * Wraps the Electron IPC config API (file-backed JSON) with a localStorage
 * fallback for browser environments. Every component reads/writes through
 * this single service so settings always persist.
 */

export interface AxaloteConfig {
  engine: {
    baseUrl: string;
  };
  ui: {
    animations: boolean;
    colorTheme: string;
    density: string;
    fontSize: string;
    borderRadius: string;
    highContrast: boolean;
    blurEffects: boolean;
    monacoTheme: string;
    navbarPosition: 'top' | 'side';
    sidebarWidth: string;
    sidebarTextVisible: boolean;
    sidebarAlignment: 'left' | 'center' | 'right';
    topbarTextVisible: boolean;
    topbarAlignment: 'left' | 'center' | 'right';
  };
  [key: string]: any;
}

// Type for the Electron bridge
interface AxaloteConfigBridge {
  getAll: () => Promise<AxaloteConfig>;
  get: (section: string) => Promise<any>;
  set: (section: string, value: any) => Promise<AxaloteConfig>;
  setKey: (section: string, key: string, value: any) => Promise<AxaloteConfig>;
  reset: () => Promise<AxaloteConfig>;
  resetSection: (section: string) => Promise<AxaloteConfig>;
  getPath: () => Promise<string>;
}

declare global {
  interface Window {
    axaloteConfig?: AxaloteConfigBridge;
  }
}

const STORAGE_KEY = 'axalote_persistent_config';

const DEFAULT_CONFIG: AxaloteConfig = {
  engine: {
    baseUrl: 'http://127.0.0.1:8081',
  },
  ui: {
    animations: true,
    colorTheme: 'default',
    density: 'normal',
    fontSize: 'medium',
    borderRadius: 'medium',
    highContrast: false,
    blurEffects: false,
    monacoTheme: 'vs-dark',
    navbarPosition: 'side',
    sidebarWidth: 'normal',
    sidebarTextVisible: true,
    sidebarAlignment: 'left',
    topbarTextVisible: true,
    topbarAlignment: 'center',
  },
};

function isElectronConfig(): boolean {
  return typeof window !== 'undefined' && !!window.axaloteConfig;
}

// ── localStorage fallback helpers ──────────────────────────────────────────

function readLocalConfig(): AxaloteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

function writeLocalConfig(config: AxaloteConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function configGetAll(): Promise<AxaloteConfig> {
  if (isElectronConfig()) {
    return window.axaloteConfig!.getAll();
  }
  return readLocalConfig();
}

export async function configGetSection<T = any>(section: string): Promise<T> {
  if (isElectronConfig()) {
    return window.axaloteConfig!.get(section);
  }
  const config = readLocalConfig();
  return (config as any)[section] ?? null;
}

export async function configSetSection(section: string, value: any): Promise<AxaloteConfig> {
  if (isElectronConfig()) {
    return window.axaloteConfig!.set(section, value);
  }
  const config = readLocalConfig();
  if (typeof value === 'object' && value !== null) {
    (config as any)[section] = { ...((config as any)[section] || {}), ...value };
  } else {
    (config as any)[section] = value;
  }
  writeLocalConfig(config);
  return config;
}

export async function configSetKey(section: string, key: string, value: any): Promise<AxaloteConfig> {
  if (isElectronConfig()) {
    return window.axaloteConfig!.setKey(section, key, value);
  }
  const config = readLocalConfig();
  if (!(config as any)[section]) (config as any)[section] = {};
  (config as any)[section][key] = value;
  writeLocalConfig(config);
  return config;
}

export async function configReset(): Promise<AxaloteConfig> {
  if (isElectronConfig()) {
    return window.axaloteConfig!.reset();
  }
  writeLocalConfig({ ...DEFAULT_CONFIG });
  return { ...DEFAULT_CONFIG };
}

export async function configResetSection(section: string): Promise<AxaloteConfig> {
  if (isElectronConfig()) {
    return window.axaloteConfig!.resetSection(section);
  }
  const config = readLocalConfig();
  (config as any)[section] = { ...(DEFAULT_CONFIG as any)[section] };
  writeLocalConfig(config);
  return config;
}

export async function configGetPath(): Promise<string> {
  if (isElectronConfig()) {
    return window.axaloteConfig!.getPath();
  }
  return 'localStorage';
}

export { DEFAULT_CONFIG };
