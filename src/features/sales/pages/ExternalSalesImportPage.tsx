// src/modules/sales/pages/ExternalSalesImportPage.tsx

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { AlertCircle, CheckCircle, FileSpreadsheet, Upload } from "lucide-react";
import { useAppScope } from "../../../app/useAppScope";
import { salesApi } from "../api/salesApi";
import type { ImportExternalSalesResultDto, StockLocationDto } from "../api/salesTypes";
import { Alert, Btn, Card, Field, PageShell, Spinner } from "../../company/onboarding/components/company.ui";

const PLATFORM_OPTIONS = [
  { value: "CNET", label: "CNET" },
  { value: "EXCEL", label: "Excel" },
  { value: "OTHER_POS", label: "Other POS" },
];

function unwrapArray<T>(raw: unknown): T[] {
  const value = (raw as any)?.data ?? raw;
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.results)) return value.results;
  return [];
}

function extractApiError(err: unknown, fallback = "Request failed."): string {
  const e = err as any;
  const data = e?.response?.data;
  if (!data) return e?.message ?? fallback;
  if (typeof data === "string") return data;
  return data?.detail ?? data?.error ?? data?.message ?? data?.title ?? fallback;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

export default function ExternalSalesImportPage() {
  const { companyId, branchId } = useAppScope();

  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationId, setLocationId] = useState("");

  const [salesDate, setSalesDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourcePlatform, setSourcePlatform] = useState("CNET");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportExternalSalesResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const missingScope = !companyId || !branchId;

  const canImport = useMemo(
    () => Boolean(companyId && branchId && locationId && file && !busy && !locationsLoading),
    [companyId, branchId, locationId, file, busy, locationsLoading]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      setError(null);
      setLocations([]);
      setLocationId("");

      if (!companyId || !branchId) return;

      setLocationsLoading(true);

      try {
        const rows = await salesApi.listStockLocations(companyId,{branchId});
        if (cancelled) return;

        const active = unwrapArray<StockLocationDto>(rows)
          .filter((x) => x.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name));

        setLocations(active);

        const defaultLocation =
          active.find((x: any) => x.isDefaultIssue || x.isDefault || x.canSell) ?? active[0];

        if (defaultLocation) setLocationId(defaultLocation.id);
      } catch (e) {
        if (!cancelled) setError(extractApiError(e, "Unable to load stock locations."));
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    }

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  async function submit() {
    setError(null);
    setResult(null);

    if (!companyId) return setError("Company scope is missing. Please select a company.");
    if (!branchId) return setError("Branch scope is missing. Please select a branch.");
    if (!locationId) return setError("Select the external sales source location.");
    if (!file) return setError("Select an Excel workbook (.xlsx / .xls).");

    setBusy(true);

    try {
      const response = await salesApi.importExternalSales(companyId, branchId, {
        locationId,
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
      subtitle="Import CNET or third-party POS sales. Backend creates sales and handles COGS automatically or marks inventory as pending."
    >
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 380px", minWidth: 0 }}>
          <Card title="Import Settings" subtitle="Configure source, date, location, and workbook.">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {missingScope && (
                <Alert
                  tone="danger"
                  title="Missing scope"
                  message="Please select a company and branch before importing sales."
                />
              )}

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

              <Field
                label="External source location"
                hint="Used as the external sale source/import location. Recipe consumption still resolves from Menu Item or Category configuration."
              >
                {locationsLoading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                    <Spinner />
                    <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      Loading locations…
                    </span>
                  </div>
                ) : (
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    disabled={busy || locations.length === 0 || missingScope}
                    style={selectStyle}
                  >
                    {locations.length === 0 ? (
                      <option value="">No stock locations found</option>
                    ) : (
                      locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code ? `${location.name} (${location.code})` : location.name}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </Field>

              <Field label="Excel workbook" hint="Accepted formats: .xlsx, .xls">
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
                    accept=".xlsx,.xls"
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
                    Re-import records for the same platform, branch, and sales date.
                  </div>
                </div>
              </label>

              {error && <Alert tone="danger" title="Import error" message={error} />}

              <Btn
                variant="primary"
                onClick={submit}
                disabled={!canImport}
                style={{ width: "100%", justifyContent: "center", gap: 8 }}
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
          </Card>
        </div>

        <div style={{ flex: "1 1 380px", minWidth: 0 }}>
          <Card
            title="Import Result"
            subtitle="COGS is now backend-owned. Failed inventory posting appears as Inventory Pending in Sales Register."
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
                    message="Sales were imported. Inventory/COGS posting is handled by backend workflow; review Sales Register for any inventory-pending records."
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
        Configure import settings and upload a workbook to see results here.
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
        <div style={{ fontSize: 13, fontWeight: 600, color: result.succeeded ? "#15803d" : "#b91c1c" }}>
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