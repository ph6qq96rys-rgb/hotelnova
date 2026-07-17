// src/modules/company/onboarding/CompanyOnboardingModule.tsx

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RefreshCcw, ShieldAlert } from "lucide-react";

import { useAppContext } from "../../../app/AppContext";
import { useAppScope } from "../../../app/useAppScope";
import type {
  BranchDto,
  CompanyDto,
  CompanySettingsDto,
} from "../types/company.types";

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

type RoleName = string;

type OnboardingReadiness = Record<
  WizardStepKey,
  {
    done: boolean;
    locked: boolean;
  }
>;

type CompanyStepAccess = {
  canCreateCompany: boolean;
  canSwitchCompany: boolean;
  canEditCompanyProfile: boolean;
  canEditCompanySettings: boolean;
};

type BranchStepAccess = {
  canCreateBranch: boolean;
  canEditBranch: boolean;
  canDeleteBranch: boolean;
  canViewAllBranches: boolean;
  assignedBranchIds: string[];
};

function idOf(value: unknown): string {
  const item = value as any;

  return String(
    item?.id ??
      item?.companyId ??
      item?.branchId ??
      item?.Id ??
      item?.CompanyId ??
      item?.BranchId ??
      "",
  ).trim();
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

function readJwtPayload(token: string | null): any | null {
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(normalized));
  } catch {
    return null;
  }
}

function getStoredToken(app: any): string | null {
  return (
    app?.token ??
    app?.accessToken ??
    app?.auth?.token ??
    app?.auth?.accessToken ??
    localStorage.getItem("accessToken") ??
    localStorage.getItem("token") ??
    localStorage.getItem("jwt")
  );
}

function collectRoleValues(target: string[], value: unknown): void {
  if (!value) return;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      collectRoleValues(target, parsed);
    } catch {
      target.push(value);
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((x) => collectRoleValues(target, x));
    return;
  }

  if (typeof value === "object") {
    const x = value as any;

    collectRoleValues(
      target,
      x.name ??
        x.roleName ??
        x.role ??
        x.value ??
        x.key ??
        x.normalizedName ??
        x.type,
    );
  }
}

function getCurrentRoles(app: any, scope: any): RoleName[] {
  const roles: string[] = [];
  const token = getStoredToken(app);
  const claims = readJwtPayload(token);

  [
    app?.role,
    app?.roleName,
    app?.roles,
    app?.userRoles,
    app?.user?.role,
    app?.user?.roleName,
    app?.user?.roles,
    app?.currentUser?.role,
    app?.currentUser?.roleName,
    app?.currentUser?.roles,
    app?.auth?.role,
    app?.auth?.roleName,
    app?.auth?.roles,
    app?.authUser?.role,
    app?.authUser?.roleName,
    app?.authUser?.roles,
    scope?.role,
    scope?.roleName,
    scope?.roles,
    scope?.user?.role,
    scope?.user?.roleName,
    scope?.user?.roles,
    claims?.role,
    claims?.roles,
    claims?.Role,
    claims?.Roles,
    claims?.[
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
    ],
    localStorage.getItem("roles"),
    localStorage.getItem("userRoles"),
  ].forEach((source) => collectRoleValues(roles, source));

  return Array.from(new Set(roles.map((x) => x.trim()).filter(Boolean)));
}

function getCurrentCompanyId(app: any, scope: any, paramsCompanyId?: string): string {
  const token = getStoredToken(app);
  const claims = readJwtPayload(token);

  return String(
    paramsCompanyId ??
      scope?.companyId ??
      scope?.company?.id ??
      app?.companyId ??
      app?.activeCompanyId ??
      app?.company?.id ??
      app?.activeCompany?.id ??
      app?.user?.companyId ??
      app?.currentUser?.companyId ??
      app?.authUser?.companyId ??
      claims?.companyId ??
      claims?.CompanyId ??
      claims?.company_id ??
      claims?.tenant_company_id ??
      "",
  ).trim();
}

