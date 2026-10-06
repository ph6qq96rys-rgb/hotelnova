// src/modules/company/types/company.types.ts
// Single source of truth for all company module types.

export enum CompanyStatus {
  Draft     = 0,
  Active    = 1,
  Inactive  = 2,
  Suspended = 3,
}

export enum StockLocationType {
  Warehouse = 1,
  Kitchen   = 2,
  Bar       = 3,
  Transit   = 4,
  WIP       = 5,
  Store     = 6,
}

export type BranchRole = "BranchAdmin" | "Staff";

// Company

export interface CompanyDto {
  id:              string;
  legalName:       string | null;
  tradeName?:      string | null;
  tinNumber?:      string | null;
  vatNumber?:      string | null;
  phone?:          string | null;
  email?:          string | null;
  country?:        string | null;
  city?:           string | null;
  addressLine?:    string | null;
  defaultCurrency: string;
  timezone:        string;
  status:          CompanyStatus;
  createdAt?:      string | null;
}

export interface CompanyListResponse {
  items:    CompanyDto[];
  total:    number;
  page:     number;
  pageSize: number;
}

export interface CreateCompanyDto {
  legalName:       string | null;
  tradeName?:      string | null;
  tinNumber?:      string | null;
  vatNumber?:      string | null;
  phone?:          string | null;
  email?:          string | null;
  country?:        string | null;
  city?:           string | null;
  addressLine?:    string | null;
  defaultCurrency: string;
  timezone:        string;
}

export interface UpdateCompanyDto {
  legalName?:       string | null;
  tradeName?:       string | null;
  country?:         string | null;
  city?:            string | null;
  defaultCurrency?: string | null;
  status?:          CompanyStatus;
}

// Branch

export interface BranchDto {
  id:           string;
  name:         string;
  code:         string;
  region?:      string | null;
  city?:        string | null;
  addressLine?: string | null;
  isMain:       boolean;
  isActive:     boolean;
  hasSalesOperations: boolean;
}

export interface CreateBranchDto {
  code:         string;
  name:         string;
  region?:      string | null;
  city?:        string | null;
  addressLine?: string | null;
  isMain:       boolean;
  hasSalesOperations?: boolean;
}

// Store

export interface StoreDto {
  id:                           string;
  name:                         string;
  code?:                        string | null;
  branchId:                     string;
  defaultIssueStockLocationId?: string | null;
  isActive:                     boolean;
}

export interface CreateStoreDto {
  name:      string;
  code?:     string | null;
  locationType?: string | number | null;
  branchId?: string|null;
}

// Stock Location

export interface StockLocation {
  id:                 string;
  name:               string;
  code?:              string | null;
  type?:              StockLocationType | string | null;
  isActive:           boolean;
  isDefaultReceiving: boolean;
  isDefaultIssue:     boolean;
}

export interface CreateStockLocationDto {
  name:         string|null|undefined;
  code:         string|null|undefined;
  locationType: StockLocationType;
  isActive:    boolean;
  isDefault:    boolean;
  isDefaultReceiving:boolean;
  isDefaultIssue:boolean;
  canIssue:    boolean;
  canReceive:  boolean;
  canSell:     boolean;
  canProduce:  boolean;
}

// Settings

export interface CompanySettingsDto {
  serviceChargeRate?: number | null;
  contingencyRate?: number | null;
  vatEnabled: boolean;
  vatRate: number;
  pricesIncludeVat: boolean;
  /** VAT is also charged on the service charge. */
  vatOnServiceCharge?: boolean;
  /** Cash differences at drawer close beyond this amount need a supervisor's approval. */
  cashVarianceApprovalThreshold?: number;

  invoicePrefix: string;
  receiptPrefix: string;
  grnPrefix: string;
  sivPrefix: string;
  transferPrefix: string;
  adjustmentPrefix: string;
  productionPrefix: string;

  allowNegativeStock: boolean;
  requireApprovalForSiv: boolean;
  autoPostGrn: boolean;
  autoPostSiv: boolean;
  enforceIssueLocationMapping: boolean;
  costingMethod: "FIFO" | "WeightedAverage" | string;

  fiscalYearStartMonth: number;
  baseCurrency: string;

  defaultLanguage: string;
  attendanceEnabled: boolean;
  overtimeEnabled: boolean;

  telegramEnabled: boolean;
  telegramAttendanceEnabled: boolean;
  telegramStockRequestsEnabled: boolean;

  auditInventoryTransactions: boolean;
  auditFinancialTransactions: boolean;
}

// Users

export interface CreateCompanyAdminUserDto {
  userName:  string;
  email:     string;
  password:  string;
  branchId?: string | null;
  storeId?:  string | null;
}

export interface BranchUserDto {
  userId:     string;
  userName?:  string | null;
  email:      string;
  firstName?: string | null;
  lastName?:  string | null;
  fullName?:  string | null;
  role:       BranchRole;
  isActive?:  boolean;
}

export interface CreateBranchUserFormValue {
  userName:  string;
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
  role:      BranchRole;
}

// Wizard view-models

export type BranchVm = BranchDto;
export type StoreVm  = StoreDto;

// Legacy aliases
// Old files imported `Store` and `CreateStockLocationPayload` from `../types`.
// These aliases keep them compiling without changes.
export type Store = StoreDto;
export type CreateStockLocationPayload = CreateStockLocationDto;
export type OnboardingReadinessDto = {
  hasCompany?: boolean;
  hasBranch?: boolean;
  hasStockLocation?: boolean;
  hasStockLocations?: boolean;
  hasTransitLocation?: boolean;
  hasStore?: boolean;
  hasStores?: boolean;
  hasUser?: boolean;
  hasUserBranchAssignment?: boolean;
  hasUserStockLocationAssignment?: boolean;
  hasCompanyAdmin?: boolean;
  hasBranchAdmin?: boolean;
  storesMappedToIssueLocations?: boolean;
  canActivate?: boolean;
  canFinish?: boolean;
  missingItems?: string[];
};
