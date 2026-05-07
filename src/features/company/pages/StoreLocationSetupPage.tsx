import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../../../app/AppContext";
import { storesApi } from "../api/storesApi";
import { stockLocationsApi } from "../api/stockLocationsApi";
import { http } from "../../../api/http";
import type { StockLocation, Store } from "../types";

type EnumOption = { value: number; text: string };

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isGuid(x: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    x
  );
}

// Normalize possible PascalCase backend responses (Id/Name/Code) into camelCase (id/name/code)
function normalizeStore(x: any): Store {
  return {
    ...(x as Store),
    id: x?.id ?? x?.Id,
    name: x?.name ?? x?.Name,
    code: (x as any)?.code ?? (x as any)?.Code ?? (x as any)?.storeCode ?? null,
  } as any;
}

function normalizeStockLocation(x: any): StockLocation {
  return {
    ...(x as StockLocation),
    id: x?.id ?? x?.Id,
    name: x?.name ?? x?.Name,
    code: (x as any)?.code ?? (x as any)?.Code ?? null,
  } as any;
}

/* ===================== Roles (best-effort) ===================== */
/**
 * Best-effort role extraction from a JWT stored in localStorage/sessionStorage.
 * Looks for payload keys: role, roles, "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
 */
function tryGetRolesFromJwt(): string[] {
  const keys = ["access_token", "token", "jwt", "id_token"];
  const raw =
    keys.map((k) => localStorage.getItem(k)).find(Boolean) ??
    keys.map((k) => sessionStorage.getItem(k)).find(Boolean);

  if (!raw) return [];

  const parts = raw.split(".");
  if (parts.length < 2) return [];

  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const roleClaim =
      payload?.role ??
      payload?.roles ??
      payload?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

    if (!roleClaim) return [];
    if (Array.isArray(roleClaim)) return roleClaim.map(String);
    return [String(roleClaim)];
  } catch {
    return [];
  }
}

type EnumKind = "StoreType" | "LocationType";

/**
 * Role-based enum filtering (text-based best effort).
 * - SystemAdmin / CompanyAdmin => all
 * - BranchAdmin => hide HQ/Central/Corporate/Company-like options if present
 * - StoreManager/Cashier => for LocationType, prefer store-facing options
 *
 * NOTE: For strict security, enforce this again on the backend.
 */
function filterEnumOptionsByRole(
  kind: EnumKind,
  options: EnumOption[],
  roles: string[]
): EnumOption[] {
  if (!options?.length) return options;

  const normRoles = new Set((roles ?? []).map((r) => r.toLowerCase()));
  const isPrivileged =
    normRoles.has("systemadmin") || normRoles.has("companyadmin");
  if (isPrivileged) return options;

  const isBranchAdmin = normRoles.has("branchadmin");
  const isStoreRole =
    normRoles.has("storemanager") ||
    normRoles.has("storeadmin") ||
    normRoles.has("cashier");

  const t = (s: string) => (s ?? "").toLowerCase();

  const excludeIfContains = (text: string) =>
    ["hq", "head office", "central", "corporate", "company", "global"].some((k) =>
      t(text).includes(k)
    );

  if (isBranchAdmin) return options.filter((o) => !excludeIfContains(o.text));

  if (isStoreRole && kind === "LocationType") {
    const allowIfContains = (text: string) =>
      ["store", "front", "back", "pos", "backroom", "counter"].some((k) =>
        t(text).includes(k)
      );
    const filtered = options.filter((o) => allowIfContains(o.text));
    return filtered.length ? filtered : options; // never break UX
  }

  return options;
}

/* ===================== Lux UI Components ===================== */
function Pill(props: {
  tone?: "ok" | "warn" | "danger" | "muted";
  children: React.ReactNode;
}) {
  const tone = props.tone ?? "muted";
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : tone === "danger"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        cls
      )}
    >
      {props.children}
    </span>
  );
}