function getCurrentBranchId(app: any, scope: any, paramsBranchId?: string): string | null {
  const token = getStoredToken(app);
  const claims = readJwtPayload(token);

  const value = String(
    paramsBranchId ??
      scope?.branchId ??
      scope?.branch?.id ??
      app?.branchId ??
      app?.activeBranchId ??
      app?.branch?.id ??
      app?.activeBranch?.id ??
      claims?.branchId ??
      claims?.BranchId ??
      claims?.branch_id ??
      "",
  ).trim();

  return value || null;
}

function collectBranchIds(...sources: unknown[]): string[] {
  const values: string[] = [];

  for (const source of sources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      for (const item of source) {
        if (typeof item === "string") {
          values.push(item);
          continue;
        }

        if (item && typeof item === "object") {
          const x = item as any;
          values.push(
            String(x.id ?? x.branchId ?? x.BranchId ?? x.value ?? x.key ?? ""),
          );
        }
      }

      continue;
    }

    if (typeof source === "string") {
      values.push(source);
    }
  }

  return Array.from(new Set(values.map((x) => x.trim()).filter(Boolean)));
}

function getAssignedBranchIds(app: any, scope: any): string[] {
  return collectBranchIds(
    app?.assignedBranchIds,
    app?.branchIds,
    app?.user?.assignedBranchIds,
    app?.user?.branchIds,
    app?.user?.branches,
    app?.currentUser?.assignedBranchIds,
    app?.currentUser?.branchIds,
    app?.currentUser?.branches,
    app?.auth?.assignedBranchIds,
    app?.authUser?.assignedBranchIds,
    scope?.assignedBranchIds,
    scope?.branchIds,
    scope?.branches,
    scope?.user?.assignedBranchIds,
    scope?.user?.branchIds,
    scope?.user?.branches,
    app?.branchId,
    scope?.branchId,
  );
}

function hasRole(roles: RoleName[], role: string): boolean {
  const expected = normalizeKey(role);
  return roles.some((x) => normalizeKey(x) === expected);
}

function companyIdOf(company: CompanyDto | null | undefined): string {
  return idOf(company);
}

