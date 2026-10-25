export {};

declare global {
  interface Window {
    __BELLCAST__?: {
      platform?: "desktop" | "web";
      instanceUrl?: string;
      apiKey?: string;
      notify?: (payload: {
        id: string;
        title: string;
        body: string;
        topic: string;
        priority: number;
        click: string | null;
      }) => void;
      openExternal?: (url: string) => void;
    };
  }
}