function Banner(props: {
  tone?: "danger" | "warn" | "ok";
  title: string;
  message?: string | null;
}) {
  const tone = props.tone ?? "warn";
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : tone === "danger"
      ? "bg-rose-50 text-rose-900 ring-rose-200"
      : "bg-amber-50 text-amber-900 ring-amber-200";

  return (
    <div className={cx("mb-5 rounded-2xl ring-1 px-4 py-3", cls)}>
      <div className="text-sm font-semibold">{props.title}</div>
      {props.message ? (
        <div className="mt-1 text-sm opacity-90">{props.message}</div>
      ) : null}
    </div>
  );
}

function SectionCard(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {props.title}
          </div>
          {props.subtitle ? (
            <div className="text-xs text-slate-500 mt-0.5">
              {props.subtitle}
            </div>
          ) : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="p-5">{props.children}</div>
    </div>
  );
}

function Field(props: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  helper?: React.ReactNode;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-semibold text-slate-700">
          <span className="inline-flex items-center gap-2">
            {props.label}
            {props.required ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                Required
              </span>
            ) : null}
          </span>
        </div>
        {props.hint ? (
          <div className="text-[11px] text-slate-500">{props.hint}</div>
        ) : null}
      </div>

      <div className="mt-1.5">{props.children}</div>

      {props.error ? (
        <div className="mt-1.5 text-xs text-rose-700 flex items-start gap-2">
          <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span>{props.error}</span>
        </div>
      ) : props.helper ? (
        <div className="mt-1.5 text-xs text-slate-500 leading-relaxed">
          {props.helper}
        </div>
      ) : null}
    </div>
  );
}

function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
) {
  return (
    <input
      {...props}
      className={cx(
        "w-full h-11 rounded-xl border px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition",
        "bg-white/75 backdrop-blur",
        "shadow-[0_15px_40px_-22px_rgba(0,0,0,0.35)]",
        "focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/60",
        "hover:border-slate-300",
        props.invalid
          ? "border-rose-300 focus:ring-rose-500/15 focus:border-rose-300"
          : "border-slate-200",
        props.className
      )}
    />
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
) {
  return (
    <div className="relative group">
      <select
        {...props}
        className={cx(
          "w-full h-11 rounded-xl border px-3.5 pr-10 text-sm text-slate-900 outline-none transition",
          "bg-white/70 backdrop-blur",
          "shadow-[0_15px_40px_-22px_rgba(0,0,0,0.35)]",
          "focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/60",
          "hover:border-slate-300",
          props.invalid
            ? "border-rose-300 focus:ring-rose-500/15 focus:border-rose-300"
            : "border-slate-200",
          props.className
        )}
      />
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 group-focus-within:text-emerald-600 transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 10l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "soft";
  }
) {
  const v = props.variant ?? "soft";
  const cls =
    v === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : v === "ghost"
      ? "bg-transparent text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200"
      : "bg-slate-100 text-slate-900 hover:bg-slate-200";

  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        cls,
        props.className
      )}
    />
  );
}

