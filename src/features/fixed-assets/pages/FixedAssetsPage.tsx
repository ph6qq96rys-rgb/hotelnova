import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save } from "lucide-react";
import { useParams } from "react-router-dom";
import { resolveBranchId } from "../../../api/http";
import { formatAppDate } from "../../../shared/datetime/dateFormat";
import {
  createFixedAsset,
  createFixedAssetCategory,
  listFixedAssetCategories,
  listFixedAssets,
  type FixedAssetCategory,
  type FixedAssetListItem,
} from "../api/fixedAssetsApi";
import "./fixed-assets.css";

const money = new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 });

function formatDate(value?: string | null) {
  return formatAppDate(value);
}

function statusTone(status: string) {
  return `fa-chip fa-chip--${status.toLowerCase()}`;
}

const categoryDefaults = {
  code: "",
  name: "",
  description: "",
  depreciationMethod: "StraightLine",
  usefulLifeMonths: 60,
  residualValuePercent: 0,
  capitalizationThreshold: 0,
  inspectionIntervalDays: 180,
  requiresSerialNumber: false,
  requiresTagBeforeActivation: true,
  requiresCustodianOnActivation: true,
  isActive: true,
};

const assetDefaults = {
  categoryId: "",
  assetNo: "",
  assetTagNumber: "",
  name: "",
  description: "",
  brand: "",
  model: "",
  serialNumber: "",
  barcode: "",
  physicalLocation: "",
  costCenterCode: "",
  notes: "",
  condition: "Good",
  acquisitionMethod: "Purchase",
  acquisitionDateUtc: new Date().toISOString(),
  acquisitionCost: 0,
  residualValue: 0,
  usefulLifeMonths: 60,
};

