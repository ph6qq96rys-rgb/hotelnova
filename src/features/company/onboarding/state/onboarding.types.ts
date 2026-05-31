// src/modules/company/onboarding/state/onboarding.types.ts

import type React from "react";
import type {
  BranchDto,
  BranchRole,
  BranchUserDto,
  CompanyDto,
  CompanySettingsDto,
  StockLocation,
  StoreDto,
} from "../../types/company.types";

// ── Primitive helpers ─────────────────────────────────────────────────────────

export type Nullable<T> = T | null | undefined;

// ── Wizard step keys ──────────────────────────────────────────────────────────

export type WizardStepKey =
  | "company"
  | "branch"
  | "locations"
  | "stores"
  | "users"
  | "review";

export type StepDefinition = {
  key:      WizardStepKey;
  title:    string;
  subtitle: string;
  icon:     React.ComponentType<{ className?: string; size?: number }>;
  required: boolean;
};

// ── Domain value types ────────────────────────────────────────────────────────

export type StoreType = "DineIn" | "Takeaway" | "Delivery" | "Bar" | "Retail";

/** "FIFO" | "WeightedAverage" — must match backend CostingMethod enum */
export type CostingMethod = "FIFO" | "WeightedAverage";

/** Keyed by field name; value is the error message. */
export type FieldErrors = Record<string, string | undefined>;

// ── Onboarding state ──────────────────────────────────────────────────────────

export type OnboardingState = {
  /** Active wizard step key. Changed only via SET_ACTIVE. */
  active:         WizardStepKey;

  companyId:      string | null;
  branchId:       string | null;

  company:        CompanyDto | null;
  /** All branches for the company — used by BranchStep to list selectable rows. */
  branches:       BranchDto[];
  /** The active/selected branch full record. */
  branch:         BranchDto | null;

  settings:       CompanySettingsDto;

  /** Stock locations for the active branch. */
  stockLocations: StockLocation[];
  /** Stores for the active branch. */
  stores:         StoreDto[];
  /** Branch users for the active branch. */
  members:        BranchUserDto[];

  loading:        boolean;
  saving:         boolean;
  error:          string | null;
  notice:         string | null;
};

// ── Readiness ─────────────────────────────────────────────────────────────────

export type StepReadiness = {
  /** Step has the minimum required data to be considered complete. */
  done:   boolean;
  /** Step cannot be navigated to until prerequisites are met. */
  locked: boolean;
};

export type OnboardingReadiness = Record<WizardStepKey, StepReadiness>;

// ── Actions ───────────────────────────────────────────────────────────────────
//
// Navigation rule: only SET_ACTIVE may change state.active.
// LOAD_SUCCESS and SAVE_SUCCESS must NOT include active in their patch types
// to prevent accidental step-navigation side effects from data operations.

/** Data that a LOAD_SUCCESS may update — explicitly excludes active step. */
export type LoadPatch = Omit<Partial<OnboardingState>, "active" | "loading" | "saving" | "error" | "notice">;

/** Data that a SAVE_SUCCESS may update — explicitly excludes active step. */
export type SavePatch = Omit<Partial<OnboardingState>, "active" | "loading" | "saving" | "error" | "notice">;

export type OnboardingAction =
  | { type: "SET_ACTIVE";    step: WizardStepKey }
  | { type: "SET_CONTEXT";   companyId?: string | null; branchId?: string | null }
  | { type: "LOAD_START" }
  | { type: "LOAD_ERROR";    error: string }
  | { type: "LOAD_SUCCESS";  patch: LoadPatch }
  | { type: "SAVE_START" }
  | { type: "SAVE_ERROR";    error: string }
  | { type: "SAVE_SUCCESS";  notice?: string; patch?: SavePatch }
  | { type: "CLEAR_MESSAGES" };