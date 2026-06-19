// src/features/organization/types.ts

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type OrgFilter = {
  q?: string;
  page?: number;
  pageSize?: number;
  companyId?: string;
  branchId?: string;
  isActive?: boolean;
};

export type OrganizationDto = {
  id: string;
  name: string;
  code?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  isActive: boolean;
  createdAt?: string | null;

  legalName?: string | null;
  tin?: string | null;
  country?: string | null;
  currency?: string | null;
  timeZone?: string | null;

  region?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;

  isWarehouse?: boolean | null;
};

export type CompanyDto = OrganizationDto & {
  legalName?: string | null;
  tin?: string | null;
  country?: string | null;
  currency?: string | null;
  timeZone?: string | null;
};

export type BranchDto = OrganizationDto & {
  companyId: string;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
};

export type StoreDto = OrganizationDto & {
  companyId: string;
  branchId: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  isWarehouse: boolean;
};

export type CreateCompanyDto = {
  name: string;
  legalName?: string | null;
  tin?: string | null;
  country?: string | null;
  currency?: string | null;
  timeZone?: string | null;
  isActive?: boolean;
};

export type UpdateCompanyDto = Partial<CreateCompanyDto>;

export type CreateBranchDto = {
  companyId: string;
  name: string;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export type UpdateBranchDto = Partial<Omit<CreateBranchDto, "companyId">>;

export type CreateStoreDto = {
  companyId: string;
  branchId: string;
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  isWarehouse?: boolean;
  isActive?: boolean;
};

export type UpdateStoreDto = Partial<
  Omit<CreateStoreDto, "companyId" | "branchId">
>;

export type CreateOrganizationDto =
  | CreateCompanyDto
  | CreateBranchDto
  | CreateStoreDto;

export type UpdateOrganizationDto =
  | UpdateCompanyDto
  | UpdateBranchDto
  | UpdateStoreDto;