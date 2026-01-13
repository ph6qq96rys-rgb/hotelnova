import { useEffect, useMemo, useState } from "react";
import { http } from "../../../../api/http";
import { useAppContext } from "../../../../app/AppContext";

type Props = {
  companyId: string;
  branchId: string | null;
  onFinish: () => void;
};

/** Minimal DTOs (adjust to your backend) */
type BranchDto = {
  id: string;
  name: string;
  code?: string | null;
};

type BranchUserDto = {
  userId: string;
  email: string;
  fullName?: string | null;
  role: "BranchAdmin" | "Staff";
};

/** ================= API (update endpoints here once) ================= */
const branchReviewApi = {
  getBranch(companyId: string, branchId: string) {
    return http.get<BranchDto>(`/companies/${companyId}/branches/${branchId}`);
  },
  listBranchUsers(companyId: string, branchId: string) {
    return http.get<BranchUserDto[]>(`/companies/${companyId}/branches/${branchId}/users`);
  },
  // Optional: mark onboarding complete (if you have such endpoint)
  // completeBranchOnboarding(companyId: string, branchId: string) {
  //   return http.post(`/companies/${companyId}/branches/${branchId}/onboarding/complete`, {});
  // },
};

export default function BranchReviewStep({ companyId, branchId, onFinish }: Props) {
  const { storeId, stockLocationId } = useAppContext();

  const [branch, setBranch] = useState<BranchDto | null>(null);
  const [users, setUsers] = useState<BranchUserDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBranch = !!branchId;
  const hasStore = !!storeId;
  const hasStockLocation = !!stockLocationId;

  const hasBranchAdmin = useMemo(
    () => users.some((u) => u.role === "BranchAdmin"),
    [users]
  );

  const canFinish = hasBranch && hasStore && hasStockLocation && hasBranchAdmin;

  async function load() {
    if (!branchId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [b, u] = await Promise.all([
        branchReviewApi.getBranch(companyId, branchId),
        branchReviewApi.listBranchUsers(companyId, branchId),
      ]);

      setBranch(b.data ?? null);
      setUsers(u.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load review data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, branchId]);

  async function finish() {
    if (!canFinish) {
      setError("Complete all required items before finishing.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      // Optional server-side completion flag
      // await branchReviewApi.completeBranchOnboarding(companyId, branchId!);

      onFinish();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to finish setup.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Banner tone="danger" title="Action required" message={error} />}

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
          <div className="text-sm font-semibold text-slate-900">Review & Finish</div>
          <div className="text-xs text-slate-500 mt-1">
            Confirm setup details before activating this branch.
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard
                  title="Branch"
                  value={
                    branch
                      ? `${branch.name}${branch.code ? ` (${branch.code})` : ""}`
                      : branchId
                      ? `Branch ID: ${branchId}`
                      : "Not created"
                  }
                  status={hasBranch ? "ok" : "missing"}
                  hint={hasBranch ? "Created" : "Required"}
                />

                <InfoCard
                  title="Store"
                  value={storeId ? storeId : "Not selected"}
                  status={hasStore ? "ok" : "missing"}
                  hint={hasStore ? "Selected" : "Required"}
                />

                <InfoCard
                  title="Stock Location"
                  value={stockLocationId ? stockLocationId : "Not selected"}
                  status={hasStockLocation ? "ok" : "missing"}
                  hint={hasStockLocation ? "Selected" : "Required"}
                />

                <InfoCard
                  title="Branch Admin"
                  value={hasBranchAdmin ? "Assigned" : "Missing"}
                  status={hasBranchAdmin ? "ok" : "missing"}
                  hint={hasBranchAdmin ? "Ready" : "Required"}
                />
              </div>

              {/* Checklist */}
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-900">Checklist</div>
                <div className="text-xs text-slate-500 mt-1">
                  Items marked Required must be completed to finish.
                </div>

                <div className="mt-4 grid gap-2">
                  <CheckItem done={hasBranch} title="Branch created" required />
                  <CheckItem done={hasStore} title="Store selected/created" required />
                  <CheckItem done={hasStockLocation} title="Stock location selected/created" required />
                  <CheckItem done={hasBranchAdmin} title="At least one Branch Admin assigned" required />
                </div>
              </div>

              {/* Users snapshot */}
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">Users</div>
                <div className="text-xs text-slate-500 mt-1">
                  Current users assigned to this branch.
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  {users.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">No users assigned.</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {users.map((u) => (
                        <div key={u.userId} className="p-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {u.fullName ?? "—"}
                            </div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                          <span
                            className={
                              "px-3 py-1.5 rounded-full text-xs font-extrabold tracking-wide border " +
                              (u.role === "BranchAdmin"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-slate-50 text-slate-700 border-slate-200")
                            }
                          >
                            {u.role === "BranchAdmin" ? "BRANCH ADMIN" : "STAFF"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button className="btn-lux" onClick={load} disabled={isBusy}>
            Refresh
          </button>

          <button className="btn-lux-primary" onClick={finish} disabled={!canFinish || isBusy}>
            {isBusy ? "Finishing…" : "Finish Setup"}
          </button>
        </div>
      </div>

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
  );
}

/* =================== UI helpers =================== */

function InfoCard(props: {
  title: string;
  value: string;
  status: "ok" | "missing";
  hint?: string;
}) {
  const ok = props.status === "ok";
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">{props.title}</div>
          <div className="text-sm font-semibold text-slate-900 mt-1 break-all">{props.value}</div>
          {props.hint && <div className="text-xs text-slate-500 mt-1">{props.hint}</div>}
        </div>

        <span
          className={
            "px-3 py-1.5 rounded-full text-xs font-extrabold tracking-wide border " +
            (ok
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100")
          }
        >
          {ok ? "READY" : "REQUIRED"}
        </span>
      </div>
    </div>
  );
}

function CheckItem(props: { done: boolean; title: string; required?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className={
            "h-6 w-6 rounded-full flex items-center justify-center text-xs font-extrabold " +
            (props.done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700")
          }
        >
          {props.done ? "✓" : "•"}
        </div>
        <div className="text-sm text-slate-900">{props.title}</div>
      </div>

      {props.required && (
        <span className="text-[11px] font-extrabold tracking-widest uppercase text-slate-500">
          Required
        </span>
      )}
    </div>
  );
}

function Banner(props: { tone: "success" | "danger"; title: string; message: string }) {
  const cls =
    props.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-xs font-extrabold tracking-widest uppercase">{props.title}</div>
      <div className="text-sm mt-1">{props.message}</div>
    </div>
  );
}
