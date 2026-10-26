/**
 * Current device location for attendance. Uses Telegram's LocationManager (Bot API 8.0+) when the client
 * has it, otherwise the browser's geolocation. Never throws: failures come back as a reason the screen can show.
 */
import { getTelegramWebApp } from "./telegramWebApp";

export type DeviceLocation = { latitude: number; longitude: number; accuracyMeters: number | null };

export type LocationOutcome =
  | { ok: true; location: DeviceLocation }
  | { ok: false; reason: "denied" | "unavailable" | "timeout"; canOpenSettings: boolean };

type TelegramLocationData = { latitude: number; longitude: number; horizontal_accuracy?: number | null };

type TelegramLocationManager = {
  isInited: boolean;
  isLocationAvailable: boolean;
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  init: (callback?: () => void) => void;
  getLocation: (callback: (data: TelegramLocationData | null) => void) => void;
  openSettings: () => void;
};

const TIMEOUT_MS = 15_000;

function locationManager(): TelegramLocationManager | undefined {
  const app = getTelegramWebApp() as unknown as { LocationManager?: TelegramLocationManager } | undefined;
  return app?.LocationManager;
}

export function openTelegramLocationSettings(): void {
  locationManager()?.openSettings?.();
}

function withTimeout(promise: Promise<LocationOutcome>, canOpenSettings: boolean): Promise<LocationOutcome> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve({ ok: false, reason: "timeout", canOpenSettings }), TIMEOUT_MS);
    promise.then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    });
  });
}

function fromTelegram(manager: TelegramLocationManager): Promise<LocationOutcome> {
  return new Promise((resolve) => {
    const read = () => {
      if (!manager.isLocationAvailable) {
        // Some Telegram clients (desktop) have no location service; the web view may still have one.
        void fromBrowser().then(resolve);
        return;
      }
      if (manager.isAccessRequested && !manager.isAccessGranted) {
        resolve({ ok: false, reason: "denied", canOpenSettings: true });
        return;
      }
      manager.getLocation((data) => {
        if (!data) {
          resolve({ ok: false, reason: "denied", canOpenSettings: true });
          return;
        }
        resolve({
          ok: true,
          location: {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracyMeters: typeof data.horizontal_accuracy === "number" ? data.horizontal_accuracy : null,
          },
        });
      });
    };

    if (manager.isInited) read();
    else manager.init(read);
  });
}

function fromBrowser(): Promise<LocationOutcome> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unavailable", canOpenSettings: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          },
        }),
      (error) =>
        resolve({
          ok: false,
          reason: error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable",
          canOpenSettings: false,
        }),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS - 1000, maximumAge: 30_000 },
    );
  });
}

export function getDeviceLocation(): Promise<LocationOutcome> {
  const manager = locationManager();
  if (manager && typeof manager.init === "function") return withTimeout(fromTelegram(manager), true);
  return withTimeout(fromBrowser(), false);
}
