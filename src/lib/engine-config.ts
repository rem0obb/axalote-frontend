import { runtime } from '@/lib/runtime';
import { configSetKey, configGetSection } from '@/lib/persistent-config';

type DesktopApiConfig = {
  baseUrl: string;
};

export const ENGINE_BASE_URL_STORAGE_KEY = 'axalote_engine_base_url';

export function normalizeEngineBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function getDefaultEngineBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8081';
  }

  const desktopWindow = window as Window & {
    __AXALOTE_API__?: DesktopApiConfig;
  };

  const preloadBaseUrl = desktopWindow.__AXALOTE_API__?.baseUrl;
  if (preloadBaseUrl) {
    return normalizeEngineBaseUrl(preloadBaseUrl);
  }

  if (!runtime.isElectron && window.location.hostname) {
    return normalizeEngineBaseUrl(`http://${window.location.hostname}:8081`);
  }

  return 'http://127.0.0.1:8081';
}

export function getEngineBaseUrl() {
  try {
    const storedValue = localStorage.getItem(ENGINE_BASE_URL_STORAGE_KEY);
    if (storedValue) {
      return normalizeEngineBaseUrl(storedValue);
    }
  } catch (error) {
    console.error('Failed to read engine base URL', error);
  }

  return getDefaultEngineBaseUrl();
}

export function setEngineBaseUrl(baseUrl: string) {
  const normalizedBaseUrl = normalizeEngineBaseUrl(baseUrl);
  localStorage.setItem(ENGINE_BASE_URL_STORAGE_KEY, normalizedBaseUrl);
  // Persist to config file (async, fire-and-forget)
  configSetKey('engine', 'baseUrl', normalizedBaseUrl).catch(() => {});
  return normalizedBaseUrl;
}

export function resetEngineBaseUrl() {
  const defaultBaseUrl = getDefaultEngineBaseUrl();
  localStorage.removeItem(ENGINE_BASE_URL_STORAGE_KEY);
  // Persist reset to config file
  configSetKey('engine', 'baseUrl', defaultBaseUrl).catch(() => {});
  return defaultBaseUrl;
}

/**
 * Load the engine URL from persistent config on startup.
 * Should be called once during app initialization.
 */
export async function initEngineBaseUrl() {
  try {
    const engineConfig = await configGetSection<{ baseUrl?: string }>('engine');
    if (engineConfig?.baseUrl) {
      const url = normalizeEngineBaseUrl(engineConfig.baseUrl);
      localStorage.setItem(ENGINE_BASE_URL_STORAGE_KEY, url);
      return url;
    }
  } catch {
    // Fall through to default
  }
  return getDefaultEngineBaseUrl();
}
