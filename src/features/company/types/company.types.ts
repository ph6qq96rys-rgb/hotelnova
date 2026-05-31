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

// ── Company ───────────────────────────────────────────────────────────────────

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

// ── Branch ────────────────────────────────────────────────────────────────────

export interface BranchDto {
  id:           string;
  name:         string;
  code:         string;
  region?:      string | null;
  city?:        string | null;
  addressLine?: string | null;
  isMain:       boolean;
  isActive:     boolean;
}

export interface CreateBranchDto {
  code:         string;
  name:         string;
  region?:      string | null;
  city?:        string | null;
  addressLine?: string | null;
  isMain:       boolean;
}

// ── Store ─────────────────────────────────────────────────────────────────────

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

// ── Stock Location ────────────────────────────────────────────────────────────

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
  name:         string;
  code:         string;
  locationType: StockLocationType;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface CompanySettingsDto {
  vatEnabled:           boolean;
  vatRate:              number;
  pricesIncludeVat:     boolean;
  invoicePrefix:        string;
  receiptPrefix:        string;
  allowNegativeStock:   boolean;
  fiscalYearStartMonth: number;
}

// ── Users ─────────────────────────────────────────────────────────────────────

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

// ── Wizard view-models ────────────────────────────────────────────────────────

export type BranchVm = BranchDto;
export type StoreVm  = StoreDto;

// ── Legacy aliases ────────────────────────────────────────────────────────────
// Old files imported `Store` and `CreateStockLocationPayload` from `../types`.
// These aliases keep them compiling without changes.
export type Store = StoreDto;
export type CreateStockLocationPayload = CreateStockLocationDto;