
export const CompanyStatus = {
  Inactive: 0,
  Active: 1,
  Draft:2
} as const;

export type CompanyStatus =
  typeof CompanyStatus[keyof typeof CompanyStatus];
export type BranchDto = { id: string; name: string; code?: string | null;isMain?:boolean|null };

export type CompanyDto = {
  id: string;
  legalName: string|null;
  tradeName?: string | null;
  defaultCurrency: string;
  timezone: string|null;
  status: CompanyStatus;
  country:string|null;
  region:string|null;
  city:string|null;
  createdAt:Date|null
};

export type PagedResult<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

export type CreateCompanyDto = {
  legalName: string;
  tradeName?: string;
  tinNumber?: string;
  vatNumber?: string;
  phone?: string;
  email?: string;
  country?: string;
  city?: string;
  addressLine?: string;
  defaultCurrency: string;
  timezone: string;
};

export type CreateBranchDto = {
  code: string;
  name: string;
  region?: string | null;
  city?: string | null;
  addressLine?: string | null;
  isMain: boolean;
  isActive?: boolean;
};

export type BranchVm = {
  id: string;
  code: string;
  name: string;
  region?: string | null;
  city?: string | null;
  addressLine?: string | null;
  isMain: boolean;
  isActive: boolean;
};

export type CreateStoreDto = {
  branchId: string;
  code: string;
  name: string;
  addressLine?: string;
};

export type StoreVm = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  addressLine?: string | null;
  isActive: boolean;
};

export type CompanySettingsDto = {
  vatEnabled: boolean;
  vatRate: number;
  pricesIncludeVat: boolean;
  invoicePrefix: string;
  receiptPrefix: string;
  allowNegativeStock: boolean;
  fiscalYearStartMonth: number;
};

export type CreateCompanyAdminUserDto = {
  userName: string;
  email: string;
  password: string;
  branchId?: string;
  storeId?: string;
};
export type OnboardingStatus = {
  companyId: string;
  branchId: string;

  hasStockLocations: boolean;
  hasDefaultReceivingLocation: boolean;
  hasDefaultIssueLocation: boolean;

  hasStores: boolean;
  hasStoreMappedToIssueLocation: boolean;

  canUseInventory: boolean;
  canUseProduction: boolean;
  canUseSales: boolean;

  blockingReasons: string[];
};

export type StockLocation = {
  id: string;
  name: string;
  type: string;
  isDefaultReceiving: boolean;
  isDefaultIssue: boolean;
  isActive: boolean;
};

export type Store = {
  id: string;
  companyId:string;
  branchId:string;
  name: string;
  storeType: string;
  defaultIssueStockLocationId?: string | null;
  isActive: boolean;
};

export type StoreLocationType =
  | "MainStore"
  | "MiniStore"
  | "Warehouse"
  | "Kitchen"
  | "Bar"
  | "Other";

export type CreateStoreRequest = {
  name: string;
  code?: string | null;
  locationType?: number; 
};


export type BranchRole = "BranchAdmin" | "Staff";

export type CreateBranchUserFormValue = {
  userName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: BranchRole;
};

export type CreateStockLocationPayload = {
  name: string;
  code: string;
  address?: string | null;
  locationType: number;
  isActive?: boolean | null;
};

export type CreateStockLocationResponse =
  | { id: string }
  | { Id: string }
  | { locationId: string }
  | { LocationId: string }
  | any;