import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../../../app/AppContext";
import { storesApi, type StoreDto } from "../api/storesApi";
import { stockLocationsApi, type StockLocationDto } from "../api/stockLocationsApi";
import { http } from "../../../api/http";

type EnumOption = { value: number; label: string };

export default function StoreLocationSetupPage() {
  const nav = useNavigate();
  const params = useParams<{ companyId: string; branchId: string }>();

  const {
    companyId,
    branchId,
    storeId,
    stockLocationId,
    setCompanyId,
    setBranchId,
    setStoreId,
    setStockLocationId,
  } = useAppContext();

  const routeCompanyId = params.companyId ?? null;
  const routeBranchId = params.branchId ?? null;

  /* ================= CONTEXT HYDRATION ================= */
  useEffect(() => {
    if (routeCompanyId && companyId !== routeCompanyId) setCompanyId(routeCompanyId);
    if (routeBranchId && branchId !== routeBranchId) setBranchId(routeBranchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCompanyId, routeBranchId]);

  const effectiveCompanyId = routeCompanyId ?? companyId;
  const effectiveBranchId = routeBranchId ?? branchId;

  /* ================= DATA ================= */
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [locs, setLocs] = useState<StockLocationDto[]>([]);

  /* ================= ENUM LOOKUPS ================= */
  const [storeTypes, setStoreTypes] = useState<EnumOption[]>([]);
  const [stockTypes, setStockTypes] = useState<EnumOption[]>([]);

  const [storeType, setStoreType] = useState<number>(1); // MainStore
  const [stockType, setStockType] = useState<number>(1); // MainStock

  /* ================= FORM ================= */
  const [storeName, setStoreName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [locName, setLocName] = useState("");
  const [locCode, setLocCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = useMemo(() => !!storeId && !!stockLocationId, [storeId, stockLocationId]);

  /* ================= LOAD ================= */
  const [isLoading, setIsLoading] = useState(true);

async function load() {
  if (!effectiveCompanyId || !effectiveBranchId) return;

  setIsLoading(true);
  setError(null);
  try {
    const [s, l] = await Promise.all([
      storesApi.list(effectiveCompanyId, effectiveBranchId),
      stockLocationsApi.list(effectiveCompanyId, effectiveBranchId),
    ]);

    setStores(s);
    setLocs(l);

    if (storeId && !s.some((x) => x.id === storeId)) setStoreId(null);
    if (stockLocationId && !l.some((x) => x.id === stockLocationId)) setStockLocationId(null);
  } catch (e: any) {
    setError(e?.response?.data?.message ?? e?.message ?? "Failed to load store/location.");
  } finally {
    setIsLoading(false);
  }
}


  /* ================= LOAD ENUMS ================= */
  useEffect(() => {
    http.get<EnumOption[]>("/lookups/store-location-types").then(r => setStoreTypes(r.data));
    http.get<EnumOption[]>("/lookups/stock-location-types").then(r => setStockTypes(r.data));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCompanyId, effectiveBranchId]);

  /* ================= CREATE STORE ================= */
  async function createStore() {
    if (!effectiveCompanyId || !effectiveBranchId) return;

    const name = storeName.trim();
    if (!name) return setError("Store name is required.");

    setBusy(true);
    setError(null);
    try {
      const created = await storesApi.create(effectiveCompanyId, effectiveBranchId, {
        name,
        code: storeCode.trim() || null,
        locationType: storeType,
      });
      setStoreId(created.id);
      setStoreName("");
      setStoreCode("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to create store.");
    } finally {
      setBusy(false);
    }
  }

  /* ================= CREATE STOCK LOCATION ================= */
  async function createLocation() {
    if (!effectiveCompanyId || !effectiveBranchId) return;

    const name = locName.trim();
    if (!name) return setError("Stock location name is required.");

    setBusy(true);
    setError(null);
    try {
      const created = await stockLocationsApi.create(effectiveCompanyId, effectiveBranchId, {
        name,
        code: locCode.trim() || null,
        locationType: stockType,
      });
      setStockLocationId(created.id);
      setLocName("");
      setLocCode("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to create stock location.");
    } finally {
      setBusy(false);
    }
  }

  function continueNext() {
    if (!canContinue) {
      setError("Select both Store and Stock Location to continue.");
      return;
    }
    nav("/dashboard", { replace: true });
  }

  if (!effectiveCompanyId) return <div style={{ padding: 16 }}>Missing companyId.</div>;
  if (!effectiveBranchId) return <div style={{ padding: 16 }}>Branch not selected.</div>;

  return (
    <div className="hna-page">
      <div className="hna-page-header">
        <h1>Store & Stock Location</h1>
        <p>Create or select a Store and its Stock Location for this Branch.</p>
      </div>

      {error && <div className="hna-alert hna-alert-error">{error}</div>}

      <div className="hna-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* STORE */}
        <div className="hna-card">
          <div style={{ fontWeight: 800 }}>Store</div>

          <select className="hna-input" value={storeId ?? ""} onChange={e => setStoreId(e.target.value || null)}>
            <option value="">Select store…</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select className="hna-input" value={storeType} onChange={e => setStoreType(+e.target.value)}>
            {storeTypes.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>

          <input className="hna-input" placeholder="New store name" value={storeName} onChange={e => setStoreName(e.target.value)} />
          <input className="hna-input" placeholder="Code (optional)" value={storeCode} onChange={e => setStoreCode(e.target.value)} />

          <button className="hna-btn" onClick={createStore} disabled={busy}>Create Store</button>
        </div>

        {/* STOCK */}
        <div className="hna-card">
          <div style={{ fontWeight: 800 }}>Stock Location</div>

          <select className="hna-input" value={stockLocationId ?? ""} onChange={e => setStockLocationId(e.target.value || null)}>
            <option value="">Select stock location…</option>
            {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          <select className="hna-input" value={stockType} onChange={e => setStockType(+e.target.value)}>
            {stockTypes.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>

          <input className="hna-input" placeholder="New location name" value={locName} onChange={e => setLocName(e.target.value)} />
          <input className="hna-input" placeholder="Code (optional)" value={locCode} onChange={e => setLocCode(e.target.value)} />

          <button className="hna-btn" onClick={createLocation} disabled={busy}>Create Location</button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
         {isLoading && <div>Loading…</div>}
        <button className="hna-btn" onClick={load}>Refresh</button>
        <button className="hna-btn hna-btn-primary" onClick={continueNext} disabled={!canContinue}>Continue</button>
      </div>
    </div>
  );
}
