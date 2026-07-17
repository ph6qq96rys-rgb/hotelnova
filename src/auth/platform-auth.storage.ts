export type PlatformAuth = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string|null;
  roles: string[];
  permissions: string[];
};

const PLATFORM_AUTH_KEY = "restaurantfnb.platformAuth";

export function loadPlatformAuth(): PlatformAuth | null {
  const raw = localStorage.getItem(PLATFORM_AUTH_KEY) ?? sessionStorage.getItem(PLATFORM_AUTH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PlatformAuth;
  } catch {
    localStorage.removeItem(PLATFORM_AUTH_KEY);
    sessionStorage.removeItem(PLATFORM_AUTH_KEY);
    return null;
  }
}

export function savePlatformAuth(auth: PlatformAuth, remember: boolean): void {
  clearPlatformAuth();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(PLATFORM_AUTH_KEY, JSON.stringify(auth));
}

export function clearPlatformAuth(): void {
  localStorage.removeItem(PLATFORM_AUTH_KEY);
  sessionStorage.removeItem(PLATFORM_AUTH_KEY);
}