export default function FixedAssetsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [rows, setRows] = useState<FixedAssetListItem[]>([]);
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [assetForm, setAssetForm] = useState(assetDefaults);
  const [categoryForm, setCategoryForm] = useState(categoryDefaults);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branchId = resolveBranchId();

  const totals = useMemo(() => rows.reduce(
    (acc, row) => {
      acc.count += 1;
      acc.value += row.netBookValue || 0;
      if (row.status === "Draft") acc.draft += 1;
      if (row.status === "Assigned") acc.assigned += 1;
      if (row.nextInspectionDueUtc && new Date(row.nextInspectionDueUtc) <= new Date()) acc.due += 1;
      return acc;
    },
    { count: 0, value: 0, draft: 0, assigned: 0, due: 0 },
  ), [rows]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [assetRows, categoryRows] = await Promise.all([
        listFixedAssets(companyId, { branchId, status, search }),
        listFixedAssetCategories(companyId),
      ]);
      setRows(assetRows);
      setCategories(categoryRows);
      setAssetForm((current) => ({ ...current, categoryId: current.categoryId || categoryRows[0]?.id || "" }));
    } catch {
      setError("Unable to load the fixed asset register.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companyId]);

  async function saveCategory() {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await createFixedAssetCategory(companyId, categoryForm);
      setCategories((current) => [created, ...current.filter((x) => x.id !== created.id)]);
      setAssetForm((current) => ({ ...current, categoryId: current.categoryId || created.id }));
      setCategoryForm(categoryDefaults);
      setMessage("Asset category saved.");
    } catch {
      setError("Unable to save fixed asset category.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAsset() {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createFixedAsset(companyId, {
        ...assetForm,
        currentBranchId: branchId,
        acquisitionCost: Number(assetForm.acquisitionCost || 0),
        residualValue: Number(assetForm.residualValue || 0),
        usefulLifeMonths: Number(assetForm.usefulLifeMonths || 0),
      });
      setAssetForm({ ...assetDefaults, categoryId: categories[0]?.id || "" });
      setMessage("Asset draft registered. Activate after assigning branch, location, and custody.");
      await load();
    } catch {
      setError("Unable to register fixed asset. Check required category, tag, dates, and serial policy.");
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) return null;

  return (
    <main className="fa-page">
      <header className="fa-header">
        <div>
          <div className="fa-kicker">Finance / Fixed Assets</div>
          <h1>Fixed Asset Register</h1>
          <p>Register, classify, value, and control asset custody across company and branch operations.</p>
        </div>
        <button className="fa-btn" type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error ? <div className="fa-alert fa-alert--danger">{error}</div> : null}
      {message ? <div className="fa-alert fa-alert--success">{message}</div> : null}

      <section className="fa-metrics" aria-label="Fixed asset summary">
        <div><span>Total assets</span><strong>{totals.count}</strong></div>
        <div><span>Assigned</span><strong>{totals.assigned}</strong></div>
        <div><span>Draft</span><strong>{totals.draft}</strong></div>
        <div><span>Inspection due</span><strong>{totals.due}</strong></div>
        <div><span>Net book value</span><strong>{money.format(totals.value)}</strong></div>
      </section>

      <section className="fa-workspace">
        <div className="fa-panel fa-panel--wide">
          <div className="fa-panel-head">
            <div>
              <h2>Asset Register</h2>
              <p>Readable custody, location, status, and accounting values.</p>
            </div>
            <div className="fa-toolbar">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search asset no, tag, name, serial" />
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All status</option>
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Assigned">Assigned</option>
                <option value="UnderMaintenance">Under maintenance</option>
                <option value="Disposed">Disposed</option>
              </select>
              <button className="fa-btn" type="button" onClick={load}>Apply</button>
            </div>
          </div>
          <div className="fa-table-wrap">
            <table className="fa-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Branch / Location</th>
                  <th>Custody</th>
                  <th>Status</th>
                  <th>Acquired</th>
                  <th className="fa-right">NBV</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.assetNo}</strong><span>{row.name}</span><small>{row.assetTagNumber || row.serialNumber || "No tag"}</small></td>
                    <td>{row.categoryName}</td>
                    <td>{row.branchName ?? "Company scope"}<span>{row.locationName ?? "Location pending"}</span></td>
                    <td>{row.custodianName ?? row.departmentName ?? "Custody pending"}</td>
                    <td><span className={statusTone(row.status)}>{row.status}</span></td>
                    <td>{formatDate(row.acquisitionDateUtc)}</td>
                    <td className="fa-right">{money.format(row.netBookValue || 0)}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 ? <tr><td className="fa-empty" colSpan={7}>No fixed assets found.</td></tr> : null}
                {loading ? <tr><td className="fa-empty" colSpan={7}>Loading fixed assets...</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="fa-side">
          <section className="fa-panel">
            <h2>Register Asset Draft</h2>
            <label>Category<select value={assetForm.categoryId} onChange={(e) => setAssetForm({ ...assetForm, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}</select></label>
            <label>Asset name<input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} /></label>
            <label>Asset tag<input value={assetForm.assetTagNumber} onChange={(e) => setAssetForm({ ...assetForm, assetTagNumber: e.target.value })} /></label>
            <label>Serial number<input value={assetForm.serialNumber} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })} /></label>
            <label>Physical location<input value={assetForm.physicalLocation} onChange={(e) => setAssetForm({ ...assetForm, physicalLocation: e.target.value })} /></label>
            <div className="fa-two"><label>Cost<input type="number" value={assetForm.acquisitionCost} onChange={(e) => setAssetForm({ ...assetForm, acquisitionCost: Number(e.target.value) })} /></label><label>Life months<input type="number" value={assetForm.usefulLifeMonths} onChange={(e) => setAssetForm({ ...assetForm, usefulLifeMonths: Number(e.target.value) })} /></label></div>
            <button className="fa-btn fa-btn--primary" type="button" onClick={saveAsset} disabled={saving || !assetForm.categoryId}><Plus size={16} /> Register draft</button>
          </section>

          <section className="fa-panel">
            <h2>Category Setup</h2>
            <label>Code<input value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} /></label>
            <label>Name<input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /></label>
            <div className="fa-two"><label>Useful life<input type="number" value={categoryForm.usefulLifeMonths} onChange={(e) => setCategoryForm({ ...categoryForm, usefulLifeMonths: Number(e.target.value) })} /></label><label>Inspection days<input type="number" value={categoryForm.inspectionIntervalDays} onChange={(e) => setCategoryForm({ ...categoryForm, inspectionIntervalDays: Number(e.target.value) })} /></label></div>
            <label className="fa-check"><input type="checkbox" checked={categoryForm.requiresSerialNumber} onChange={(e) => setCategoryForm({ ...categoryForm, requiresSerialNumber: e.target.checked })} /> Require serial number</label>
            <button className="fa-btn" type="button" onClick={saveCategory} disabled={saving}><Save size={16} /> Save category</button>
          </section>
        </aside>
      </section>
    </main>
  );
}