function companyNameOf(company: CompanyDto | null | undefined): string | null {
  return company?.legalName ?? (company as any)?.name ?? null;
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
  return companyId
    ? `/companies/${companyId}/onboarding`
    : "/companies/onboarding";
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
  requestedBranchId?: string | null,
) {
  const branches = snapshot.branches ?? [];

  const requestedBranch = requestedBranchId
    ? branches.find((branch) => idOf(branch) === requestedBranchId)
    : null;

  const activeBranch =
    requestedBranch ??
    snapshot.activeBranch ??
    branches.find((branch) => (branch as any).isMain) ??
    branches[0] ??
    null;

  const activeBranchId = idOf(activeBranch) || null;

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

function AccessDeniedCard() {
  return (
    <div className="ob-page">
      <div className="ob-card" style={{ maxWidth: 760, margin: "48px auto" }}>
        <div className="ob-card-header">
          <div
            className="ob-card-title"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <ShieldAlert size={20} /> Access denied
          </div>
          <div className="ob-card-subtitle">
            Company onboarding is restricted to Company Administrators and
            platform System Administrators.
          </div>
        </div>

        <div className="ob-card-body">
          <Alert
            tone="danger"
            title="Organization setup is admin-only"
            message="Your current role can operate inside assigned branches, but it cannot create companies, create branches, switch companies, or run the onboarding wizard."
          />

          <div style={{ marginTop: 16 }}>
            <Link className="ob-btn ob-btn--ghost" to="/">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanyOnboardingModule() {
  const navigate = useNavigate();
  const params = useParams<{ companyId?: string; branchId?: string }>();

  const app = useAppContext() as any;
  const scope = useAppScope() as any;

  const roles = useMemo(() => getCurrentRoles(app, scope), [app, scope]);
  const assignedBranchIds = useMemo(
    () => getAssignedBranchIds(app, scope),
    [app, scope],
  );

  const isSystemAdmin = hasRole(roles, "SystemAdmin");
  const isCompanyAdmin = hasRole(roles, "CompanyAdmin");
  const isBranchAdmin = hasRole(roles, "BranchAdmin");

  const canManageOrganization = isSystemAdmin || isCompanyAdmin;

  const initialCompanyId =
    getCurrentCompanyId(app, scope, params.companyId) || undefined;

  const initialBranchId = getCurrentBranchId(app, scope, params.branchId);

  const companyAccess: CompanyStepAccess = useMemo(
    () => ({
      canCreateCompany: isSystemAdmin,
      canSwitchCompany: isSystemAdmin,
      canEditCompanyProfile: isSystemAdmin || isCompanyAdmin,
      canEditCompanySettings: isSystemAdmin || isCompanyAdmin,
    }),
    [isSystemAdmin, isCompanyAdmin],
  );

  const branchAccess: BranchStepAccess = useMemo(
    () => ({
      canCreateBranch: isCompanyAdmin,
      canEditBranch: isCompanyAdmin || isBranchAdmin,
      canDeleteBranch: isCompanyAdmin,
      canViewAllBranches: isSystemAdmin || isCompanyAdmin,
      assignedBranchIds,
    }),
    [assignedBranchIds, isBranchAdmin, isCompanyAdmin, isSystemAdmin],
  );

  const canSwitchBranch =
    branchAccess.canViewAllBranches || assignedBranchIds.length > 0;

  const [state, dispatch] = useReducer(
    onboardingReducer,
    createInitialOnboardingState(initialCompanyId, initialCompanyId),
  );

  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const activeIndex = Math.max(
    0,
    ONBOARDING_STEPS.findIndex((step) => step.key === state.active),
  );

  const activeBranch = useMemo((): BranchDto | null => {
    if (state.branch) return state.branch;
    if (!state.branchId) return null;

    return (
      state.branches.find((branch) => idOf(branch) === state.branchId) ?? null
    );
  }, [state.branch, state.branchId, state.branches]);

  const readiness: OnboardingReadiness = useMemo(() => {
    const hasCompany = Boolean(state.companyId);
    const hasBranch = Boolean(state.branchId);
    const hasStockLocations = state.stockLocations.length > 0;
    const hasStores = state.stores.length > 0;
    const hasBranchAdmin = Boolean(state.readiness?.hasBranchAdmin);

    return {
      company: {
        done: hasCompany,
        locked: !canManageOrganization,
      },
      branch: {
        done: hasBranch,
        locked: !canManageOrganization || !hasCompany,
      },
      locations: {
        done: hasStockLocations,
        locked: !canManageOrganization || !hasBranch,
      },
      stores: {
        done: hasStores,
        locked: !canManageOrganization || !hasBranch,
      },
      users: {
        done: hasBranchAdmin,
        locked: !canManageOrganization || !hasBranch,
      },
      review: {
        done: hasCompany && hasBranch && hasStockLocations && hasBranchAdmin,
        locked: !canManageOrganization || !hasBranch,
      },
    };
  }, [
    canManageOrganization,
    state.companyId,
    state.branchId,
    state.stockLocations.length,
    state.stores.length,
    state.readiness?.hasBranchAdmin,
  ]);

  const syncAppScope = useCallback(
    (patch: ReturnType<typeof buildSnapshotPatch>) => {
      if (patch.companyId) {
        app.setCompany?.({
          id: patch.companyId,
          name: companyNameOf(patch.company),
        });
      }

      if (patch.branchId) {
        app.setBranch?.({
          id: patch.branchId,
          name: branchNameOf(patch.branch),
        });
      } else {
        app.setBranch?.(null);
      }
    },
    [app],
  );

  const loadCompanies = useCallback(async () => {
    if (!canManageOrganization) return;

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
  }, [canManageOrganization]);

  const reloadSnapshot = useCallback(
    async (
      requestedCompanyId: string | null = state.companyId,
      requestedBranchId: string | null = state.branchId,
    ) => {
      if (!canManageOrganization || !requestedCompanyId) return;

      dispatch({ type: "LOAD_START" });

      try {
        const snapshot = await onboardingApi.getSnapshot(
          requestedCompanyId,
          requestedBranchId,
        );

        const patch = buildSnapshotPatch(
          snapshot,
          requestedCompanyId,
          requestedBranchId,
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
    [canManageOrganization, state.companyId, state.branchId, syncAppScope],
  );

  useEffect(() => {
    if (!canManageOrganization) {
      console.warn("Company onboarding denied", {
        roles,
        normalizedRoles: roles.map(normalizeKey),
      });
    }
  }, [canManageOrganization, roles]);

  useEffect(() => {
    if (!canManageOrganization) return;
    void loadCompanies();
  }, [canManageOrganization, loadCompanies]);

  useEffect(() => {
    if (!canManageOrganization) return;

    const companyId =
      params.companyId ||
      state.companyId ||
      getCurrentCompanyId(app, scope) ||
      null;

    const branchId =
      params.branchId ||
      state.branchId ||
      getCurrentBranchId(app, scope) ||
      initialBranchId ||
      null;

    if (companyId) {
      void reloadSnapshot(companyId, branchId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageOrganization]);

  function goTo(step: WizardStepKey) {
    if (!canManageOrganization) return;
    if (readiness[step].locked) return;

    dispatch({
      type: "SET_ACTIVE",
      step,
    });
  }

  function next() {
    if (!canManageOrganization) return;

    const candidate = ONBOARDING_STEPS[activeIndex + 1];
    if (candidate && !readiness[candidate.key].locked) {
      goTo(candidate.key);
    }
  }

  function back() {
    if (!canManageOrganization) return;

    const candidate = ONBOARDING_STEPS[activeIndex - 1];
    if (candidate) {
      goTo(candidate.key);
    }
  }

  async function selectCompany(companyId: string) {
    if (!companyAccess.canSwitchCompany || !companyId) return;

    app.setCompany?.({ id: companyId });
    app.setBranch?.(null);

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
    if (!companyAccess.canCreateCompany) return;

    const companyId = companyIdOf(company);
    if (!companyId) return;

    app.setCompany?.({
      id: companyId,
      name: companyNameOf(company),
    });
    app.setBranch?.(null);

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

  async function onCompanySaved(settings: CompanySettingsDto) {
    if (
      !companyAccess.canEditCompanyProfile &&
      !companyAccess.canEditCompanySettings
    ) {
      return;
    }

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

  function canAccessBranch(branchId: string): boolean {
    if (!branchId) return false;
    if (branchAccess.canViewAllBranches) return true;

    const normalized = normalizeKey(branchId);
    return assignedBranchIds.some((id) => normalizeKey(id) === normalized);
  }

  async function selectBranch(branchId: string) {
    if (!canSwitchBranch || !state.companyId || !branchId) return;
    if (!canAccessBranch(branchId)) return;

    const branch =
      state.branches.find((item) => idOf(item) === branchId) ?? null;

    if (!branch) return;

    app.setBranch?.({
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
    if (!branchAccess.canCreateBranch) return;

    const branchId = idOf(branch);
    if (!state.companyId || !branchId) return;

    app.setBranch?.({
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
    if (!branchAccess.canEditBranch) return;

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
    if (!canManageOrganization) return;
    await reloadSnapshot(state.companyId, state.branchId);
  }

  async function finish() {
    if (!canManageOrganization || !state.companyId || !state.branchId) return;

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

  if (!canManageOrganization) {
    return <AccessDeniedCard />;
  }

  const progressPct = Math.round(
    ((activeIndex + 1) / ONBOARDING_STEPS.length) * 100,
  );

  const dashboardHref = state.companyId
    ? companyDashboardPath(state.companyId)
    : isSystemAdmin
      ? "/platform/tenants"
      : "/";

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

      {state.notice && <Alert tone="ok" title="Saved" message={state.notice} />}

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
                    !canSwitchBranch ||
                    !state.companyId ||
                    state.branches.length === 0 ||
                    state.loading
                  }
                  aria-label="Switch branch"
                >
                  <option value="">Select branch…</option>

                  {state.branches
                    .filter((branch) => canAccessBranch(idOf(branch)))
                    .map((branch) => {
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
                    {
                      state.branches.filter((branch) =>
                        canAccessBranch(idOf(branch)),
                      ).length
                    } branch
                    {state.branches.filter((branch) =>
                      canAccessBranch(idOf(branch)),
                    ).length !== 1
                      ? "es"
                      : ""}
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
                access={companyAccess}
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
                access={branchAccess}
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

            {state.active === "stores" && state.companyId && state.branchId && (
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

            {state.active === "users" && state.companyId && state.branchId && (
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