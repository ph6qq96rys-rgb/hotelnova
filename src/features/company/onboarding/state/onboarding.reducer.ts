// src/modules/company/onboarding/state/onboarding.reducer.ts

import type { OnboardingAction, OnboardingState } from "./onboarding.types";

export function onboardingReducer(
  state:  OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {

    // ── Navigation ──────────────────────────────────────────────────────────
    // SET_ACTIVE is the ONLY action that may change state.active.
    // LOAD_SUCCESS and SAVE_SUCCESS explicitly omit "active" from their patch
    // types to make accidental navigation impossible at the type level.

    case "SET_ACTIVE":
      return { ...state, active: action.step, error: null, notice: null };

    case "SET_CONTEXT":
      return {
        ...state,
        companyId: action.companyId === undefined ? state.companyId : action.companyId,
        branchId:  action.branchId  === undefined ? state.branchId  : action.branchId,
      };

    // ── Loading ─────────────────────────────────────────────────────────────

    case "LOAD_START":
      return { ...state, loading: true, error: null };

    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.error };

    case "LOAD_SUCCESS":
      // Defensive: drop any null/undefined values from the patch so that a
      // partially-failed fetch doesn't wipe out already-loaded good data.
      // e.g. if getBranch fails but listBranches succeeded, keep the list.
      return {
        ...state,
        loading: false,
        error:   null,
        ...omitNullish(action.patch),
      };

    // ── Saving ──────────────────────────────────────────────────────────────

    case "SAVE_START":
      return { ...state, saving: true, error: null, notice: null };

    case "SAVE_ERROR":
      return { ...state, saving: false, error: action.error };

    case "SAVE_SUCCESS":
      return {
        ...state,
        saving: false,
        error:  null,
        notice: action.notice ?? null,
        ...(action.patch ? omitNullish(action.patch) : {}),
      };

    // ── Utilities ────────────────────────────────────────────────────────────

    case "CLEAR_MESSAGES":
      return { ...state, error: null, notice: null };

    default:
      return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a copy of obj with all `undefined` values removed.
 * `null` is kept because null is intentional ("clear this field"),
 * while `undefined` usually means "fetch failed, don't overwrite".
 */
function omitNullish<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}