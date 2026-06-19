export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }

  interface TelegramWebApp {
    initData: string;
    themeParams?: Record<string, string>;

    ready: () => void;
    expand: () => void;
    close?: () => void;

    closeScanQrPopup?: () => void;
    showScanQrPopup?: (
      params: { text?: string },
      callback?: (qrText: string) => boolean
    ) => void;

    HapticFeedback?: {
      notificationOccurred: (
        type: "success" | "error" | "warning"
      ) => void;
    };
  }
}