function DividerLabel(props: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-slate-200" />
      <div className="text-[11px] uppercase tracking-wider text-slate-400">
        {props.label}
      </div>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

/* ===================== Validation ===================== */
type Errors = Partial<
  Record<
    | "storeSelect"
    | "storeName"
    | "storeType"
    | "locSelect"
    | "locName"
    | "locCode"
    | "locType",
    string
  >
>;

type Touched = Partial<Record<keyof Errors, boolean>>;

function mergeErrors(a: Errors, b: Errors): Errors {
  return { ...a, ...b };
}

/* ===================== Page ===================== */
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

  useEffect(() => {
    if (routeCompanyId && companyId !== routeCompanyId) setCompanyId(routeCompanyId);
    if (routeBranchId && branchId !== routeBranchId) setBranchId(routeBranchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCompanyId, routeBranchId]);

  const effectiveCompanyId = routeCompanyId ?? companyId;
  const effectiveBranchId = routeBranchId ?? branchId;

  const roles = useMemo(() => tryGetRolesFromJwt(), []);
  const roleLabel = useMemo(() => (roles.length ? roles.join(", ") : "Unknown role"), [roles]);

  const [stores, setStores] = useState<Store[]>([]);
  const [locs, setLocs] = useState<StockLocation[]>([]);

  const [storeTypes, setStoreTypes] = useState<EnumOption[]>([]);
  const [stockTypes, setStockTypes] = useState<EnumOption[]>([]);

  const storeTypesFiltered = useMemo(
    () => filterEnumOptionsByRole("StoreType", storeTypes, roles),
    [storeTypes, roles]
  );
  const stockTypesFiltered = useMemo(
    () => filterEnumOptionsByRole("LocationType", stockTypes, roles),
    [stockTypes, roles]
  );

  const [storeType, setStoreType] = useState<number | null>(null);
  const [stockType, setStockType] = useState<number | null>(null);

  const [storeName, setStoreName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [locName, setLocName] = useState("");
  const [locCode, setLocCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Touched>({});

  const [showCreateStore, setShowCreateStore] = useState(false);
  const [showCreateLoc, setShowCreateLoc] = useState(false);

  const canContinue = useMemo(() => !!storeId && !!stockLocationId, [storeId, stockLocationId]);
  const selectedStore = useMemo(() => stores.find((s) => (s as any).id === storeId) ?? null, [stores, storeId]);
  const selectedLoc = useMemo(() => locs.find((l) => (l as any).id === stockLocationId) ?? null, [locs, stockLocationId]);

  function validateStoreCreate(): Errors {
    const e: Errors = {};
    if (!storeName.trim()) e.storeName = "Store name is required.";
    if (storeType == null || Number.isNaN(storeType)) e.storeType = "Store type is required.";
    return e;
  }

  function validateLocationCreate(): Errors {
    const e: Errors = {};
    if (!locName.trim()) e.locName = "Location name is required.";
    if (!locCode.trim()) e.locCode = "Location code is required.";
    if (stockType == null || Number.isNaN(stockType)) e.locType = "Location type is required.";
    return e;
  }

  function validateContinue(): Errors {
    const e: Errors = {};
    if (!storeId) e.storeSelect = "Select a store to continue.";
    if (!stockLocationId) e.locSelect = "Select a stock location to continue.";
    return e;
  }

  /* ===== Load enums ===== */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const st = await http.get<EnumOption[]>("/lookups/store-location-types");
        const lt = await http.get<EnumOption[]>("/lookups/stock-location-types");

        if (cancelled) return;

        const stArr = Array.isArray(st.data) ? st.data : [];
        const ltArr = Array.isArray(lt.data) ? lt.data : [];

        setStoreTypes(stArr);
        setStockTypes(ltArr);
      } catch (e: any) {
        setBannerError(e?.message ?? "Failed to load enum lookups.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep selected enum values valid after filtering
  useEffect(() => {
    if (storeTypesFiltered.length) {
      const current = storeType;
      const ok = current != null && storeTypesFiltered.some((x) => x.value === current);
      if (!ok) setStoreType(storeTypesFiltered[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeTypesFiltered]);

  useEffect(() => {
    if (stockTypesFiltered.length) {
      const current = stockType;
      const ok = current != null && stockTypesFiltered.some((x) => x.value === current);
      if (!ok) setStockType(stockTypesFiltered[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockTypesFiltered]);

  /* ===== Load data ===== */
  async function load() {
    if (!effectiveCompanyId || !effectiveBranchId) return;

    setIsLoading(true);
    setBannerError(null);

    try {
      const sRaw = await storesApi.list(effectiveCompanyId, effectiveBranchId);
      const sData = typeof sRaw === "string" ? JSON.parse(sRaw) : sRaw;
      const sArr = (Array.isArray(sData) ? sData : []).map(normalizeStore);
      setStores(sArr);

      const lRaw = await stockLocationsApi.list(effectiveCompanyId, effectiveBranchId);
      const lData = typeof lRaw === "string" ? JSON.parse(lRaw) : lRaw;
      const lArr = (Array.isArray(lData) ? lData : []).map(normalizeStockLocation);
      setLocs(lArr);

      const storeIsValid = storeId ? sArr.some((x) => (x as any).id === storeId) : false;
      if (!storeIsValid) setStoreId(((sArr[0] as any)?.id ?? null) as any);

      const locIsValid = stockLocationId ? lArr.some((x) => (x as any).id === stockLocationId) : false;
      if (!locIsValid) setStockLocationId(((lArr[0] as any)?.id ?? null) as any);
    } catch (e: any) {
      setBannerError(e?.message ?? "Failed to load store/location.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCompanyId, effectiveBranchId]);

  /* ===== Actions ===== */
  async function createStore() {
    if (!effectiveCompanyId || !effectiveBranchId) return;

    setTouched((t) => ({ ...t, storeName: true, storeType: true }));
    const e = validateStoreCreate();
    setErrors((prev) => mergeErrors(prev, e));
    if (Object.keys(e).length) {
      setBannerError("Please fix the highlighted Store fields.");
      return;
    }

    setBusy(true);
    setBannerError(null);

    try {
      const created = await storesApi.create(effectiveCompanyId, effectiveBranchId, {
        name: storeName.trim(),
        code: storeCode.trim() || null,
        locationType: Number(storeType),
      });

      const createdId = (created as any)?.id ?? (created as any)?.Id ?? null;
      setStoreId(createdId);

      setStoreName("");
      setStoreCode("");
      setShowCreateStore(false);
      setErrors((prev) => ({ ...prev, storeName: undefined, storeType: undefined }));

      await load();
    } catch (e: any) {
      setBannerError(e?.response?.data?.message ?? e?.message ?? "Failed to create store.");
    } finally {
      setBusy(false);
    }
  }

  async function createLocation() {
    if (!effectiveCompanyId || !effectiveBranchId) return;

    setTouched((t) => ({ ...t, locName: true, locCode: true, locType: true }));
    const e = validateLocationCreate();
    setErrors((prev) => mergeErrors(prev, e));
    if (Object.keys(e).length) {
      setBannerError("Please fix the highlighted Stock Location fields.");
      return;
    }

    setBusy(true);
    setBannerError(null);

    try {
      const created = await stockLocationsApi.create(effectiveCompanyId, effectiveBranchId, {
        name: locName.trim(),
        code: locCode.trim(),
        locationType: Number(stockType),
      });

      const createdId = (created as any)?.id ?? (created as any)?.Id ?? null;
      setStockLocationId(createdId);

      setLocName("");
      setLocCode("");
      setShowCreateLoc(false);
      setErrors((prev) => ({ ...prev, locName: undefined, locCode: undefined, locType: undefined }));

      await load();
    } catch (e: any) {
      setBannerError(e?.response?.data?.message ?? e?.message ?? "Failed to create stock location.");
    } finally {
      setBusy(false);
    }
  }

  function continueNext() {
    setTouched((t) => ({ ...t, storeSelect: true, locSelect: true }));
    const e = validateContinue();
    setErrors((prev) => mergeErrors(prev, e));
    if (Object.keys(e).length) {
      setBannerError("Select both Store and Stock Location to continue.");
      return;
    }
    nav("/dashboard", { replace: true });
  }

  /* ===== Guards ===== */
  if (!effectiveCompanyId) return <div className="p-4">Missing companyId.</div>;
  if (!effectiveBranchId) return <div className="p-4">Branch not selected.</div>;

  if (!isGuid(effectiveCompanyId) || !isGuid(effectiveBranchId)) {
    return (
      <div className="p-4">
        Invalid route params. companyId/branchId must be GUIDs.
        <div className="mt-2 font-mono text-xs text-slate-700">
          companyId: {effectiveCompanyId}
          <br />
          branchId: {effectiveBranchId}
        </div>
      </div>
    );
  }

  const storeSelectInvalid = !!errors.storeSelect && !!touched.storeSelect;
  const locSelectInvalid = !!errors.locSelect && !!touched.locSelect;

  const storeNameInvalid = !!errors.storeName && !!touched.storeName;
  const storeTypeInvalid = !!errors.storeType && !!touched.storeType;

  const locNameInvalid = !!errors.locName && !!touched.locName;
  const locCodeInvalid = !!errors.locCode && !!touched.locCode;
  const locTypeInvalid = !!errors.locType && !!touched.locType;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-slate-900/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={canContinue ? "ok" : "warn"}>
                  {canContinue ? "Ready" : "Setup required"}
                </Pill>
                <Pill tone="muted">Role: {roleLabel}</Pill>
                {isLoading ? <Pill>Loading</Pill> : <Pill tone="muted">Branch setup</Pill>}
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                Store & Stock Location Setup
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Select existing records or create new ones for this branch — then continue.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={load} disabled={busy}>
                Refresh
              </Button>
              <Button variant="primary" onClick={continueNext} disabled={!canContinue || busy}>
                Continue
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 px-4 py-3">
              <div className="text-[11px] font-semibold text-slate-500">Selected Store</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {(selectedStore as any)?.name ?? "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 px-4 py-3">
              <div className="text-[11px] font-semibold text-slate-500">Selected Stock Location</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {(selectedLoc as any)?.name ?? "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 px-4 py-3">
              <div className="text-[11px] font-semibold text-slate-500">Next Step</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {canContinue ? "Continue to Dashboard" : "Complete both selections"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        {bannerError ? <Banner tone="danger" title="Action needed" message={bannerError} /> : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main */}
          <div className="lg:col-span-8 space-y-6">
            {/* STORE */}
            <SectionCard
              title="Store"
              subtitle="Pick an existing store or create a new one."
              right={<Pill>{stores.length} stores</Pill>}
            >
              <div className="grid gap-4">
                <Field
                  label="Select Store"
                  hint="Required to continue"
                  required
                  error={storeSelectInvalid ? errors.storeSelect ?? null : null}
                >
                  <Select
                    value={(storeId as any) ?? ""}
                    onChange={(e) => {
                      setStoreId((e.target.value || null) as any);
                      setTouched((t) => ({ ...t, storeSelect: true }));
                      setErrors((prev) => ({ ...prev, storeSelect: undefined }));
                    }}
                    invalid={storeSelectInvalid}
                    disabled={isLoading || busy}
                  >
                    <option value="">Select store…</option>
                    {stores.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <DividerLabel label="Create new store" />

                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Create a new Store</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Clean setup now makes GRN, transfers, and reporting smoother later.
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setShowCreateStore((v) => !v)}
                      disabled={isLoading || busy}
                    >
                      {showCreateStore ? "Hide" : "Open"}
                    </Button>
                  </div>

                  {showCreateStore ? (
                    <div className="mt-4 grid gap-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field
                          label="Store Name"
                          required
                          error={storeNameInvalid ? errors.storeName ?? null : null}
                          helper="Example: Main Store, Bole Branch, Kitchen Outlet"
                        >
                          <Input
                            value={storeName}
                            onChange={(e) => {
                              setStoreName(e.target.value);
                              setTouched((t) => ({ ...t, storeName: true }));
                              if (e.target.value.trim()) setErrors((prev) => ({ ...prev, storeName: undefined }));
                            }}
                            onBlur={() => {
                              setTouched((t) => ({ ...t, storeName: true }));
                              setErrors((prev) => mergeErrors(prev, validateStoreCreate()));
                            }}
                            placeholder="e.g. Main Store"
                            invalid={storeNameInvalid}
                          />
                        </Field>

                        <Field label="Store Code" hint="Optional" helper="Example: STR-001, STR-BOLE">
                          <Input
                            value={storeCode}
                            onChange={(e) => setStoreCode(e.target.value)}
                            placeholder="e.g. STR-001"
                          />
                        </Field>
                      </div>

                      <Field
                        label={
                          <span className="inline-flex items-center gap-2">
                            Store Type
                            <span className="text-[10px] uppercase tracking-wider text-slate-400">Enum</span>
                          </span>
                        }
                        hint="Role-filtered"
                        required
                        error={storeTypeInvalid ? errors.storeType ?? null : null}
                        helper="Some types may be hidden based on your role (e.g., HQ/Central)."
                      >
                        <Select
                          value={storeType?.toString() ?? ""}
                          onChange={(e) => {
                            setStoreType(Number(e.target.value));
                            setTouched((t) => ({ ...t, storeType: true }));
                            setErrors((prev) => ({ ...prev, storeType: undefined }));
                          }}
                          onBlur={() => {
                            setTouched((t) => ({ ...t, storeType: true }));
                            setErrors((prev) => mergeErrors(prev, validateStoreCreate()));
                          }}
                          invalid={storeTypeInvalid}
                        >
                          <option value="" disabled>
                            Select Store Type…
                          </option>
                          {(storeTypesFiltered?.length ? storeTypesFiltered : [{ value: 1, text: "Default" }]).map(
                            (t) => (
                              <option key={t.value} value={t.value.toString()}>
                                {t.text}
                              </option>
                            )
                          )}
                        </Select>
                      </Field>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="text-xs text-slate-500">We’ll auto-select the newly created store.</div>
                        <Button onClick={createStore} disabled={busy || isLoading}>
                          Create Store
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>

            {/* STOCK LOCATION */}
            <SectionCard
              title="Stock Location"
              subtitle="Pick an existing stock location or create a new one."
              right={<Pill>{locs.length} locations</Pill>}
            >
              <div className="grid gap-4">
                <Field
                  label="Select Stock Location"
                  hint="Required to continue"
                  required
                  error={locSelectInvalid ? errors.locSelect ?? null : null}
                >
                  <Select
                    value={(stockLocationId as any) ?? ""}
                    onChange={(e) => {
                      setStockLocationId((e.target.value || null) as any);
                      setTouched((t) => ({ ...t, locSelect: true }));
                      setErrors((prev) => ({ ...prev, locSelect: undefined }));
                    }}
                    invalid={locSelectInvalid}
                    disabled={isLoading || busy}
                  >
                    <option value="">Select stock location…</option>
                    {locs.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <DividerLabel label="Create new location" />

                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Create a new Stock Location</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Codes should be consistent (LOC-###) to simplify transfers & reports.
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setShowCreateLoc((v) => !v)}
                      disabled={isLoading || busy}
                    >
                      {showCreateLoc ? "Hide" : "Open"}
                    </Button>
                  </div>

                  {showCreateLoc ? (
                    <div className="mt-4 grid gap-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field
                          label="Location Name"
                          required
                          error={locNameInvalid ? errors.locName ?? null : null}
                          helper="Example: Store Backroom, Main Warehouse, Production Room"
                        >
                          <Input
                            value={locName}
                            onChange={(e) => {
                              setLocName(e.target.value);
                              setTouched((t) => ({ ...t, locName: true }));
                              if (e.target.value.trim()) setErrors((prev) => ({ ...prev, locName: undefined }));
                            }}
                            onBlur={() => {
                              setTouched((t) => ({ ...t, locName: true }));
                              setErrors((prev) => mergeErrors(prev, validateLocationCreate()));
                            }}
                            placeholder="e.g. Store Backroom"
                            invalid={locNameInvalid}
                          />
                        </Field>

                        <Field
                          label="Location Code"
                          required
                          error={locCodeInvalid ? errors.locCode ?? null : null}
                          helper="Example: LOC-001, LOC-WH-01"
                        >
                          <Input
                            value={locCode}
                            onChange={(e) => {
                              setLocCode(e.target.value);
                              setTouched((t) => ({ ...t, locCode: true }));
                              if (e.target.value.trim()) setErrors((prev) => ({ ...prev, locCode: undefined }));
                            }}
                            onBlur={() => {
                              setTouched((t) => ({ ...t, locCode: true }));
                              setErrors((prev) => mergeErrors(prev, validateLocationCreate()));
                            }}
                            placeholder="e.g. LOC-001"
                            invalid={locCodeInvalid}
                          />
                        </Field>
                      </div>

                      <Field
                        label={
                          <span className="inline-flex items-center gap-2">
                            Location Type
                            <span className="text-[10px] uppercase tracking-wider text-slate-400">Enum</span>
                          </span>
                        }
                        hint="Role-filtered"
                        required
                        error={locTypeInvalid ? errors.locType ?? null : null}
                        helper="For store-side roles, only store-facing types may appear."
                      >
                        <Select
                          value={stockType?.toString() ?? ""}
                          onChange={(e) => {
                            setStockType(Number(e.target.value));
                            setTouched((t) => ({ ...t, locType: true }));
                            setErrors((prev) => ({ ...prev, locType: undefined }));
                          }}
                          onBlur={() => {
                            setTouched((t) => ({ ...t, locType: true }));
                            setErrors((prev) => mergeErrors(prev, validateLocationCreate()));
                          }}
                          invalid={locTypeInvalid}
                        >
                          <option value="" disabled>
                            Select Location Type…
                          </option>
                          {(stockTypesFiltered?.length ? stockTypesFiltered : [{ value: 1, text: "Store" }]).map(
                            (t) => (
                              <option key={t.value} value={t.value.toString()}>
                                {t.text}
                              </option>
                            )
                          )}
                        </Select>
                      </Field>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="text-xs text-slate-500">We’ll auto-select the newly created location.</div>
                        <Button onClick={createLocation} disabled={busy || isLoading}>
                          Create Location
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="sticky top-6 space-y-6">
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Setup Checklist</div>
                  <Pill tone="muted">Status</Pill>
                </div>
                <div className="mt-1 text-xs text-slate-500">Role: {roleLabel}</div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-700">Store selected</div>
                    <Pill tone={storeId ? "ok" : "warn"}>{storeId ? "Done" : "Pending"}</Pill>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-700">Stock location selected</div>
                    <Pill tone={stockLocationId ? "ok" : "warn"}>{stockLocationId ? "Done" : "Pending"}</Pill>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3">
                  <div className="text-[11px] font-semibold text-slate-500">Selected</div>
                  <div className="mt-2 text-sm text-slate-900 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">Store</span>
                      <span className="font-semibold">{(selectedStore as any)?.name ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">Location</span>
                      <span className="font-semibold">{(selectedLoc as any)?.name ?? "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <Button variant="ghost" onClick={load} disabled={busy}>
                    Refresh data
                  </Button>
                  <Button variant="primary" onClick={continueNext} disabled={!canContinue || busy}>
                    Continue
                  </Button>
                  {!canContinue ? (
                    <div className="text-xs text-slate-500 text-center">Select both items to enable Continue.</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 shadow-sm">
                <div className="text-sm font-semibold">Pro Tip</div>
                <div className="mt-2 text-sm text-white/85 leading-relaxed">
                  Use consistent naming + codes now. It makes FIFO valuation, GRN posting, transfers, and reporting much
                  cleaner later.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer bar */}
        <div className="mt-8">
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Pill tone={canContinue ? "ok" : "warn"}>{canContinue ? "All set" : "Needs attention"}</Pill>
              <div className="text-sm text-slate-700">
                {canContinue ? "You can proceed to the dashboard." : "Please select both Store and Stock Location."}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={load} disabled={busy}>
                Refresh
              </Button>
              <Button variant="primary" onClick={continueNext} disabled={!canContinue || busy}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
