// src/modules/company/onboarding/CompanyOnboardingModule.tsx

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RefreshCcw } from "lucide-react";

import { useAppContext } from "../../../app/AppContext";
import { useAppScope } from "../../../app/useAppScope";
import type { BranchDto, CompanyDto } from "../types/company.types";

import { onboardingApi, type OnboardingSnapshotDto } from "./api/onboardingApi";
import { CompanyStep } from "./steps/CompanyStep";
import { BranchStep } from "./steps/BranchStep";
import { ReviewStep } from "./steps/ReviewStep";
import { StockLocationsStep } from "./steps/StockLocationsStep";
import { StoresStep } from "./steps/StoresStep";
import { UsersStep } from "./steps/UsersStep";

import { ONBOARDING_STEPS } from "./state/onboarding.constants";
import { createInitialOnboardingState } from "./state/onboarding.initial";
import { onboardingReducer } from "./state/onboarding.reducer";
import type { WizardStepKey } from "./state/onboarding.types";
import { extractApiError, upsertById } from "./utils/onboarding.utils";

import { Alert, WizardRail } from "./components/company.ui";
import "./company-onboarding.css";
import type {
  CompanySettingsDto,
} from "../types/company.types";
function idOf(value: unknown): string {
  return String((value as any)?.id ?? (value as any)?.Id ?? "").trim();
}

function companyIdOf(company: CompanyDto | null | undefined): string {
  return idOf(company);
}

function companyNameOf(company: CompanyDto | null | undefined): string | null {
  return company?.legalName ?? null;
}

function branchNameOf(branch: BranchDto | null | undefined): string | null {
  return branch?.name ?? null;
}

function branchLabel(branch: BranchDto | null | undefined): string {
  if (!branch) return "No branch selected";

  const code = (branch as any).code;
  return `${branch.name ?? "Branch"}${code ? ` (${code})` : ""}`;
}

function companyOnboardingPath(companyId?: string | null): string {
  return companyId ? `/companies/${companyId}/onboarding` : "/companies/onboarding";
}

function branchOnboardingPath(companyId: string, branchId: string): string {
  return `/companies/${companyId}/branches/${branchId}/onboarding`;
}

function companyDashboardPath(companyId: string): string {
  return `/companies/${companyId}/dashboard`;
}

function buildSnapshotPatch(
  snapshot: OnboardingSnapshotDto,
  companyId: string,
  requestedBranchId?: string | null
) {
  const branches = snapshot.branches ?? [];

  const activeBranchId =
    requestedBranchId ||
    idOf(snapshot.activeBranch) ||
    idOf(branches.find((branch) => (branch as any).isMain)) ||
    idOf(branches[0]) ||
    null;

  const activeBranch =
    snapshot.activeBranch ??
    branches.find((branch) => idOf(branch) === activeBranchId) ??
    branches.find((branch) => (branch as any).isMain) ??
    branches[0] ??
    null;

  return {
    companyId,
    company: snapshot.company,
    settings: snapshot.settings ?? undefined,

    branches,
    branchId: activeBranchId,
    branch: activeBranch,

    stockLocations: snapshot.stockLocations ?? [],
    stores: snapshot.stores ?? [],
    members: snapshot.users ?? [],

    readiness: snapshot.readiness ?? {},
  };
}

