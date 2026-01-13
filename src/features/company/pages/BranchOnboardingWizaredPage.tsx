import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../../../app/AppContext";

// ✅ Step pages (you already have StoreLocationSetupPage; others are placeholders)
import BranchBasicsStep from "../pages/steps/BranchBasicsStep";
import StoreLocationStep from "./StoreLocationSetupPage"; // reuse your working page
import BranchUsersStep from "./steps/BranchUsersStep";
import BranchReviewStep from "./steps/BranchReviewStep";

type StepKey = "branch" | "storeLocation" | "users" | "review";

type Step = {
  key: StepKey;
  title: string;
  subtitle: string;
};

const STEPS: Step[] = [
  { key: "branch", title: "Branch details", subtitle: "Name, code, address" },
  { key: "storeLocation", title: "Store & stock", subtitle: "Operational locations" },
  { key: "users", title: "Users & roles", subtitle: "Branch admin access" },
  { key: "review", title: "Review & finish", subtitle: "Confirm setup" },
];

export default function BranchSetupWizardPage() {
  const nav = useNavigate();
  const params = useParams<{ companyId: string; branchId?: string }>();

  const {
    companyId,
    branchId,
    setCompanyId,
    setBranchId,
    storeId,
    stockLocationId,
  } = useAppContext();

  // Hydrate from route
  useEffect(() => {
    if (params.companyId && companyId !== params.companyId) setCompanyId(params.companyId);
    if (params.branchId && branchId !== params.branchId) setBranchId(params.branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.companyId, params.branchId]);

  const effectiveCompanyId = params.companyId ?? companyId ?? null;
  const effectiveBranchId = params.branchId ?? branchId ?? null;

  // Wizard UI state
  const [active, setActive] = useState<StepKey>("branch");

  // ✅ Determine completion/locking rules (match your onboarding checklist logic)
  const status = useMemo(() => {
    const hasCompany = !!effectiveCompanyId;
    const hasBranch = !!effectiveBranchId;
    const hasStoreAndStock = !!storeId && !!stockLocationId;

    return {
      companyOk: hasCompany,
      branchOk: hasBranch,                 // Step 1 completes when branch exists
      storeLocationOk: hasStoreAndStock,   // Step 2 completes when selected/created
      usersOk: true,                       // placeholder until you implement users
    };
  }, [effectiveCompanyId, effectiveBranchId, storeId, stockLocationId]);

  const stepState = useMemo(() => {
    const map: Record<StepKey, { done: boolean; locked: boolean }> = {
      branch: { done: status.branchOk, locked: !status.companyOk },
      storeLocation: { done: status.storeLocationOk, locked: !status.branchOk },
      users: { done: status.usersOk, locked: !status.storeLocationOk },
      review: { done: false, locked: !status.usersOk },
    };
    return map;
  }, [status]);

  const activeIndex = STEPS.findIndex(s => s.key === active);
  const progressPct = Math.round(((activeIndex + 1) / STEPS.length) * 100);

  function goNext() {
    const i = STEPS.findIndex(s => s.key === active);
    if (i < STEPS.length - 1) {
      const next = STEPS[i + 1].key;
      if (!stepState[next].locked) setActive(next);
    }
  }

  function goBack() {
    const i = STEPS.findIndex(s => s.key === active);
    if (i > 0) setActive(STEPS[i - 1].key);
  }

  function openStep(k: StepKey) {
    if (stepState[k].locked) return;
    setActive(k);
  }

  if (!effectiveCompanyId) {
    return (
      <div className="page">
        <div className="card p-4">Missing companyId. Go back and select a company.</div>
      </div>
    );
  }

  return (
    <div className="page max-w-6xl mx-auto px-2 md:px-0">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 md:px-8 py-6 border-b border-slate-200 bg-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="text-xs tracking-widest uppercase text-slate-500">
                Branch Setup
              </div>
              <h1 className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                Configure branch for operations
              </h1>
              <div className="mt-1 text-sm text-slate-500">
                Create the branch, define store & stock locations, and finalize access.
              </div>
            </div>

            <div className="min-w-[240px]">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>Progress</span>
                <span className="font-semibold text-slate-700">{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                <div className="h-full bg-slate-900" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 md:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            {/* Left Stepper */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <div className="text-sm font-semibold text-slate-900">Setup steps</div>
                <div className="text-xs text-slate-500 mt-1">Complete in order</div>
              </div>

              <div className="p-3">
                {STEPS.map((s, idx) => {
                  const st = stepState[s.key];
                  const isActive = s.key === active;

                  return (
                    <button
                      key={s.key}
                      className={
                        "w-full text-left rounded-2xl px-4 py-3 border mb-2 transition " +
                        (st.locked
                          ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                          : isActive
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50")
                      }
                      onClick={() => openStep(s.key)}
                      disabled={st.locked}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={
                            "mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-xs font-extrabold " +
                            (st.done
                              ? "bg-emerald-100 text-emerald-800"
                              : st.locked
                              ? "bg-slate-200 text-slate-500"
                              : isActive
                              ? "bg-white/15 text-white"
                              : "bg-slate-100 text-slate-700")
                          }
                        >
                          {st.done ? "✓" : idx + 1}
                        </div>

                        <div className="flex-1">
                          <div className={"text-sm font-semibold " + (isActive ? "text-white" : "text-slate-900")}>
                            {s.title}
                          </div>
                          <div className={"text-xs mt-0.5 " + (isActive ? "text-white/80" : "text-slate-500")}>
                            {s.subtitle}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Content */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {STEPS[activeIndex]?.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {STEPS[activeIndex]?.subtitle}
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Company: <span className="font-mono">{effectiveCompanyId}</span>
                  {effectiveBranchId && (
                    <>
                      {" "}• Branch: <span className="font-mono">{effectiveBranchId}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-5">
                {active === "branch" && (
                  <BranchBasicsStep
                    companyId={effectiveCompanyId}
                    branchId={effectiveBranchId}
                    onCreated={(newBranchId) => {
                      setBranchId(newBranchId);
                      // keep URL consistent if you want:
                      nav(`/companies/${effectiveCompanyId}/branches/${newBranchId}/setup`, { replace: true });
                      setActive("storeLocation");
                    }}
                  />
                )}

                {active === "storeLocation" && (
                  // Reuse your existing page, it already hydrates from params/context
                  <StoreLocationStep />
                )}

                {active === "users" && (
                  <BranchUsersStep
                    companyId={effectiveCompanyId}
                    branchId={effectiveBranchId}
                    onDone={() => setActive("review")}
                  />
                )}

                {active === "review" && (
                  <BranchReviewStep
                    companyId={effectiveCompanyId}
                    branchId={effectiveBranchId}
                    onFinish={() => nav("/dashboard", { replace: true })}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  className="btn-lux"
                  onClick={goBack}
                  disabled={activeIndex === 0}
                >
                  Back
                </button>

                <div className="text-xs text-slate-500">
                  Step {activeIndex + 1} of {STEPS.length}
                </div>

                <button
                  className="btn-lux-primary"
                  onClick={goNext}
                  disabled={activeIndex >= STEPS.length - 1 || stepState[STEPS[activeIndex + 1]?.key]?.locked}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Small local styles */}
        <style>{`
          .btn-lux{
            border: 1px solid rgb(226 232 240);
            background: white;
            padding: 10px 14px;
            border-radius: 14px;
            font-weight: 700;
            font-size: 14px;
            color: rgb(15 23 42);
            box-shadow: 0 1px 0 rgba(0,0,0,0.02);
          }
          .btn-lux:disabled{ opacity: .55; cursor: not-allowed; }
          .btn-lux-primary{
            border: 1px solid rgb(15 23 42);
            background: rgb(15 23 42);
            padding: 10px 14px;
            border-radius: 14px;
            font-weight: 800;
            font-size: 14px;
            color: white;
            box-shadow: 0 8px 24px rgba(15,23,42,0.18);
          }
          .btn-lux-primary:disabled{ opacity: .55; cursor: not-allowed; box-shadow:none; }
        `}</style>
      </div>
    </div>
  );
}
