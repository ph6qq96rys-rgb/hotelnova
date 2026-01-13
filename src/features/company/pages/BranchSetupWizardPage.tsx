import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../../app/AppContext";
import { useAppScope } from "../../../app/useAppScope";
import { branchesApi} from "../api/branchesApi";
import type{CreateBranchDto, BranchDto} from "../types";

type Mode = "select" | "create";



type FieldErrors = Partial<Record<keyof CreateBranchDto, string>> & { form?: string };

const MAX = {
  code: 30,
  name: 150,
  region: 120,
  city: 120,
  addressLine: 300
};

function trimOrNull(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function validate(dto: CreateBranchDto): FieldErrors {
  const e: FieldErrors = {};

  const code = dto.code.trim();
  const name = dto.name.trim();

  if (!code) e.code = "Code is required.";
  else if (code.length > MAX.code) e.code = `Max ${MAX.code} characters.`;

  if (!name) e.name = "Branch name is required.";
  else if (name.length > MAX.name) e.name = `Max ${MAX.name} characters.`;

  if (dto.region && dto.region.length > MAX.region) e.region = `Max ${MAX.region} characters.`;
  if (dto.city && dto.city.length > MAX.city) e.city = `Max ${MAX.city} characters.`;
  if (dto.addressLine && dto.addressLine.length > MAX.addressLine) e.addressLine = `Max ${MAX.addressLine} characters.`;

  return e;
}

function Field({
  label,
  required,
  hint,
  error,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.82 }}>
        {label} {required ? <span style={{ color: "crimson" }}>*</span> : null}
      </span>
      {children}
      {error ? <span style={{ fontSize: 12, color: "crimson" }}>{error}</span> : null}
      {hint ? <span style={{ fontSize: 12, opacity: 0.65 }}>{hint}</span> : null}
    </label>
  );
}

