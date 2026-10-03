// src/auth/auth.types.ts

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  tenantSlug?: string | null;
  tenantId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  fullName: string;
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  tenantSlug?: string | null;
  email: string;
}

export interface ResetPasswordRequest {
  tenantSlug?: string | null;
  email: string;
  token: string;
  newPassword: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  firstName?: string | null;
  lastName?: string | null;

  employeeId: string | null;
  companyId: string | null;
  branchId: string | null;
  isCompanyScoped?: boolean;
  departmentId: string | null;
  stockLocationId: string | null;
  storeId: string | null;

  roles: string[];
  permissions: string[];
  isActive?: boolean;
  preferredLanguage?: string | null;
  defaultLanguage?: string | null;
}

export interface TokenObject {
  accessToken?: string | null;
  token?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  expiresAtUtc?: string | null;
  user?: Partial<AuthUser> | null;
}

export interface LoginResponse {
  token?: string | TokenObject | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  expiresAtUtc?: string | null;

  roles?: string[] | null;
  permissions?: string[] | null;

  user?: Partial<AuthUser> | null;

  companyId?: string | null;
  companyName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  isCompanyScoped?: boolean | null;
  tenantSlug?: string | null;
  preferredLanguage?: string | null;
  defaultLanguage?: string | null;
}

export interface AuthScope {
  companyId: string | null;
  companyName: string | null;
  tenantSlug: string | null;

  branchId: string | null;
  branchName: string | null;
  isCompanyScoped: boolean;
  departmentId: string | null;
  stockLocationId: string | null;
  storeId: string | null;
  preferredLanguage?: string | null;
  defaultLanguage?: string | null;
}

export interface AuthState extends AuthScope {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  permissions: string[];
  roles: string[];
  sessionOnly: boolean;
}
