// src/modules/company/onboarding/state/onboarding.initial.ts

import { DEFAULT_SETTINGS } from "./onboarding.constants";
import type { OnboardingState, WizardStepKey } from "./onboarding.types";

/**
 * Derives the starting wizard step from the URL companyId only.
 *
 * branchId is intentionally excluded — branch data is never pre-loaded on
 * mount. It is set only when the user explicitly selects or creates a branch
 * inside the wizard. Pre-seeding branchId from the URL or AppContext was the
 * root cause of "Branch X not found in company Y" errors whenever a stale
 * branchId from a previous session was sent against a different company.
 *
 *   no companyId → "company"  (fresh onboarding, pick / create a company)
 *   companyId    → "branch"   (company known, pick / create a branch)
 */
function deriveInitialStep(
  companyId: string | null | undefined,
): WizardStepKey {
  return companyId ? "branch" : "company";
}

export function createInitialOnboardingState(
  paramsCompanyId?: string,
  ctxCompanyId?:    string | null,
): OnboardingState {
  const companyId = paramsCompanyId ?? ctxCompanyId ?? null;

  return {
    active:         deriveInitialStep(companyId),
    companyId,
    branchId:       null,   // always null — set only by explicit user action
    company:        null,
    branches:       [],
    branch:         null,
    settings:       DEFAULT_SETTINGS,
    stockLocations: [],
    stores:         [],
    members:        [],
    loading:        false,
    saving:         false,
    error:          null,
    notice:         null,
  };
}