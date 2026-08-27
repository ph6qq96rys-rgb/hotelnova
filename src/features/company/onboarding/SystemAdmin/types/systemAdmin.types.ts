export type CompanyStatus = "Draft" | "Active" | "Suspended" | "Inactive";

export interface CompanyListItemDto {
  id: string;
  legalName: string;
  tradeName?: string | null;
  tenantSlug?: string | null;
  defaultCurrency: string;
  timezone: string;
  status: CompanyStatus | string;
  isActive: boolean;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
}

export interface SwitchCompanyContextDto {
  companyId: string;
  companyName: string;
  tenantSlug: string;
}

export interface SwitchTenantWorkspaceDto {
  token?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAtUtc?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  tenantSlug?: string | null;
  roles?: string[];
  permissions?: string[];
}
