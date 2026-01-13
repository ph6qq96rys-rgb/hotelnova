import { useMemo, useState } from "react";
import { useRoles } from "../hooks/useRoles";
import { useBranches } from "../hooks/useBranches";
import { securityApi } from "../api/securityApi";
import { useAppScope } from "../../../app/useAppScope";



type Props = {
  userId: string;
  onClose: () => void;
  onAssigned?: () => void;
};

type Step = 1 | 2 | 3;

export function AssignRoleWizard({ userId, onClose, onAssigned }: Props) {
  const { companyId } = useAppScope();
  const { roles, loading: rolesLoading } = useRoles();
  const { branches, loading: branchesLoading } = useBranches();

  const [step, setStep] = useState<Step>(1);
  const [branchId, setBranchId] = useState<string>(""); // empty = company-wide
  const [roleId, setRoleId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => roles.find(r => r.id === roleId),
    [roles, roleId]
  );

  const scopeLabel = useMemo(() => {
    if (!branchId) return "Company-wide";
    const b = branches.find(x => x.id === branchId);
    return b?.name ?? "Branch";
  }, [branchId, branches]);

  async function assign() {
    if (!companyId) return;
    if (!roleId) return;

    setSaving(true);
    setErr(null);

    try {
      // ✅ Preferred (if you implement scoped assignments endpoint)
      // await fetch("/api/security/role-assignments", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ userId, roleId, companyId, branchId: branchId || null })
      // });

      // ✅ Fallback: use existing API today (global membership)
      await securityApi.addUserToRole(roleId, userId); // :contentReference[oaicite:14]{index=14}

      onAssigned?.();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to assign role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">Assign Role</div>
            <div className="text-sm text-slate-500">
              Step {step} of 3 • Choose scope → role → review
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {/* STEP 1: Scope */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">Scope</div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="text-xs text-slate-500">Company</div>
                <div className="text-sm font-medium text-slate-800">
                  {companyId ?? "—"}
                </div>

                <div className="text-xs text-slate-500 mt-2">Branch (optional)</div>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  disabled={branchesLoading}
                >
                  <option value="">Company-wide (all branches)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <div className="text-xs text-slate-500">
                  Tip: Company-wide roles should be rare (e.g., SystemAdmin).
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
                  onClick={() => setStep(2)}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Role */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">Choose role</div>

              <div className="rounded-xl border border-slate-200 divide-y">
                {rolesLoading ? (
                  <div className="p-4 text-sm text-slate-500">Loading roles…</div>
                ) : (
                  roles
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(r => (
                      <label
                        key={r.id}
                        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="radio"
                          name="role"
                          className="mt-1"
                          checked={roleId === r.id}
                          onChange={() => setRoleId(r.id)}
                          disabled={r.isSystem} // optional: avoid assigning system roles via wizard
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                            {r.isSystem && (
                              <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                System
                              </span>
                            )}
                          </div>
                          {r.description && (
                            <div className="text-xs text-slate-500 truncate">{r.description}</div>
                          )}
                        </div>
                      </label>
                    ))
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>

                <button
                  className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
                  disabled={!roleId}
                  onClick={() => setStep(3)}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">Review</div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Scope</div>
                    <div className="text-sm font-medium text-slate-900">{scopeLabel}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Role</div>
                    <div className="text-sm font-medium text-slate-900">
                      {selectedRole?.name ?? "—"}
                    </div>
                  </div>
                </div>

                {selectedRole?.description && (
                  <div className="text-xs text-slate-500">
                    {selectedRole.description}
                  </div>
                )}

                <div className="text-xs text-slate-500">
                  Permissions are inherited from the role (managed in Role Detail).
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  onClick={() => setStep(2)}
                  disabled={saving}
                >
                  Back
                </button>

                <button
                  className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
                  onClick={assign}
                  disabled={!roleId || saving}
                >
                  {saving ? "Assigning…" : "Assign role"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
