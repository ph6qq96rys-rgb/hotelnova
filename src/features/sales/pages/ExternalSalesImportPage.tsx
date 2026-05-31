// src/modules/sales/pages/ExternalSalesImportPage.tsx

import { useEffect, useState } from "react";
import type React from "react";
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { salesApi } from "../api/salesApi";
import type { Guid, ImportExternalSalesResultDto, StockLocationDto } from "../api/salesTypes";
import {
  PageShell, Card, Btn, Alert, Field, Spinner,
} from "../../company/onboarding/components/company.ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

function useAppScope(): { companyId: Guid; branchId: Guid } {
  return {
    companyId: localStorage.getItem("companyId") || "",
    branchId:  localStorage.getItem("branchId")  || "",
  };
}

function unwrapArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.items))   return r.items   as T[];
  if (Array.isArray(r.data))    return r.data     as T[];
  if (Array.isArray(r.results)) return r.results  as T[];
  return [];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency", currency: "USD",
  }).format(value || 0);
}

const PLATFORM_OPTIONS = [
  { value: "CNET",      label: "CNET"      },
  { value: "EXCEL",     label: "Excel"     },
  { value: "OTHER_POS", label: "Other POS" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExternalSalesImportPage() {
  const { companyId, branchId } = useAppScope();

  const [locations,       setLocations]       = useState<StockLocationDto[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationId,      setLocationId]      = useState("");
  const [salesDate,       setSalesDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [sourcePlatform,  setSourcePlatform]  = useState("CNET");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [file,            setFile]            = useState<File | null>(null);
  const [busy,            setBusy]            = useState(false);
  const [result,          setResult]          = useState<ImportExternalSalesResultDto | null>(null);
  const [error,           setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !branchId) return;
    setLocationsLoading(true);
    salesApi.stockLocations(companyId, branchId)
      .then((r) => {
        const data = unwrapArray<StockLocationDto>(r.data);
        setLocations(data);
        if (data.length > 0) setLocationId(data[0].id);
      })
      .finally(() => setLocationsLoading(false));
  }, [companyId, branchId]);

  async function submit() {
    setError(null);
    setResult(null);
    if (!locationId) { setError("Select the consumption stock location."); return; }
    if (!file)       { setError("Select an Excel workbook (.xlsx / .xls)."); return; }
    setBusy(true);
    try {
      const r = await salesApi.importExternalSales(companyId, branchId, {
        locationId, salesDate, sourcePlatform, file, replaceExisting,
      });
      setResult(r.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function postCogs() {
    setBusy(true);
    try {
      const r = await salesApi.postBulkCogs(companyId, branchId, {
        fromDate: salesDate, toDate: salesDate,
      });
      alert(JSON.stringify(r.data, null, 2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Sales Import Center"
      subtitle="Import CNET or other platform sales as Sale, SaleItem, and Payment records."
    >
      <div style={{
        display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap",
      }}>

        {/* ── Left: Import settings ───────────────────────────────────────── */}
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <Card
            title="Import settings"
            subtitle="Configure source, date, and consumption location before uploading."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Source Platform */}
              <Field label="Source platform">
                <select
                  value={sourcePlatform}
                  onChange={(e) => setSourcePlatform(e.target.value)}
                  style={selectStyle}
                >
                  {PLATFORM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              {/* Sales Date */}
              <Field label="Sales date" hint="Records will be posted under this date.">
                <input
                  type="date"
                  value={salesDate}
                  onChange={(e) => setSalesDate(e.target.value)}
                  style={selectStyle}
                />
              </Field>

              {/* Consumption Location */}
              <Field
                label="Consumption location"
                hint="Stock will be consumed from this location."
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
                    disabled={locations.length === 0}
                    style={selectStyle}
                  >
                    {locations.length === 0
                      ? <option value="">No stock locations found</option>
                      : locations.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))
                    }
                  </select>
                )}
              </Field>

              {/* File upload */}
              <Field label="Excel workbook" hint="Accepted formats: .xlsx, .xls">
                <label style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            12,
                  padding:        "10px 14px",
                  border:         file
                    ? "1.5px solid #6366f1"
                    : "1px dashed var(--color-border-tertiary)",
                  borderRadius:   "var(--border-radius-md)",
                  background:     file ? "#f5f3ff" : "var(--color-background-secondary)",
                  cursor:         "pointer",
                  transition:     "border-color 0.15s",
                }}>
                  <FileSpreadsheet
                    size={20}
                    color={file ? "#6366f1" : "var(--color-text-tertiary)"}
                    style={{ flexShrink: 0 }}
                  />
                  <span style={{
                    fontSize:  13,
                    color:     file
                      ? "#4f46e5"
                      : "var(--color-text-secondary)",
                    overflow:  "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {file ? file.name : "Click to choose a file…"}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </Field>

              {/* Replace existing */}
              <label style={{
                display:    "flex",
                alignItems: "center",
                gap:        10,
                cursor:     "pointer",
                padding:    "10px 14px",
                borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-secondary)",
                border:     "1px solid var(--color-border-tertiary)",
              }}>
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                    Replace existing import
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                    Overwrite any existing records for the same platform and date
                  </div>
                </div>
              </label>

              {error && <Alert tone="danger" title="Import error" message={error} />}

              <Btn
                variant="primary"
                onClick={submit}
                disabled={busy || locationsLoading}
                style={{ width: "100%", justifyContent: "center", gap: 8 }}
              >
                {busy
                  ? <><Spinner /> Importing…</>
                  : <><Upload size={15} /> Import External Sales</>
                }
              </Btn>

            </div>
          </Card>
        </div>

        {/* ── Right: Result ───────────────────────────────────────────────── */}
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <Card
            title="Validation summary"
            subtitle="Results appear here after a successful or failed import."
          >
            {!result ? (
              <div style={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                padding:        "48px 24px",
                color:          "var(--color-text-tertiary)",
                textAlign:      "center",
                gap:            12,
              }}>
                <FileSpreadsheet size={40} strokeWidth={1.2} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>No results yet</div>
                <div style={{ fontSize: 12 }}>
                  Configure the import settings and upload a workbook to see results here.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Status banner */}
                <div style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  padding:      "12px 14px",
                  borderRadius: "var(--border-radius-md)",
                  background:   result.succeeded ? "#f0fdf4" : "#fef2f2",
                  border:       result.succeeded
                    ? "1px solid #bbf7d0"
                    : "1px solid #fecaca",
                }}>
                  {result.succeeded
                    ? <CheckCircle size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                    : <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                  }
                  <div>
                    <div style={{
                      fontSize:   13,
                      fontWeight: 600,
                      color:      result.succeeded ? "#15803d" : "#b91c1c",
                    }}>
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

                {/* KPI metrics */}
                <div style={{
                  display:               "grid",
                  gridTemplateColumns:   "repeat(2, 1fr)",
                  gap:                   12,
                }}>
                  <MetricCard label="Imported lines" value={result.importedLines}  />
                  <MetricCard label="Skipped lines"  value={result.skippedLines}   />
                  <MetricCard label="Total quantity" value={result.totalQuantity}  />
                  <MetricCard label="Total amount"   value={formatMoney(result.totalAmount)} accent />
                </div>

                {/* Warnings */}
                {result.warnings?.length > 0 && (
                  <div style={{
                    border:       "1px solid #fde68a",
                    borderRadius: "var(--border-radius-md)",
                    overflow:     "hidden",
                  }}>
                    <div style={{
                      padding:    "8px 12px",
                      background: "#fffbeb",
                      borderBottom: "1px solid #fde68a",
                      fontSize:   12,
                      fontWeight: 600,
                      color:      "#92400e",
                    }}>
                      {result.warnings.length} warning{result.warnings.length !== 1 ? "s" : ""}
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {result.warnings.map((w, i) => (
                        <div key={i} style={{
                          padding:     "7px 12px",
                          fontSize:    12,
                          color:       "#78350f",
                          borderBottom: i < result.warnings.length - 1
                            ? "1px solid #fef3c7"
                            : "none",
                        }}>
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post COGS */}
                {result.succeeded && (
                  <Btn
                    variant="primary"
                    onClick={postCogs}
                    disabled={busy}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    {busy ? <><Spinner /> Posting…</> : "Post COGS for Imported Sales"}
                  </Btn>
                )}

              </div>
            )}
          </Card>
        </div>

      </div>
    </PageShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label, value, accent = false,
}: {
  label:   string;
  value:   string | number;
  accent?: boolean;
}) {
  return (
    <div style={{
      padding:      "12px 14px",
      borderRadius: "var(--border-radius-md)",
      background:   accent ? "#f5f3ff" : "var(--color-background-secondary)",
      border:       accent
        ? "1px solid #e0e7ff"
        : "1px solid var(--color-border-tertiary)",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: accent ? "#6366f1" : "var(--color-text-tertiary)",
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize:   20,
        fontWeight: 700,
        color:      accent ? "#4f46e5" : "var(--color-text-primary)",
        lineHeight: 1.2,
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Shared style ──────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width:        "100%",
  boxSizing:    "border-box",
  fontFamily:   "var(--font-sans)",
  padding:      "8px 12px",
  borderRadius: "var(--border-radius-md)",
  fontSize:     13,
  border:       "1px solid var(--color-border-tertiary)",
  background:   "var(--color-background-primary)",
  color:        "var(--color-text-primary)",
  outline:      "none",
  appearance:   "auto",
};