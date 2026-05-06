export const runtime = {
  isElectron: Boolean(window.electronAPI?.appInfo?.isElectron),
  platform: window.electronAPI?.appInfo?.platform ?? "unknown",
};

export function getAssetPath(assetPath: string) {
  const normalizedPath = assetPath.replace(/^\/+/, "");
  return new URL(normalizedPath, document.baseURI).toString();
}

export async function openExternalLink(url: string) {
  if (window.electronAPI?.openExternal) {
    await window.electronAPI.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
