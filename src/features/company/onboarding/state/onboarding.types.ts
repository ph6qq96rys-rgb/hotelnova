// src/modules/company/onboarding/state/onboarding.types.ts

import type React from "react";
import type {
  BranchDto,
  CompanyDto,
  CompanySettingsDto,
  OnboardingReadinessDto,
  StockLocation,
  StoreDto,
} from "../../types/company.types";

export type Nullable<T> = T | null | undefined;

export type WizardStepKey =
  | "company"
  | "branch"
  | "locations"
  | "stores"
  | "users"
  | "review";

export type StepDefinition = {
  key: WizardStepKey;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  required: boolean;
};

export type StoreType =
  | "DineIn"
  | "Takeaway"
  | "Delivery"
  | "Bar"
  | "Retail";

export type CostingMethod = "FIFO" | "WeightedAverage";

export type FieldErrors = Record<string, string | undefined>;

export type StepReadiness = {
  done: boolean;
  locked: boolean;
};

export type OnboardingReadiness = Record<WizardStepKey, StepReadiness>;

export interface EmployeeLookupDto {
  id: string;
  employeeCode?: string | null;
  fullName?: string | null;
  workEmail?: string | null;
  phoneNumber?: string | null;
  branchId?: string | null;
}

export interface CompanyUserDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  email: string;
  userName: string;
  phoneNumber?: string | null;
  companyId: string;
  defaultBranchId?: string | null;
  defaultStockLocationId?: string | null;
  roles: string[];
  isActive: boolean;
}

export interface CreateCompanyUserDto {
  employeeId: string;
  email: string | null;
  userName: string;
  password: string;
  phoneNumber?: string | null;
  roles: string[];
  branchIds: string[];
  stockLocationIds: string[];
}

export interface UpdateCompanyUserDto {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface AssignUserBranchesDto {
  branchIds: string[];
}

export interface AssignUserStockLocationsDto {
  stockLocationIds: string[];
}

export interface SetUserActiveStatusRequest {
  isActive: boolean;
}

export interface ResetUserPasswordRequest {
  newPassword: string;
}

export type OnboardingState = {
  active: WizardStepKey;

  companyId: string | null;
  branchId: string | null;

  company: CompanyDto | null;
  branches: BranchDto[];
  branch: BranchDto | null;

  settings: CompanySettingsDto;

  stockLocations: StockLocation[];
  stores: StoreDto[];
  members: CompanyUserDto[];

  readiness?: OnboardingReadinessDto;

  loading: boolean;
  saving: boolean;
  error: string | null;
  notice: string | null;
};

export type LoadPatch = Omit<
  Partial<OnboardingState>,
  "active" | "loading" | "saving" | "error" | "notice"
>;

export type SavePatch = Omit<
  Partial<OnboardingState>,
  "active" | "loading" | "saving" | "error" | "notice"
>;

export interface OnboardingSnapshotDto {
  company: CompanyDto | null;
  settings: CompanySettingsDto | null;
  branches: BranchDto[];
  activeBranch: BranchDto | null;
  stockLocations: StockLocation[];
  stores: StoreDto[];
  users: CompanyUserDto[];
  readiness: OnboardingReadinessDto;
}

export type OnboardingAction =
  | { type: "SET_ACTIVE"; step: WizardStepKey }
  | { type: "SET_CONTEXT"; companyId?: string | null; branchId?: string | null }
  | { type: "LOAD_START" }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "LOAD_SUCCESS"; patch: LoadPatch }
  | { type: "SAVE_START" }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "SAVE_SUCCESS"; notice?: string; patch?: SavePatch }
  | { type: "CLEAR_MESSAGES" };