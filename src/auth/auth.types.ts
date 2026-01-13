export type LoginRequest = { email: string; password: string };
export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string;
  roles?: string[];
  permissions?: string[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string; // if your API returns it to the client
  expiresAt?: string;    // optional ISO string
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
};
export type ResetPasswordRequest = {
  email: string;
  token: string;
  newPassword: string;
};
export type LoginResponse = {
  token: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  user?: AuthUser | null;
};