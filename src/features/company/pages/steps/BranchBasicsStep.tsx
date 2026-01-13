import { useState } from "react";

export default function BranchBasicsStep(props: {
  companyId: string;
  branchId: string | null;
  onCreated: (branchId: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const n = name.trim();
    if (!n) return setError("Branch name is required.");

    setBusy(true);
    setError(null);
    try {
      // ✅ replace with your branchesApi.create
      const created = await fakeCreateBranch(props.companyId, { name: n, code: code.trim() || null });
      props.onCreated(created.id);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to create branch.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 p-4">
          <div className="text-xs font-extrabold tracking-widest uppercase">Action required</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5">
        <div className="text-sm font-semibold text-slate-900">Branch identity</div>
        <div className="text-xs text-slate-500 mt-1">This appears on POS, reports, and invoices.</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <LuxuryInput label="Branch name" value={name} onChange={setName} placeholder="e.g., Bole Branch" required />
          <LuxuryInput label="Code (optional)" value={code} onChange={setCode} placeholder="e.g., BOLE-01" />
        </div>

        <div className="mt-5 flex items-center justify-end">
          <button className="btn-lux-primary" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Create Branch"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LuxuryInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold text-slate-500 mb-1">
        {props.label} {props.required ? <span className="text-rose-600">*</span> : null}
      </div>
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                   focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </div>
  );
}

// REMOVE: placeholder mock
async function fakeCreateBranch(companyId: string, dto: any): Promise<{ id: string }> {
  console.log("create branch", companyId, dto);
  return { id: crypto.randomUUID() };
}
