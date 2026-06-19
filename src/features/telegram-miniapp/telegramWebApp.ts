export function getTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData ?? "";
}

export function getTelegramTheme(): Record<string, string> {
  return getTelegramWebApp()?.themeParams ?? {};
}

export function notifyTelegram(
  type: "success" | "error" | "warning"
): void {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type);
}

export function closeTelegramMiniApp(delayMs = 0): void {
  const close = () => getTelegramWebApp()?.close?.();

  if (delayMs > 0) {
    window.setTimeout(close, delayMs);
    return;
  }

  close();
}

export function initializeTelegramMiniApp(): void {
  const tg = getTelegramWebApp();
  tg?.ready();
  tg?.expand();
}