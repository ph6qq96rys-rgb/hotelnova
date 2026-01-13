/*export type CompanyDto = {
  id: string;
  name: string;
  legalName?: string | null;
  tin?: string | null;
  country?: string | null;
  currency?: string | null;
  timeZone?: string | null;
  isActive: boolean;
};

export type BranchDto = {
  id: string;
  companyId: string;
  name: string;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
};

export type StoreDto = {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  isWarehouse: boolean;
  isActive: boolean;
};*/
export type CompanyDto = OrganizationDto&{
  id: string;
  name: string;
  legalName?: string | null;
  tin?: string | null;
  country?: string | null;
  currency?: string | null;
  timeZone?: string | null;
  isActive: boolean;
}

// ✅ Make these compatible (optional fields)
export type BranchDto = OrganizationDto & {
  companyId?: string | null;
  id: string;
  name: string;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
};

export type StoreDto = OrganizationDto & {
  branchId?: string | null;
  isWarehouse?: boolean;
  id: string;
  companyId?: string|null;
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
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

export type UpdateStoreDto = Partial<Omit<CreateStoreDto, "companyId" | "branchId">>;
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
};

export type CreateOrganizationDto = {
  name: string;
  code?: string | null;
  companyId?: string | null;
};

export type UpdateOrganizationDto = {
  name?: string;
  code?: string | null;
  companyId?: string | null;
};
// src/features/org/types.ts (or wherever your org types live)




