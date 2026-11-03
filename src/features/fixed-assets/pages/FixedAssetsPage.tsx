import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Download, Plus, RefreshCw, Search } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { http, resolveBranchId } from "../../../api/http";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { formatAppDate } from "../../../shared/datetime/dateFormat";
import {
  ASSET_STATUSES,
  fixedAssetsApi,
  type FixedAssetCategory,
  type FixedAssetDetail,
  type FixedAssetListItem,
  type FixedAssetSummary,
} from "../api/fixedAssetsApi";
import { AssetDrawer } from "../components/AssetDrawer";
import { AssetFormDialog, type AssetSource } from "../components/AssetFormDialog";
import { CategoriesPanel } from "../components/CategoriesPanel";
import { DepreciationPanel } from "../components/DepreciationPanel";
import { apiError, downloadCsv, money, STATUS_LABEL, StatusChip } from "../components/faShared";
import "./fixed-assets.css";

const PAGE_SIZE = 50;
type Tab = "register" | "depreciation" | "categories";

/**
 * Fixed Asset Register: assets with their custody, condition and book value; the full
 * lifecycle from draft to disposal; monthly depreciation; and asset categories.
 */
export default function FixedAssetsPage() {
  const { tx } = useI18n();
  const { companyId = "" } = useParams<{ companyId: string }>();
  const [params, setParams] = useSearchParams();
  const canRegister = useHasPermission("fixedassets.register");
  const canReports = useHasPermission("fixedassets.reports");
  const branchId = resolveBranchId();

  const tab: Tab = params.get("tab") === "depreciation" && canReports ? "depreciation" : params.get("tab") === "categories" ? "categories" : "register";
  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === "register") p.delete("tab"); else p.set("tab", next);
    p.delete("purchaseOrderId"); p.delete("acceptanceId");
    setParams(p, { replace: true });
  };

  const [rows, setRows] = useState<FixedAssetListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const loadSequence = useRef(0);
  const [summary, setSummary] = useState<FixedAssetSummary | null>(null);
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [allBranches, setAllBranches] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ asset: FixedAssetDetail | null } | null>(null);
  const [source, setSource] = useState<AssetSource | null>(null);

  const scopeBranch = allBranches ? null : branchId;

  // Debounce typing in the search box.
  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchText.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const loadCategories = useCallback(async () => {
    if (!companyId) return;
    try { setCategories(await fixedAssetsApi.categories(companyId, true)); }
    catch (err) { setError(apiError(err, tx("Asset categories could not be loaded."))); }
  }, [companyId, tx]);

  const load = useCallback(async () => {
    if (!companyId) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const [list, totals] = await Promise.all([
        fixedAssetsApi.register(companyId, { branchId: scopeBranch, status, search, categoryId, page, pageSize: PAGE_SIZE }),
        fixedAssetsApi.summary(companyId, scopeBranch),
      ]);
      if (sequence !== loadSequence.current) return;
      setRows(list.items);
      setTotalCount(list.totalCount);
      setPage(list.page);
      setSummary(totals);
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      setRows([]);
      setSummary(null);
      setTotalCount(0);
      setError(apiError(err, tx("The fixed asset register could not be loaded.")));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [companyId, scopeBranch, status, search, categoryId, page, tx]);

  useEffect(() => { void loadCategories(); }, [loadCategories]);
  useEffect(() => { void load(); return () => { ++loadSequence.current; }; }, [load]);
  useEffect(() => { setPage(1); setSelectedId(null); setForm(null); setRows([]); setSummary(null); }, [companyId, scopeBranch]);

  // Hand-off from procurement: equipment accepted on a purchase order opens a prefilled registration.
  const sourceOrder = params.get("purchaseOrderId");
  const sourceAcceptance = params.get("acceptanceId");
  useEffect(() => {
    setSource(null);
    if (!companyId || !sourceOrder || !sourceAcceptance) return;
    let active = true;
    http.get<{ purchaseOrderId: string; acceptanceId: string; quantity: number; name: string; description: string; unitCost: number; reference: string }>(
      `/companies/${companyId}/procurement/purchase-orders/${sourceOrder}/acceptances/${sourceAcceptance}/asset-handoff`)
      .then(({ data }) => {
        if (!active) return;
        setSource({ purchaseOrderId: data.purchaseOrderId, name: data.name, description: data.description, unitCost: data.unitCost, reference: data.reference, quantity: data.quantity });
        setForm({ asset: null });
      })
      .catch(() => { if (active) setError(tx("The accepted equipment could not be loaded. Open its acceptance record and try again.")); });
    return () => { active = false; };
  }, [companyId, sourceOrder, sourceAcceptance, tx]);

  const changed = (message: string) => { setNotice(message); void load(); };

  const exportCsv = () => downloadCsv(`fixed-assets-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Asset no", "Tag", "Name", "Category", "Branch", "Location", "Custodian", "Status", "Condition", "Acquired", "In service", "Cost", "Net book value"],
    rows.map((r) => [r.assetNo, r.assetTagNumber, r.name, r.categoryName, r.branchName ?? "", r.locationName ?? "", r.custodianName ?? r.departmentName ?? "",
      STATUS_LABEL[r.status], r.condition, r.acquisitionDateUtc.slice(0, 10), r.inServiceDateUtc?.slice(0, 10) ?? "", r.acquisitionCost.toFixed(2), r.netBookValue.toFixed(2)]));

  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const now = Date.now();

  if (!companyId) return null;

  return (
    <main className="fa-page ui-page">
      <PageHeader title={tx("Fixed Asset Register")}
        subtitle={tx("Register, assign, inspect, depreciate and dispose of the company's equipment and other fixed assets.")}
        actions={
          <div className="fa-toolbar">
            <Button type="button" variant="outline" onClick={() => { void load(); void loadCategories(); }} disabled={loading}><RefreshCw size={15} aria-hidden="true" /> {tx("Refresh")}</Button>
            {canRegister ? (
              <Button type="button" disabled={activeCategories.length === 0} title={activeCategories.length === 0 ? tx("Create a category first.") : undefined}
                onClick={() => { setSource(null); setForm({ asset: null }); }}>
                <Plus size={15} aria-hidden="true" /> {tx("Register asset")}
              </Button>
            ) : null}
          </div>
        } />

      <div className="fa-tabs fa-tabs--page" role="tablist">
        <Button type="button" variant="ghost" role="tab" className="fa-tab" aria-selected={tab === "register"} onClick={() => setTab("register")}>{tx("Register")}</Button>
        {canReports ? <Button type="button" variant="ghost" role="tab" className="fa-tab" aria-selected={tab === "depreciation"} onClick={() => setTab("depreciation")}>{tx("Depreciation")}</Button> : null}
        <Button type="button" variant="ghost" role="tab" className="fa-tab" aria-selected={tab === "categories"} onClick={() => setTab("categories")}>{tx("Categories")}</Button>
      </div>

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}

      {tab === "register" ? (
        <>
          {summary ? (
            <section className="fa-metrics" aria-label={tx("Summary")}>
              <div><span>{tx("Assets in register")}</span><strong>{summary.total - summary.disposed}</strong><small>{tx("{n} draft · {d} disposed", { n: summary.draft, d: summary.disposed })}</small></div>
              <div><span>{tx("In use")}</span><strong>{summary.inUse}</strong><small>{tx("{m} in maintenance · {o} out of service", { m: summary.underMaintenance, o: summary.outOfService })}</small></div>
              <div className={summary.inspectionDue ? "is-warn" : ""}><span>{tx("Inspection due")}</span><strong>{summary.inspectionDue}</strong></div>
              <div className={summary.missingOrStolen ? "is-bad" : ""}><span>{tx("Missing or stolen")}</span><strong>{summary.missingOrStolen}</strong></div>
              <div><span>{tx("Cost")}</span><strong>{money(summary.totalCost)}</strong><small>{tx("less {amount} depreciation", { amount: money(summary.accumulatedDepreciation) })}</small></div>
              <div className={summary.depreciationBehind ? "is-warn" : ""}><span>{tx("Net book value")}</span><strong>{money(summary.netBookValue)}</strong>
                <small>{summary.depreciationBehind ? tx("{n} asset(s) not depreciated up to last month", { n: summary.depreciationBehind }) : summary.lastRunPeriod ? tx("Depreciated up to {period}", { period: summary.lastRunPeriod }) : tx("No depreciation posted yet")}</small>
              </div>
            </section>
          ) : null}
          {summary?.depreciationBehind && canReports ? (
            <p className="fa-note fa-note--warn">
              {tx("Book values are overstated until last month's depreciation is posted.")}{" "}
              <Button type="button" size="sm" variant="outline" onClick={() => setTab("depreciation")}>{tx("Run depreciation")}</Button>
            </p>
          ) : null}

          <section className="fa-panel">
            <div className="fa-filters">
              <label className="fa-search">
                <Search size={15} aria-hidden="true" />
                <Input value={searchText} aria-label={tx("Search assets")} placeholder={tx("Asset no, tag, name, serial, barcode")} onChange={(e) => setSearchText(e.target.value)} />
              </label>
              <Select aria-label={tx("Status")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">{tx("All statuses")}</option>
                {ASSET_STATUSES.map((s) => <option key={s} value={s}>{tx(STATUS_LABEL[s])}</option>)}
              </Select>
              <Select aria-label={tx("Category")} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
                <option value="">{tx("All categories")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
              </Select>
              <Select aria-label={tx("Branch scope")} value={allBranches ? "all" : "branch"} onChange={(e) => { setAllBranches(e.target.value === "all"); setPage(1); }}>
                <option value="branch">{tx("This branch")}</option>
                <option value="all">{tx("All accessible branches")}</option>
              </Select>
              <Button type="button" variant="outline" disabled={rows.length === 0 || loading} onClick={exportCsv}><Download size={15} aria-hidden="true" /> {tx("Export this page")}</Button>
            </div>

            <div className="fa-table-wrap">
              <table className="ui-table fa-table fa-table--register">
                <thead>
                  <tr>
                    <th>{tx("Asset")}</th>
                    <th>{tx("Category")}</th>
                    <th>{tx("Branch / location")}</th>
                    <th>{tx("custody")}</th>
                    <th>{tx("Status")}</th>
                    <th>{tx("In service")}</th>
                    <th className="fa-num">{tx("Cost")}</th>
                    <th className="fa-num">{tx("Book value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const due = row.nextInspectionDueUtc && Date.parse(row.nextInspectionDueUtc) <= now && row.status !== "draft" && row.status !== "retired" && row.status !== "disposed";
                    return (
                      <tr key={row.id} className="fa-row" tabIndex={0} onClick={() => setSelectedId(row.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(row.id); } }}>
                        <td><strong>{row.assetNo}</strong><span>{row.name}</span><small>{row.assetTagNumber || row.serialNumber || tx("No tag")}</small></td>
                        <td>{row.categoryName}</td>
                        <td>{row.branchName ?? tx("No branch")}<span>{row.locationName ?? "—"}</span></td>
                        <td>{row.custodianName ?? row.departmentName ?? <span className="fa-warn-text">{tx("No custodian")}</span>}</td>
                        <td><StatusChip status={row.status} />{due ? <small className="fa-warn-text">{tx("Inspection due")}</small> : null}</td>
                        <td>{row.inServiceDateUtc ? formatAppDate(row.inServiceDateUtc) : "—"}</td>
                        <td className="fa-num">{money(row.acquisitionCost)}</td>
                        <td className="fa-num"><strong>{money(row.netBookValue)}</strong></td>
                      </tr>
                    );
                  })}
                  {!loading && rows.length === 0 ? (
                    <tr><td className="fa-empty" colSpan={8}>{search || status || categoryId ? tx("No assets match these filters.") : tx("No fixed assets registered yet.")}</td></tr>
                  ) : null}
                  {loading && rows.length === 0 ? <tr><td className="fa-empty" colSpan={8}>{tx("Loading...")}</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="fa-pager">
              <span className="fa-muted" aria-live="polite">{tx("{count} assets · Page {page} of {pages}", { count: totalCount, page, pages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) })}</span>
              <Button type="button" size="sm" variant="outline" disabled={page === 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>{tx("Previous")}</Button>
              <Button type="button" size="sm" variant="outline" disabled={page * PAGE_SIZE >= totalCount || loading} onClick={() => setPage((p) => p + 1)}>{tx("Next")}</Button>
            </div>
          </section>
        </>
      ) : null}

      {tab === "depreciation" ? <DepreciationPanel companyId={companyId} onPosted={() => void load()} /> : null}
      {tab === "categories" ? <CategoriesPanel companyId={companyId} categories={categories} onChanged={(m) => { setNotice(m); void loadCategories(); }} /> : null}

      <AssetDrawer companyId={companyId} assetId={selectedId} onClose={() => setSelectedId(null)}
        onEdit={(asset) => setForm({ asset })} onChanged={changed} />

      <AssetFormDialog companyId={companyId} open={!!form} asset={form?.asset ?? null} categories={categories}
        defaultBranchId={branchId} source={form?.asset ? null : source}
        onClose={() => setForm(null)}
        onSaved={(asset, created) => {
          setForm(null);
          if (created) {
            setSource(null);
            const p = new URLSearchParams(params); p.delete("purchaseOrderId"); p.delete("acceptanceId"); setParams(p, { replace: true });
            setNotice(tx("{asset} registered as a draft. Open it to activate.", { asset: asset.assetNo }));
            setSelectedId(asset.id);
          } else {
            setNotice(tx("{asset} saved.", { asset: asset.assetNo }));
            setSelectedId(null);
            window.setTimeout(() => setSelectedId(asset.id), 0);
          }
          void load();
        }} />
    </main>
  );
}
