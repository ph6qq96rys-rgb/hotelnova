// src/modules/company/onboarding/CompanyOnboardingModule.tsx
//
// Workflow:
//   1. Mount → load ALL companies for the selector list
//   2. Select company → reload(companyId, null) — never sends a stale branchId
//   3. Select / create branch → reload(companyId, branchId) — explicit, not from closure
//   4. Configure locations, stores, users per branch
//   5. Review → Finish
//
// Key design decision:
//   reload() accepts explicit (companyId, branchId) parameters so the caller
//   controls exactly what is sent to the backend. This eliminates the closure-
//   staleness problem where useCallback captures an old branchId and fires a
//   branch-scoped request against the wrong company.

import {
  useCallback, useEffect, useMemo,
  useReducer, useRef, useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RefreshCcw } from "lucide-react";

import { useAppContext } from "../../../app/AppContext";
import { useAppScope }   from "../../../app/useAppScope";

import type { BranchDto, CompanyDto } from "../types/company.types";

import { onboardingApi }      from "./api/onboardingApi";
import { CompanyStep }        from "./steps/CompanyStep";
import { BranchStep }         from "./steps/BranchStep";
import { ReviewStep }         from "./steps/ReviewStep";
import { StockLocationsStep } from "./steps/StockLocationsStep";
import { StoresStep }         from "./steps/StoresStep";
import { UsersStep }          from "./steps/UsersStep";

import { ONBOARDING_STEPS }             from "./state/onboarding.constants";
import { createInitialOnboardingState } from "./state/onboarding.initial";
import { onboardingReducer }            from "./state/onboarding.reducer";
import type { WizardStepKey }           from "./state/onboarding.types";
import { extractApiError, upsertById }  from "./utils/onboarding.utils";

import { Alert, WizardRail } from "./components/company.ui";
import "./company-onboarding.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function branchLabel(b: BranchDto | null | undefined): string {
  if (!b) return "No branch selected";
  return `${b.name ?? "Branch"}${b.code ? ` (${b.code})` : ""}`;
}

function companyId(c: CompanyDto | null | undefined): string {
  return String((c as any)?.id ?? "");
}

// ── Module ────────────────────────────────────────────────────────────────────

