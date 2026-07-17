// src/features/sales/pages/ExternalSalesImportPage.tsx

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  RefreshCcw,
  Upload,
} from "lucide-react";

import { useAppScope } from "../../../app/useAppScope";
import { salesApi } from "../api/salesApi";
import {
  posApi,
  tryGetStoreId,
  type PosStoreDto,
} from "../../pos/api/posApi";
import { usePosSession } from "../../pos/hooks/usePosSession";
import type { ImportExternalSalesResultDto } from "../api/salesTypes";
import {
  Alert,
  Btn,
  Card,
  Field,
  PageShell,
  Spinner,
} from "../../company/onboarding/components/company.ui";

const PLATFORM_OPTIONS = [
  { value: "CNET", label: "CNET" },
  { value: "EXCEL", label: "Excel" },
  { value: "OTHER_POS", label: "Other POS" },
];

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

function extractApiError(err: unknown, fallback = "Request failed."): string {
  const e = err as any;
  const data = e?.response?.data;

  if (!data) return e?.message ?? fallback;
  if (typeof data === "string") return data;

  return data?.detail ?? data?.error ?? data?.message ?? data?.title ?? fallback;
}

function isValidGuid(value?: string | null): boolean {
  return Boolean(value && value.trim() && value !== EMPTY_GUID);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function storeLabel(store: PosStoreDto): string {
  return store.code ? `${store.name} (${store.code})` : store.name;
}

function getIssueStockLocationId(store: PosStoreDto | null): string {
  const raw =
    (store as any)?.issueStockLocationId ??
    (store as any)?.IssueStockLocationId ??
    "";

  return String(raw || "");
}

function getIssueStockLocationLabel(store: PosStoreDto | null): string {
  const label =
    (store as any)?.issueStockLocationName ??
    (store as any)?.IssueStockLocationName ??
    (store as any)?.issueLocationName ??
    (store as any)?.IssueLocationName ??
    "";

  return String(label || "").trim() || "Not configured";
}

export default function ExternalSalesImportPage() {
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(
  () => ({
    companyId,
    branchId,
  }),
  [companyId, branchId],
);
  const {
    loading: sessionLoading,
    isOpen: isSessionOpen,
    refresh: refreshSession,
  } = usePosSession(scope);

  const [stores, setStores] = useState<PosStoreDto[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeId, setStoreId] = useState(() => tryGetStoreId() ?? "");

  const [salesDate, setSalesDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [sourcePlatform, setSourcePlatform] = useState("CNET");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportExternalSalesResultDto | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const selectedStore = useMemo(
    () => stores.find((x) => x.id === storeId) ?? null,
    [stores, storeId]
  );

  const locationId = useMemo(
    () => getIssueStockLocationId(selectedStore),
    [selectedStore]
  );

  const missingScope = !companyId || !branchId;
  const missingSession = !sessionLoading && !isSessionOpen;
  const missingStore = !storesLoading && !isValidGuid(storeId);
  const missingIssueLocation =
    Boolean(selectedStore) && !isValidGuid(locationId);

  const canImport = useMemo(
    () =>
      Boolean(
        companyId &&
          branchId &&
          isSessionOpen &&
          isValidGuid(storeId) &&
          isValidGuid(locationId) &&
          salesDate &&
          file &&
          !busy &&
          !sessionLoading &&
          !storesLoading
      ),
    [
      companyId,
      branchId,
      isSessionOpen,
      storeId,
      locationId,
      salesDate,
      file,
      busy,
      sessionLoading,
      storesLoading,
    ]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStores() {
      setStoresLoading(true);
      setError(null);

      try {
        const rows: PosStoreDto[] = await posApi.stores(scope);

        if (cancelled) return;

        const activeStores = rows
          .filter((x) => x.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name));

        setStores(activeStores);

        const activeStoreId = tryGetStoreId() ?? "";

        if (activeStoreId) {
          setStoreId(activeStoreId);
        }
      } catch (e) {
        if (!cancelled) {
          setError(extractApiError(e, "Unable to load POS stores."));
        }
      } finally {
        if (!cancelled) setStoresLoading(false);
      }
    }

    void loadStores();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setStoreId(tryGetStoreId() ?? "");
  }, [isSessionOpen]);

  async function refreshPageState() {
    setError(null);
    setResult(null);
    setStoreId(tryGetStoreId() ?? "");

    await refreshSession();

    try {
      setStoresLoading(true);
      const rows: PosStoreDto[] = await posApi.stores(scope);
      setStores(
        rows
          .filter((x) => x.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      setError(extractApiError(e, "Unable to refresh POS stores."));
    } finally {
      setStoresLoading(false);
    }
  }

  async function submit() {
    setError(null);
    setResult(null);

    const activeStoreId = tryGetStoreId() ?? storeId;
    const activeStore =
      stores.find((x) => x.id === activeStoreId) ?? selectedStore;
    const issueLocationId = getIssueStockLocationId(activeStore);

    setStoreId(activeStoreId);

    if (!companyId) {
      return setError("Company scope is missing. Please select a company.");
    }

    if (!branchId) {
      return setError("Branch scope is missing. Please select a branch.");
    }

    if (!isSessionOpen) {
      return setError("Please open an active POS session first.");
    }

    if (!isValidGuid(activeStoreId)) {
      return setError("POS/store is missing. Please select a POS/store first.");
    }

    if (!activeStore) {
      return setError("The selected POS/store could not be found. Refresh and try again.");
    }

    if (!isValidGuid(issueLocationId)) {
      return setError(
        "The selected POS/store does not have an issue stock location configured."
      );
    }

    if (!salesDate) {
      return setError("Sales date is required.");
    }

    if (!file) {
      return setError("Select an Excel or CSV sales file.");
    }

    setBusy(true);

    try {
      const response = await salesApi.importExternalSales(companyId, branchId, {
        storeId: activeStoreId,
        locationId: issueLocationId,
        salesDate,
        sourcePlatform,
        file,
        replaceExisting,
      });

      setResult((response as any).data ?? response);
    } catch (e) {
      setError(extractApiError(e, "Import failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="External Sales Import"
      subtitle="Import CNET or third-party POS sales using the active POS/store issue location."
    >
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <Card
            title="Import Settings"
            subtitle="Store and consumption location are locked to the active POS session."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {missingScope && (
                <Alert
                  tone="danger"
                  title="Missing scope"
                  message="Please select a company and branch before importing sales."
                />
              )}

              {sessionLoading && (
                <Alert
                  tone="info"
                  title="Checking POS session"
                  message="Loading active POS session."
                />
              )}

              {missingSession && (
                <Alert
                  tone="danger"
                  title="No active POS session"
                  message="Please open a POS session before importing external sales."
                />
              )}

              {missingStore && (
                <Alert
                  tone="danger"
                  title="Missing POS/store"
                  message="Please select a POS/store from POS Session Control first."
                />
              )}

              {missingIssueLocation && (
                <Alert
                  tone="danger"
                  title="Missing issue location"
                  message="The selected POS/store does not have an issue stock location configured."
                />
              )}

              <Field label="Active POS/store">
                <input
                  value={selectedStore ? storeLabel(selectedStore) : "No POS/store selected"}
                  disabled
                  style={selectStyle}
                />
              </Field>

              <Field
                label="Sales consumption location"
                hint="Automatically uses the selected store issue stock location to prevent ERP mismatch."
              >
                <input
                  value={selectedStore ? getIssueStockLocationLabel(selectedStore) : "No store selected"}
                  disabled
                  style={selectStyle}
                />
              </Field>

              <Field label="Source platform">
                <select
                  value={sourcePlatform}
                  onChange={(e) => setSourcePlatform(e.target.value)}
                  style={selectStyle}
                  disabled={busy}
                >
                  {PLATFORM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sales date" hint="Imported sales will be posted under this business date.">
                <input
                  type="date"
                  value={salesDate}
                  onChange={(e) => setSalesDate(e.target.value)}
                  style={selectStyle}
                  disabled={busy}
                />
              </Field>

              <Field label="Sales file" hint="Accepted formats: .xlsx, .xls, .csv">
                <label style={uploadBoxStyle(file)}>
                  <FileSpreadsheet
                    size={20}
                    color={file ? "#6366f1" : "var(--color-text-tertiary)"}
                    style={{ flexShrink: 0 }}
                  />

                  <span
                    style={{
                      fontSize: 13,
                      color: file ? "#4f46e5" : "var(--color-text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file ? file.name : "Click to choose a file…"}
                  </span>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: "none" }}
                    disabled={busy}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </Field>

              <label style={checkboxCardStyle}>
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  disabled={busy}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />

                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                    Replace existing import
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                    Re-import records for the same platform, store, branch, and sales date.
                  </div>
                </div>
              </label>

              {error && <Alert tone="danger" title="Import error" message={error} />}

              <div style={{ display: "flex", gap: 10 }}>
                <Btn
                  variant="soft"
                  onClick={refreshPageState}
                  disabled={busy || sessionLoading || storesLoading}
                  style={{ flex: "0 0 auto", gap: 8 }}
                >
                  <RefreshCcw size={15} />
                  Refresh
                </Btn>

                <Btn
                  variant="primary"
                  onClick={submit}
                  disabled={!canImport}
                  style={{ flex: 1, justifyContent: "center", gap: 8 }}
                >
                  {busy ? (
                    <>
                      <Spinner /> Processing…
                    </>
                  ) : (
                    <>
                      <Upload size={15} /> Import External Sales
                    </>
                  )}
                </Btn>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <Card
            title="Import Result"
            subtitle="COGS is backend-owned. Inventory issues appear as pending if posting cannot complete."
          >
            {!result ? (
              <EmptyState />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <ResultBanner result={result} />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  <MetricCard label="Imported lines" value={result.importedLines} />
                  <MetricCard label="Skipped lines" value={result.skippedLines} />
                  <MetricCard label="Total quantity" value={result.totalQuantity} />
                  <MetricCard label="Total amount" value={formatMoney(result.totalAmount)} accent />
                </div>

                {result.warnings?.length > 0 && <WarningsPanel warnings={result.warnings} />}

                {result.succeeded && (
                  <Alert
                    tone="success"
                    title="Import complete"
                    message="Sales were imported using the active POS/store issue location."
                  />
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        color: "var(--color-text-tertiary)",
        textAlign: "center",
        gap: 12,
      }}
    >
      <FileSpreadsheet size={40} strokeWidth={1.2} />
      <div style={{ fontSize: 14, fontWeight: 500 }}>No results yet</div>
      <div style={{ fontSize: 12 }}>
        Configure import settings and upload a sales file to see results here.
      </div>
    </div>
  );
}

function ResultBanner({ result }: { result: ImportExternalSalesResultDto }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: "var(--border-radius-md)",
        background: result.succeeded ? "#f0fdf4" : "#fef2f2",
        border: result.succeeded ? "1px solid #bbf7d0" : "1px solid #fecaca",
      }}
    >
      {result.succeeded ? (
        <CheckCircle size={18} color="#16a34a" style={{ flexShrink: 0 }} />
      ) : (
        <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
      )}

      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: result.succeeded ? "#15803d" : "#b91c1c",
          }}
        >
          {result.succeeded ? "Import successful" : "Import failed"}
        </div>

        {result.succeeded && result.saleNo && (
          <div style={{ fontSize: 11, color: "#16a34a", marginTop: 1 }}>
            Sale No: {result.saleNo}
          </div>
        )}

        {!result.succeeded && result.error && (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 1 }}>
            {result.error}
          </div>
        )}
      </div>
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  return (
    <div style={{ border: "1px solid #fde68a", borderRadius: "var(--border-radius-md)", overflow: "hidden" }}>
      <div
        style={{
          padding: "8px 12px",
          background: "#fffbeb",
          borderBottom: "1px solid #fde68a",
          fontSize: 12,
          fontWeight: 600,
          color: "#92400e",
        }}
      >
        {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
      </div>

      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {warnings.map((warning, index) => (
          <div
            key={`${warning}-${index}`}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              color: "#78350f",
              borderBottom: index < warnings.length - 1 ? "1px solid #fef3c7" : "none",
            }}
          >
            {warning}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "var(--border-radius-md)",
        background: accent ? "#f5f3ff" : "var(--color-background-secondary)",
        border: accent ? "1px solid #e0e7ff" : "1px solid var(--color-border-tertiary)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: accent ? "#6366f1" : "var(--color-text-tertiary)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: accent ? "#4f46e5" : "var(--color-text-primary)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function uploadBoxStyle(file: File | null): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    border: file ? "1.5px solid #6366f1" : "1px dashed var(--color-border-tertiary)",
    borderRadius: "var(--border-radius-md)",
    background: file ? "#f5f3ff" : "var(--color-background-secondary)",
    cursor: "pointer",
    transition: "border-color 0.15s",
  };
}

const checkboxCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  padding: "10px 14px",
  borderRadius: "var(--border-radius-md)",
  background: "var(--color-background-secondary)",
  border: "1px solid var(--color-border-tertiary)",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-sans)",
  padding: "8px 12px",
  borderRadius: "var(--border-radius-md)",
  fontSize: 13,
  border: "1px solid var(--color-border-tertiary)",
  background: "var(--color-background-primary)",
  color: "var(--color-text-primary)",
  outline: "none",
  appearance: "auto",
};