export default function BranchSetupWizardPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();
  const { setBranchId } = useAppContext();

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("select");
  const [selected, setSelected] = useState<string>(branchId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ DTO-driven form state (matches backend exactly)
  const [form, setForm] = useState<CreateBranchDto>({
    code: "",
    name: "",
    region: null,
    city: null,
    addressLine: null,
    isMain: false
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selected) ?? null,
    [branches, selected]
  );

  const goNext = (cid: string, bid: string) => {
    nav(`/companies/${cid}/branches/${bid}/setup/store-location`, { replace: true });
  };

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    try {
      const data = await branchesApi.list(companyId);
      setBranches(data);

      if (data.length === 0) {
        setMode("create");
        setSelected("");
        setBranchId(null);
        return;
      }

      if (branchId && !data.some((b) => b.id === branchId)) {
        setBranchId(null);
        setSelected("");
      } else if (branchId) {
        setSelected(branchId);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load branches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [companyId]);

  // reset create form when switching to create
  useEffect(() => {
    if (mode === "create") {
      setForm({ code: "", name: "", region: null, city: null, addressLine: null, isMain: false });
      setFieldErrors({});
      setError(null);
    }
  }, [mode]);

  async function onCreate() {
    if (!companyId) return;
    if (busy) return;

    // ✅ Build payload exactly as backend expects (Required + MaxLength respected)
    const payload: CreateBranchDto = {
      code: form.code.trim(),
      name: form.name.trim(),
      region: trimOrNull(form.region ?? ""),
      city: trimOrNull(form.city ?? ""),
      addressLine: trimOrNull(form.addressLine ?? ""),
      isMain: !!form.isMain
    };

    const v = validate(payload);
    setFieldErrors(v);
    if (Object.keys(v).length > 0) return;

    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const created = await branchesApi.create(companyId, payload);

      setBranchId(created.id);

      // optional optimistic insert (newest on top)
      setBranches((prev) => (prev.some((b) => b.id === created.id) ? prev : [created, ...prev]));

      goNext(companyId, created.id);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to create branch.";
      setError(msg);
      setFieldErrors((prev) => ({ ...prev, form: msg }));
    } finally {
      setBusy(false);
    }
  }

  /*function onContinue() {
    if (!companyId) return;
    if (!selected) { setError("Select a branch to continue."); return; }
    setError(null);
    setBranchId(selected);
    goNext(companyId, selected);
  }*/
 
 function onContinue() {
  if (!companyId) return;
  if (!selected) { setError("Select a branch to continue."); return; }
      console.log("Before clear:", { companyId, branchId, selected });
      setError(null);
      console.log("After clear:", { companyId, branchId, selected });
  // ✅ remove race: don’t clear error before navigation
  nav(`/companies/${companyId}/branches/${selected}/setup/store-location`, { replace: true });

  // ✅ update scope (optional) — but do NOT rely on it for routing
  setBranchId(selected);
}



  return (
    <div className="hna-page">
      <div className="hna-page-header">
        <div>
          <h1>Branch Setup</h1>
          <p>Select or create a Branch before assigning Stores & Stock Locations.</p>
        </div>
      </div>

      {error && <div className="hna-alert hna-alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="hna-card">
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button
            className={`hna-btn ${mode === "select" ? "hna-btn-primary" : ""}`}
            onClick={() => setMode("select")}
            disabled={branches.length === 0}
          >
            Select
          </button>

          <button
            className={`hna-btn ${mode === "create" ? "hna-btn-primary" : ""}`}
            onClick={() => setMode("create")}
          >
            Create
          </button>

          <div style={{ flex: 1 }} />
          <button className="hna-btn" onClick={load} disabled={loading || busy}>Refresh</button>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : mode === "select" ? (
          <>
            <Field label="Branch" hint="Choose an existing branch to continue.">
              <select className="hna-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.code ? ` (${b.code})` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Selected: {selectedBranch ? selectedBranch.name : "—"}
            </div>

            <div style={{ marginTop: 14 }}>
              <button className="hna-btn hna-btn-primary" onClick={onContinue} disabled={!selected || busy}>
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ✅ Professional Create Branch Form (DTO-driven) */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Create Branch</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Fill the DTO fields below. Required fields are marked with <span style={{ color: "crimson" }}>*</span>.
                </div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.7 }}>
                DTO: <code>CreateBranchDto</code>
              </div>
            </div>

            {fieldErrors.form && (
              <div className="hna-alert hna-alert-error" style={{ marginTop: 12 }}>
                {fieldErrors.form}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                maxWidth: 920
              }}
            >
              <Field
                label="Code"
                required
                error={fieldErrors.code}
                hint={`Required. Up to ${MAX.code} characters (e.g., BOLE).`}
              >
                <input
                  className="hna-input"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="BOLE"
                  maxLength={MAX.code}
                  disabled={busy}
                />
              </Field>

              <Field
                label="Branch Name"
                required
                error={fieldErrors.name}
                hint={`Required. Up to ${MAX.name} characters.`}
              >
                <input
                  className="hna-input"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Bole Branch"
                  maxLength={MAX.name}
                  disabled={busy}
                />
              </Field>

              <Field
                label="Region"
                error={fieldErrors.region}
                hint={`Optional. Up to ${MAX.region} characters.`}
              >
                <input
                  className="hna-input"
                  value={form.region ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, region: e.target.value || null }))}
                  placeholder="Oromia"
                  maxLength={MAX.region}
                  disabled={busy}
                />
              </Field>

              <Field
                label="City"
                error={fieldErrors.city}
                hint={`Optional. Up to ${MAX.city} characters.`}
              >
                <input
                  className="hna-input"
                  value={form.city ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value || null }))}
                  placeholder="Addis Ababa"
                  maxLength={MAX.city}
                  disabled={busy}
                />
              </Field>

              <div style={{ gridColumn: "1 / span 2" }}>
                <Field
                  label="Address Line"
                  error={fieldErrors.addressLine}
                  hint={`Optional. Up to ${MAX.addressLine} characters.`}
                >
                  <textarea
                    className="hna-input"
                    value={form.addressLine ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, addressLine: e.target.value || null }))}
                    placeholder="Street / Building / Landmark..."
                    maxLength={MAX.addressLine}
                    rows={3}
                    disabled={busy}
                    style={{ resize: "vertical" }}
                  />
                </Field>
              </div>

              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px" }}>
                  <input
                    type="checkbox"
                    checked={!!form.isMain}
                    onChange={(e) => setForm((p) => ({ ...p, isMain: e.target.checked }))}
                    disabled={busy}
                  />
                  <div style={{ display: "grid" }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Main Branch</span>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>
                      Mark this branch as the primary branch for the company.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
              <button className="hna-btn hna-btn-primary" onClick={onCreate} disabled={busy}>
                {busy ? "Creating…" : "Create & Continue"}
              </button>

              <button
                className="hna-btn"
                onClick={() => setMode("select")}
                disabled={busy || branches.length === 0}
              >
                Cancel
              </button>

              <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                Next: <b>Store Location</b>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
