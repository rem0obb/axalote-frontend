export {};

declare global {
  interface Window {
    electronAPI?: {
      appInfo: {
        isElectron: boolean;
        platform: NodeJS.Platform;
      };
      openExternal: (url: string) => Promise<void>;
    };
    __AXALOTE_API__?: {
      baseUrl: string;
    };
  }
}