export default function CompanyOnboardingModule() {
  const nav    = useNavigate();
  const params = useParams<{ companyId?: string; branchId?: string }>();
  const scope  = useAppScope();
  const app    = useAppContext();

  // ── Reducer ───────────────────────────────────────────────────────────────

  const [state, dispatch] = useReducer(
    onboardingReducer,
    createInitialOnboardingState(
      params.companyId,
      scope.companyId ?? app.companyId,
    ),
  );

  // ── Company list (UI state — not part of the onboarding session) ──────────

  const [companies,        setCompanies]        = useState<CompanyDto[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeIndex = Math.max(
    0,
    ONBOARDING_STEPS.findIndex((s) => s.key === state.active),
  );

  const activeBranch = useMemo((): BranchDto | null => {
    if (!state.branchId) return state.branch ?? null;
    return (
      state.branches.find((b) => String((b as any).id) === state.branchId) ??
      state.branch ??
      null
    );
  }, [state.branchId, state.branch, state.branches]);

  const readiness = useMemo(() => {
    const hasCompany = !!state.companyId;
    const hasBranch  = !!state.branchId;
    const hasStock   = state.stockLocations.length > 0;
    const hasStore   = state.stores.length > 0;
    const hasAdmin   = state.members.some((m) => m.role === "BranchAdmin");
    return {
      company:   { done: hasCompany,                                       locked: false      },
      branch:    { done: hasBranch,                                        locked: !hasCompany },
      locations: { done: hasStock,                                         locked: !hasBranch  },
      stores:    { done: hasStore,                                         locked: !hasBranch  },
      users:     { done: hasAdmin,                                         locked: !hasBranch  },
      review:    { done: hasCompany && hasBranch && hasStock && hasAdmin,  locked: !hasBranch  },
    };
  }, [
    state.companyId, state.branchId,
    state.stockLocations.length, state.stores.length, state.members,
  ]);

  // ── Data loading ───────────────────────────────────────────────────────────
  //
  // reload() takes explicit (cid, bid) parameters — the caller decides what
  // gets sent rather than relying on whatever state.branchId happens to be in
  // the useCallback closure at the time of execution.
  //
  //   reload(companyId, null)      → company + branches only, no branch data
  //   reload(companyId, branchId)  → company + branches + all branch resources

  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(async (
    cid: string | null = state.companyId,
    bid: string | null = state.branchId,
  ) => {
    if (!cid) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    dispatch({ type: "LOAD_START" });

    try {
      const [company, branches] = await Promise.all([
        onboardingApi.getCompany(cid).catch(() => null),
        onboardingApi.listBranches(cid).catch(() => []),
      ]);

      if (bid) {
        const [branch, stockLocations, stores, members] = await Promise.all([
          onboardingApi.getBranch(cid, bid).catch(() => null),
          onboardingApi.listStockLocations(cid, bid).catch(() => []),
          onboardingApi.listStores(cid, bid).catch(() => []),
          onboardingApi.listBranchUsers(cid, bid).catch(() => []),
        ]);
        dispatch({
          type: "LOAD_SUCCESS",
          patch: { company, branches, branch, stockLocations, stores, members },
        });
      } else {
        // No branchId — never send branch-scoped requests.
        dispatch({
          type: "LOAD_SUCCESS",
          patch: { company, branches },
        });
      }
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      dispatch({
        type: "LOAD_ERROR",
        error: extractApiError(err, "Failed to load onboarding data."),
      });
    }
  }, [state.companyId, state.branchId]);

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      setCompanies(await onboardingApi.listCompanies());
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  // On mount: always load the company selector list.
  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  // Initial load — fires once on mount when a companyId is already known
  // (e.g. user navigates directly to /companies/:id/onboarding).
  // Never passes a branchId — branch data is loaded only after the user
  // explicitly selects a branch inside the wizard.
  useEffect(() => {
    if (state.companyId) void reload(state.companyId, null);
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);   // empty deps — runs once on mount only

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goTo(step: WizardStepKey) {
    if (!readiness[step].locked) dispatch({ type: "SET_ACTIVE", step });
  }

  function next() {
    const i = ONBOARDING_STEPS.findIndex((s) => s.key === state.active);
    const candidate = ONBOARDING_STEPS[i + 1];
    if (candidate && !readiness[candidate.key].locked) goTo(candidate.key);
  }

  function back() {
    const i = ONBOARDING_STEPS.findIndex((s) => s.key === state.active);
    const candidate = ONBOARDING_STEPS[i - 1];
    if (candidate) goTo(candidate.key);
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  async function selectCompany(cid: string) {
    if (!cid) return;
    app.setCompanyId?.(cid as any);
    app.setBranchId?.(null as any);

    // Load company + branches before navigating so BranchStep renders with
    // the list already populated — no empty-list flash on step transition.
    dispatch({ type: "LOAD_START" });
    const [company, branches] = await Promise.all([
      onboardingApi.getCompany(cid).catch(() => null),
      onboardingApi.listBranches(cid).catch(() => []),
    ]);

    dispatch({
      type: "LOAD_SUCCESS",
      patch: {
        companyId:      cid,
        company,
        branches,
        branchId:       null,
        branch:         null,
        stockLocations: [],
        stores:         [],
        members:        [],
      },
    });
    dispatch({ type: "SET_ACTIVE", step: "branch" });
    nav(`/companies/${cid}/onboarding`, { replace: true });
  }

  async function afterCompanyCreated(company: CompanyDto) {
    const cid = String((company as any).id);
    app.setCompanyId?.(cid as any);
    app.setBranchId?.(null as any);

    setCompanies((prev) => [
      company,
      ...prev.filter((c) => companyId(c) !== cid),
    ]);

    // Newly created company has no branches yet — load returns [] immediately.
    // Still fetch so the branch step is consistent with the select-company path.
    const branches = await onboardingApi.listBranches(cid).catch(() => []);

    dispatch({
      type: "LOAD_SUCCESS",
      patch: { companyId: cid, company, branches, branchId: null },
    });
    dispatch({ type: "SET_ACTIVE",   step: "branch" });
    dispatch({ type: "SAVE_SUCCESS", notice: "Company created. Now select or create a branch." });
    nav(`/companies/${cid}/onboarding`, { replace: true });
  }

  function onCompanySaved(settings: any) {
    void loadCompanies();
    dispatch({ type: "SAVE_SUCCESS", notice: "Company saved.", patch: { settings } });
  }

  async function selectBranch(bid: string) {
    if (!state.companyId || !bid) return;
    app.setBranchId?.(bid as any);

    dispatch({
      type: "LOAD_SUCCESS",
      patch: {
        branchId:       bid,
        branch:         state.branches.find((b) => String((b as any).id) === bid) ?? null,
        stockLocations: [],
        stores:         [],
        members:        [],
      },
    });
    dispatch({ type: "SET_ACTIVE", step: "locations" });

    // Pass the new branchId directly — don't wait for state propagation.
    await reload(state.companyId, bid);

    nav(
      `/companies/${state.companyId}/branches/${bid}/onboarding`,
      { replace: true },
    );
  }

  async function afterBranchCreated(branch: BranchDto) {
    const bid = String((branch as any).id);
    app.setBranchId?.(bid as any);

    dispatch({
      type: "LOAD_SUCCESS",
      patch: {
        branchId:       bid,
        branch,
        branches:       upsertById(state.branches, branch),
        stockLocations: [],
        stores:         [],
        members:        [],
      },
    });
    dispatch({ type: "SET_ACTIVE",   step: "locations" });
    dispatch({ type: "SAVE_SUCCESS", notice: "Branch created. Configure stock locations next." });

    await reload(state.companyId, bid);

    nav(
      `/companies/${state.companyId}/branches/${bid}/onboarding`,
      { replace: true },
    );
  }

  function afterBranchUpdated(branch: BranchDto) {
    dispatch({
      type: "SAVE_SUCCESS",
      notice: "Branch updated.",
      patch:  { branch, branches: upsertById(state.branches, branch) },
    });
  }

  async function finish() {
    if (!state.companyId || !state.branchId) return;
    dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.complete(state.companyId, state.branchId);
      dispatch({ type: "SAVE_SUCCESS", notice: "Onboarding completed." });
      nav("/dashboard", { replace: true });
    } catch (err) {
      dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to complete onboarding."),
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const pct = Math.round(((activeIndex + 1) / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="ob-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="ob-page-header">
        <div>
          <div className="ob-page-title">Company Onboarding</div>
          <div className="ob-page-subtitle">
            Select a company and branch, then configure stock locations, stores, and users.
          </div>
        </div>
        <div className="ob-page-actions">
          <button
            type="button"
            className="ob-btn ob-btn--ghost"
            onClick={() => {
              void loadCompanies();
              void reload(state.companyId, state.branchId);
            }}
            disabled={companiesLoading || state.loading}
          >
            <RefreshCcw size={14} /> Refresh
          </button>
          <Link className="ob-btn ob-btn--ghost" to="/companies">Companies</Link>
        </div>
      </div>

      {/* ── Progress ───────────────────────────────────────────────────────── */}
      <div className="ob-progress">
        <div className="ob-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {state.error  && <Alert tone="danger" title="Action required" message={state.error}  />}
      {state.notice && <Alert tone="ok"     title="Saved"           message={state.notice} />}

      {/* ── Layout ─────────────────────────────────────────────────────────── */}
      <div className="ob-layout">
        <WizardRail
          steps={ONBOARDING_STEPS}
          active={state.active}
          readiness={readiness}
          onSelect={goTo}
        />

        <div className="ob-card">
          <div className="ob-card-header">
            <div className="ob-card-title">{ONBOARDING_STEPS[activeIndex]?.title}</div>
            <div className="ob-card-subtitle">{ONBOARDING_STEPS[activeIndex]?.subtitle}</div>
          </div>

          <div className="ob-card-body">

            {/* Branch context banner (all steps except Company) */}
            {state.active !== "company" && (
              <div className="ob-context-card">
                <div className="ob-context-main">
                  <div className="ob-context-label">Current branch</div>
                  <div className="ob-context-title">{branchLabel(activeBranch)}</div>
                </div>

                <select
                  className="ob-context-select"
                  value={state.branchId ?? ""}
                  onChange={(e) => { if (e.target.value) void selectBranch(e.target.value); }}
                  disabled={!state.companyId || state.branches.length === 0}
                  aria-label="Switch branch"
                >
                  <option value="">Select branch…</option>
                  {state.branches.map((b) => {
                    const id = String((b as any).id);
                    return (
                      <option key={id} value={id}>
                        {b.name}{b.code ? ` (${b.code})` : ""}
                      </option>
                    );
                  })}
                </select>

                <div className="ob-context-counts">
                  <span>{state.branches.length} branch{state.branches.length !== 1 ? "es" : ""}</span>
                  <span>{state.stockLocations.length} location{state.stockLocations.length !== 1 ? "s" : ""}</span>
                  <span>{state.stores.length} store{state.stores.length !== 1 ? "s" : ""}</span>
                  <span>{state.members.length} user{state.members.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            )}

            {/* ── Step content ─────────────────────────────────────────────── */}

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

            {state.active === "locations" && (
             <StockLocationsStep
              companyId={state.companyId}
              branchId={state.branchId}
              branchName={state.branch?.name ?? branchLabel(activeBranch)}
              saving={state.saving}
              dispatch={dispatch}
          />
            )}

            {state.active === "stores" && (
              <StoresStep
              companyId={state.companyId}
              branchId={state.branchId}
              branchName={branchLabel(activeBranch)}
              saving={state.saving}
              dispatch={dispatch}
            />
            )}

            {state.active === "users" && (
             <UsersStep
              companyId={state.companyId}
              branchId={state.branchId}
              branchName={branchLabel(activeBranch)}
              saving={state.saving}
              dispatch={dispatch}
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

          {/* ── Footer nav ───────────────────────────────────────────────── */}
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