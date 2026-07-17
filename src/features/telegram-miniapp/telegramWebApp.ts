// src/features/telegram-miniapp/telegramWebApp.ts

type TelegramNotificationType = "success" | "error" | "warning";
type TelegramImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
};

export type TelegramThemeParams = Record<string, string>;

export type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    query_id?: string;
    user?: TelegramUser;
    receiver?: TelegramUser;
    chat?: unknown;
    chat_type?: string;
    chat_instance?: string;
    start_param?: string;
    can_send_after?: number;
    auth_date?: number;
    hash?: string;
  };

  version?: string;
  platform?: string;
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
  isExpanded?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;

  ready: () => void;
  expand: () => void;
  close?: () => void;

  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;

  showScanQrPopup?: (
    params: { text?: string },
    callback?: (qrText: string) => boolean
  ) => void;

  closeScanQrPopup?: () => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  sendData?: (data: string) => void;

  MainButton?: {
    text?: string;
    isVisible?: boolean;
    isActive?: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };

  BackButton?: {
    isVisible?: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };

  HapticFeedback?: {
    impactOccurred?: (style: TelegramImpactStyle) => void;
    notificationOccurred?: (type: TelegramNotificationType) => void;
    selectionChanged?: () => void;
  };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const TELEGRAM_READY_RETRY_MS = 150;
const TELEGRAM_READY_MAX_ATTEMPTS = 15;

function safeTelegram(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return window.Telegram?.WebApp;
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return safeTelegram();
}

export function isTelegramEnvironment(): boolean {
  return Boolean(getTelegramWebApp());
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData ?? "";
}

export function hasTelegramInitData(): boolean {
  return getTelegramInitData().trim().length > 0;
}

export function getTelegramTheme(): TelegramThemeParams {
  return getTelegramWebApp()?.themeParams ?? {};
}

export function getTelegramUser(): TelegramUser | undefined {
  return getTelegramWebApp()?.initDataUnsafe?.user;
}

export function getTelegramUserId(): number | undefined {
  return getTelegramUser()?.id;
}

export function getTelegramStartParam(): string | undefined {
  return getTelegramWebApp()?.initDataUnsafe?.start_param;
}

export function getTelegramHeaders(): Record<string, string> {
  const initData = getTelegramInitData();
  return initData ? { "X-Telegram-InitData": initData } : {};
}

export type TelegramRuntimeState = {
  sdkLoaded: boolean;
  webAppLoaded: boolean;
  hasInitData: boolean;
  user?: TelegramUser;
  userId?: number;
  startParam?: string;
  platform?: string;
  version?: string;
  colorScheme?: string;
};

export function getTelegramRuntimeState(): TelegramRuntimeState {
  const tg = getTelegramWebApp();

  return {
    sdkLoaded: typeof window !== "undefined" && Boolean(window.Telegram),
    webAppLoaded: Boolean(tg),
    hasInitData: Boolean(tg?.initData?.trim()),
    user: tg?.initDataUnsafe?.user,
    userId: tg?.initDataUnsafe?.user?.id,
    startParam: tg?.initDataUnsafe?.start_param,
    platform: tg?.platform,
    version: tg?.version,
    colorScheme: tg?.colorScheme,
  };
}

export function initializeTelegramMiniApp(): boolean {
  const tg = getTelegramWebApp();

  if (!tg) return false;

  try {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation?.();
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[TelegramMiniApp] initialize failed", error);
    return false;
  }
}

export function waitForTelegramMiniApp(
  callback: (state: TelegramRuntimeState) => void,
  options?: {
    maxAttempts?: number;
    retryMs?: number;
  }
): () => void {
  const maxAttempts = options?.maxAttempts ?? TELEGRAM_READY_MAX_ATTEMPTS;
  const retryMs = options?.retryMs ?? TELEGRAM_READY_RETRY_MS;

  let attempt = 0;
  let timer: number | undefined;
  let cancelled = false;

  const check = () => {
    if (cancelled) return;

    attempt += 1;

    const initialized = initializeTelegramMiniApp();
    callback(getTelegramRuntimeState());

    if (initialized || attempt >= maxAttempts) return;

    timer = window.setTimeout(check, retryMs);
  };

  check();

  return () => {
    cancelled = true;
    if (timer) window.clearTimeout(timer);
  };
}

export function notifyTelegram(type: TelegramNotificationType): void {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.(type);
}

export function vibrateTelegram(style: TelegramImpactStyle = "light"): void {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style);
}

export function closeTelegramMiniApp(delayMs = 0): void {
  const close = () => getTelegramWebApp()?.close?.();

  if (delayMs > 0) {
    window.setTimeout(close, delayMs);
    return;
  }

  close();
}

export function showTelegramQrScanner(
  text: string,
  onScan: (qrText: string) => boolean | void
): boolean {
  const tg = getTelegramWebApp();

  if (!tg?.showScanQrPopup) return false;

  tg.showScanQrPopup({ text }, (qrText) => {
    const result = onScan(qrText);
    return typeof result === "boolean" ? result : true;
  });

  return true;
}

export function closeTelegramQrScanner(): void {
  getTelegramWebApp()?.closeScanQrPopup?.();
}

export function setTelegramMainButton(
  text: string,
  onClick: () => void,
  options?: {
    enabled?: boolean;
  }
): void {
  const mainButton = getTelegramWebApp()?.MainButton;

  if (!mainButton) return;

  mainButton.setText(text);

  if (options?.enabled === false) {
    mainButton.disable();
  } else {
    mainButton.enable();
  }

  mainButton.offClick?.(onClick);
  mainButton.onClick(onClick);
  mainButton.show();
}

export function hideTelegramMainButton(): void {
  getTelegramWebApp()?.MainButton?.hide();
}

export function setTelegramBackButton(onClick: () => void): void {
  const backButton = getTelegramWebApp()?.BackButton;

  if (!backButton) return;

  backButton.offClick?.(onClick);
  backButton.onClick(onClick);
  backButton.show();
}

export function hideTelegramBackButton(): void {
  getTelegramWebApp()?.BackButton?.hide();
}