export default function CompanyOnboardingModule() {
  const navigate = useNavigate();
  const params = useParams<{ companyId?: string; branchId?: string }>();

  const app = useAppContext();
  const scope = useAppScope();

  const initialCompanyId =
    params.companyId ||
    scope.companyId ||
    app.companyId ||
    undefined;

  const [state, dispatch] = useReducer(
    onboardingReducer,
    createInitialOnboardingState(initialCompanyId, initialCompanyId)
  );

  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const activeIndex = Math.max(
    0,
    ONBOARDING_STEPS.findIndex((step) => step.key === state.active)
  );

  const activeBranch = useMemo((): BranchDto | null => {
    if (state.branch) return state.branch;
    if (!state.branchId) return null;

    return state.branches.find((branch) => idOf(branch) === state.branchId) ?? null;
  }, [state.branch, state.branchId, state.branches]);

  const readiness = useMemo(() => {
    const hasCompany = Boolean(state.companyId);
    const hasBranch = Boolean(state.branchId);
    const hasStockLocations = state.stockLocations.length > 0;
    const hasStores = state.stores.length > 0;
    const hasBranchAdmin = Boolean(state.readiness?.hasBranchAdmin);

    return {
      company: {
        done: hasCompany,
        locked: false,
      },
      branch: {
        done: hasBranch,
        locked: !hasCompany,
      },
      locations: {
        done: hasStockLocations,
        locked: !hasBranch,
      },
      stores: {
        done: hasStores,
        locked: !hasBranch,
      },
      users: {
        done: hasBranchAdmin,
        locked: !hasBranch,
      },
      review: {
        done: hasCompany && hasBranch && hasStockLocations && hasBranchAdmin,
        locked: !hasBranch,
      },
    };
  }, [
    state.companyId,
    state.branchId,
    state.stockLocations.length,
    state.stores.length,
    state.readiness?.hasBranchAdmin,
  ]);

  const syncAppScope = useCallback(
    (patch: ReturnType<typeof buildSnapshotPatch>) => {
      if (patch.companyId) {
        app.setCompany({
          id: patch.companyId,
          name: companyNameOf(patch.company),
        });
      }

      if (patch.branchId) {
        app.setBranch({
          id: patch.branchId,
          name: branchNameOf(patch.branch),
        });
      } else {
        app.setBranch(null);
      }
    },
    [app]
  );

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);

    try {
      const result = await onboardingApi.listCompanies();
      setCompanies(Array.isArray(result) ? result : []);
    } catch (err) {
      dispatch({
        type: "LOAD_ERROR",
        error: extractApiError(err, "Failed to load companies."),
      });
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  const reloadSnapshot = useCallback(
    async (
      requestedCompanyId: string | null = state.companyId,
      requestedBranchId: string | null = state.branchId
    ) => {
      if (!requestedCompanyId) return;

      dispatch({ type: "LOAD_START" });

      try {
        const snapshot = await onboardingApi.getSnapshot(
          requestedCompanyId,
          requestedBranchId
        );

        const patch = buildSnapshotPatch(
          snapshot,
          requestedCompanyId,
          requestedBranchId
        );

        syncAppScope(patch);

        dispatch({
          type: "LOAD_SUCCESS",
          patch,
        });
      } catch (err) {
        dispatch({
          type: "LOAD_ERROR",
          error: extractApiError(err, "Failed to load onboarding snapshot."),
        });
      }
    },
    [state.companyId, state.branchId, syncAppScope]
  );

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    const companyId =
      params.companyId ||
      state.companyId ||
      scope.companyId ||
      app.companyId;

    const branchId =
      params.branchId ||
      state.branchId ||
      scope.branchId ||
      app.branchId ||
      null;

    if (companyId) {
      void reloadSnapshot(companyId, branchId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goTo(step: WizardStepKey) {
    if (!readiness[step].locked) {
      dispatch({
        type: "SET_ACTIVE",
        step,
      });
    }
  }

  function next() {
    const candidate = ONBOARDING_STEPS[activeIndex + 1];

    if (candidate && !readiness[candidate.key].locked) {
      goTo(candidate.key);
    }
  }

  function back() {
    const candidate = ONBOARDING_STEPS[activeIndex - 1];

    if (candidate) {
      goTo(candidate.key);
    }
  }

  async function selectCompany(companyId: string) {
    if (!companyId) return;

    app.setCompany({ id: companyId });
    app.setBranch(null);

    await reloadSnapshot(companyId, null);

    dispatch({
      type: "SET_ACTIVE",
      step: "branch",
    });

    navigate(companyOnboardingPath(companyId), {
      replace: true,
    });
  }

  async function afterCompanyCreated(company: CompanyDto) {
    const companyId = companyIdOf(company);
    if (!companyId) return;

    app.setCompany({
      id: companyId,
      name: companyNameOf(company),
    });
    app.setBranch(null);

    setCompanies((previous) => [
      company,
      ...previous.filter((item) => companyIdOf(item) !== companyId),
    ]);

    await reloadSnapshot(companyId, null);

    dispatch({
      type: "SET_ACTIVE",
      step: "branch",
    });

    dispatch({
      type: "SAVE_SUCCESS",
      notice: "Company created. Now select or create a branch.",
    });

    navigate(companyOnboardingPath(companyId), {
      replace: true,
    });
  }

  async function onCompanySaved(
  settings: CompanySettingsDto
) {
    await loadCompanies();

    dispatch({
      type: "SAVE_SUCCESS",
      notice: "Company saved.",
      patch: {
        settings,
      },
    });

    await reloadSnapshot(state.companyId, state.branchId);
  }

  async function selectBranch(branchId: string) {
    if (!state.companyId || !branchId) return;

    const branch =
      state.branches.find((item) => idOf(item) === branchId) ?? null;

    app.setBranch({
      id: branchId,
      name: branchNameOf(branch),
    });

    await reloadSnapshot(state.companyId, branchId);

    dispatch({
      type: "SET_ACTIVE",
      step: "branch",
    });

    navigate(branchOnboardingPath(state.companyId, branchId), {
      replace: true,
    });
  }

  async function afterBranchCreated(branch: BranchDto) {
    const branchId = idOf(branch);
    if (!state.companyId || !branchId) return;

    app.setBranch({
      id: branchId,
      name: branchNameOf(branch),
    });

    dispatch({
      type: "LOAD_SUCCESS",
      patch: {
        branchId,
        branch,
        branches: upsertById(state.branches, branch),
        stockLocations: [],
        stores: [],
        members: [],
      },
    });

    await reloadSnapshot(state.companyId, branchId);

    dispatch({
      type: "SET_ACTIVE",
      step: "locations",
    });

    dispatch({
      type: "SAVE_SUCCESS",
      notice: "Branch created. Configure stock locations next.",
    });

    navigate(branchOnboardingPath(state.companyId, branchId), {
      replace: true,
    });
  }

  async function afterBranchUpdated(branch: BranchDto) {
    dispatch({
      type: "SAVE_SUCCESS",
      notice: "Branch updated.",
      patch: {
        branch,
        branches: upsertById(state.branches, branch),
      },
    });

    await reloadSnapshot(state.companyId, state.branchId);
  }

  async function refreshCurrentBranch() {
    await reloadSnapshot(state.companyId, state.branchId);
  }

  async function finish() {
    if (!state.companyId || !state.branchId) return;

    dispatch({
      type: "SAVE_START",
    });

    try {
      await onboardingApi.complete(state.companyId, state.branchId);

      dispatch({
        type: "SAVE_SUCCESS",
        notice: "Onboarding completed.",
      });

      navigate(companyDashboardPath(state.companyId), {
        replace: true,
      });
    } catch (err) {
      dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to complete onboarding."),
      });
    }
  }

  const progressPct = Math.round(
    ((activeIndex + 1) / ONBOARDING_STEPS.length) * 100
  );

  const dashboardHref = state.companyId
    ? companyDashboardPath(state.companyId)
    : "/platform/tenants";

  return (
    <div className="ob-page">
      <div className="ob-page-header">
        <div>
          <div className="ob-page-title">Company Onboarding</div>
          <div className="ob-page-subtitle">
            Configure company, branch, stock locations, stores, and users from
            one backend snapshot.
          </div>
        </div>

        <div className="ob-page-actions">
          <button
            type="button"
            className="ob-btn ob-btn--ghost"
            onClick={() => {
              void loadCompanies();
              void reloadSnapshot(state.companyId, state.branchId);
            }}
            disabled={companiesLoading || state.loading}
          >
            <RefreshCcw size={14} /> Refresh
          </button>

          <Link className="ob-btn ob-btn--ghost" to={dashboardHref}>
            Dashboard
          </Link>
        </div>
      </div>

      <div className="ob-progress">
        <div
          className="ob-progress-fill"
          style={{
            width: `${progressPct}%`,
          }}
        />
      </div>

      {state.error && (
        <Alert tone="danger" title="Action required" message={state.error} />
      )}

      {state.notice && (
        <Alert tone="ok" title="Saved" message={state.notice} />
      )}

      <div className="ob-layout">
        <WizardRail
          steps={ONBOARDING_STEPS}
          active={state.active}
          readiness={readiness}
          onSelect={goTo}
        />

        <div className="ob-card">
          <div className="ob-card-header">
            <div className="ob-card-title">
              {ONBOARDING_STEPS[activeIndex]?.title}
            </div>
            <div className="ob-card-subtitle">
              {ONBOARDING_STEPS[activeIndex]?.subtitle}
            </div>
          </div>

          <div className="ob-card-body">
            {state.active !== "company" && (
              <div className="ob-context-card">
                <div className="ob-context-main">
                  <div className="ob-context-label">Current branch</div>
                  <div className="ob-context-title">
                    {branchLabel(activeBranch)}
                  </div>
                </div>

                <select
                  className="ob-context-select"
                  value={state.branchId ?? ""}
                  onChange={(event) => {
                    if (event.target.value) {
                      void selectBranch(event.target.value);
                    }
                  }}
                  disabled={
                    !state.companyId ||
                    state.branches.length === 0 ||
                    state.loading
                  }
                  aria-label="Switch branch"
                >
                  <option value="">Select branch…</option>

                  {state.branches.map((branch) => {
                    const branchId = idOf(branch);
                    const code = (branch as any).code;

                    return (
                      <option key={branchId} value={branchId}>
                        {branch.name}
                        {code ? ` (${code})` : ""}
                      </option>
                    );
                  })}
                </select>

                <div className="ob-context-counts">
                  <span>
                    {state.branches.length} branch
                    {state.branches.length !== 1 ? "es" : ""}
                  </span>
                  <span>
                    {state.stockLocations.length} location
                    {state.stockLocations.length !== 1 ? "s" : ""}
                  </span>
                  <span>
                    {state.stores.length} store
                    {state.stores.length !== 1 ? "s" : ""}
                  </span>
                  <span>
                    {state.members.length} user
                    {state.members.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}

            {state.active === "company" && (
              <CompanyStep
                companies={companies}
                existing={state.company}
                defaultSettings={state.settings}
                saving={state.saving || companiesLoading}
                onSelected={selectCompany}
                onCreated={afterCompanyCreated}
                onSaved={onCompanySaved}
                dispatch={dispatch}
              />
            )}

            {state.active === "branch" && (
              <BranchStep
                companyId={state.companyId}
                activeBranchId={state.branchId}
                saving={state.saving}
                onCreated={afterBranchCreated}
                onSelected={selectBranch}
                onUpdated={afterBranchUpdated}
                dispatch={dispatch}
              />
            )}

            {state.active === "locations" &&
              (!state.companyId || !state.branchId) && (
                <Alert
                  tone="danger"
                  title="Branch required"
                  message="Select or create a branch before configuring stock locations."
                />
              )}

            {state.active === "locations" &&
              state.companyId &&
              state.branchId && (
                <StockLocationsStep
                  companyId={state.companyId}
                  branchId={state.branchId}
                  branchName={activeBranch?.name ?? branchLabel(activeBranch)}
                  saving={state.saving}
                  dispatch={dispatch}
                  onChanged={refreshCurrentBranch}
                />
              )}

            {state.active === "stores" &&
              (!state.companyId || !state.branchId) && (
                <Alert
                  tone="danger"
                  title="Branch required"
                  message="Select or create a branch before configuring stores."
                />
              )}

            {state.active === "stores" &&
              state.companyId &&
              state.branchId && (
                <StoresStep
                  companyId={state.companyId}
                  branchId={state.branchId}
                  branchName={branchLabel(activeBranch)}
                  saving={state.saving}
                  dispatch={dispatch}
                  onChanged={refreshCurrentBranch}
                />
              )}

            {state.active === "users" &&
              (!state.companyId || !state.branchId) && (
                <Alert
                  tone="danger"
                  title="Branch required"
                  message="Select or create a branch before configuring users."
                />
              )}

            {state.active === "users" &&
              state.companyId &&
              state.branchId && (
                <UsersStep
                  companyId={state.companyId}
                  branchId={state.branchId}
                  branchName={branchLabel(activeBranch)}
                  saving={state.saving}
                  dispatch={dispatch}
                  onChanged={refreshCurrentBranch}
                />
              )}

            {state.active === "review" && (
              <ReviewStep
                state={state}
                readiness={readiness}
                onFinish={finish}
              />
            )}
          </div>

          <div className="ob-card-footer">
            <button
              type="button"
              className="ob-btn ob-btn--ghost"
              onClick={back}
              disabled={activeIndex <= 0}
            >
              ← Back
            </button>

            <span className="ob-wizard-step-lbl">
              Step {activeIndex + 1} of {ONBOARDING_STEPS.length}
            </span>

            {state.active === "review" ? (
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                onClick={() => void finish()}
                disabled={!readiness.review.done || state.saving}
              >
                {state.saving ? "Finishing…" : "Finish setup"}
              </button>
            ) : (
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                onClick={next}
                disabled={activeIndex >= ONBOARDING_STEPS.length - 1}
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}