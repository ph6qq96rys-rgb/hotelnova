// src/features/inventory/items/pages/ImportInventoryItemsPage.tsx

import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { http } from "../../../../api/http";
import "./inventory-items.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportRowError = {
  row:      number;
  itemName: string;
  reason:   string;
};

type ImportResult = {
  totalRows: number;
  inserted:  number;
  skipped:   number;
  failed:    number;
  errors:    ImportRowError[];
};

type ImportState =
  | { status: "idle" }
  | { status: "uploading"; progress: number; label: string }
  | { status: "done";      result: ImportResult }
  | { status: "error";     message: string };

const ACCEPTED_EXTS = [".xlsx", ".xlsm"];
const MAX_BYTES     = 10 * 1024 * 1024; // 10 MB

function fmtBytes(b: number): string {
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportInventoryItemsPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [file,        setFile]        = useState<File | null>(null);
  const [dragging,    setDragging]    = useState(false);
  const [fileError,   setFileError]   = useState<string | null>(null);
  const [state,       setState]       = useState<ImportState>({ status: "idle" });
  const [skipDupes,   setSkipDupes]   = useState(true);
  const [markInactive,setMarkInactive]= useState(true);

  const busy = state.status === "uploading";

  // ── File selection ────────────────────────────────────────────────────────

  const applyFile = useCallback((f: File) => {
    setFileError(null);
    setState({ status: "idle" });

    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTS.includes(ext)) {
      setFileError("Only .xlsx and .xlsm files are supported.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("File exceeds the 10 MB limit.");
      return;
    }
    setFile(f);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setFileError(null);
    setState({ status: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) applyFile(f);
  };

  // ── Upload ────────────────────────────────────────────────────────────────

  const runImport = useCallback(async () => {
    if (!file || !companyId || busy) return;

    setState({ status: "uploading", progress: 20, label: "Uploading file…" });

    const formData = new FormData();
    formData.append("file", file);
    if (skipDupes)    formData.append("skipDuplicates",    "true");
    if (markInactive) formData.append("markInactiveReview","true");

    try {
      setState({ status: "uploading", progress: 50, label: "Processing rows…" });

      const res = await http.post<ImportResult>(
        `/companies/${companyId}/inventory/items/import`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setState({ status: "uploading", progress: 100, label: "Saving…" });
      setState({ status: "done", result: res.data });
    } catch (e: unknown) {
      const err  = e as any;
      const data = err?.response?.data;
      const msg  = (typeof data === "string" ? data : data?.message)
                   ?? err?.message ?? "Import failed.";
      setState({ status: "error", message: msg });
    }
  }, [file, companyId, busy, skipDupes, markInactive]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="inv-page">
        <div className="inv-page-guard">
          <div style={{ fontSize: 32 }}>⚙</div>
          <div>Select a company to import inventory items.</div>
        </div>
      </div>
    );
  }

  const result = state.status === "done" ? state.result : null;

  return (
    <div className="inv-page">

      {/* Header */}
      <div className="inv-banner">
        <div>
          <p className="inv-banner__kicker">Inventory · Items</p>
          <h1 className="inv-banner__title">Import inventory items</h1>
          <p className="inv-banner__subtitle">
            Upload an Excel spreadsheet (.xlsx). Required columns: Material Name,
            Base UOM, Unit Cost, Recipe/Material Type, Status.
          </p>
        </div>
        <button className="inv-btn inv-btn--outline" onClick={() => nav(-1)}>
          ← Back
        </button>
      </div>

      {/* Drop zone */}
      <div
        className={`inv-import-dropzone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        aria-label="Click or drop to upload spreadsheet"
      >
        <span className="inv-import-dropzone__icon">📄</span>
        {file ? (
          <>
            <p className="inv-import-dropzone__title">{file.name}</p>
            <p className="inv-import-dropzone__sub">{fmtBytes(file.size)} · click to change</p>
          </>
        ) : (
          <>
            <p className="inv-import-dropzone__title">Drop spreadsheet here, or click to browse</p>
            <p className="inv-import-dropzone__sub">.xlsx or .xlsm · max 10 MB</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTS.join(",")}
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) applyFile(f); }}
        />
      </div>

      {fileError && (
        <div className="inv-alert inv-alert--error" style={{ marginBottom: 12 }}>
          {fileError}
        </div>
      )}

      {/* Options */}
      <div style={{ display: "flex", gap: 24, margin: "12px 0 16px", flexWrap: "wrap" }}>
        <label className="inv-import-check">
          <input type="checkbox" checked={skipDupes}
            onChange={(e) => setSkipDupes(e.target.checked)} />
          <span>Skip duplicate names (recommended)</span>
        </label>
        <label className="inv-import-check">
          <input type="checkbox" checked={markInactive}
            onChange={(e) => setMarkInactive(e.target.checked)} />
          <span>Mark "Review price" items as inactive</span>
        </label>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          className="inv-btn inv-btn--primary"
          disabled={!file || busy}
          onClick={() => void runImport()}
        >
          {busy ? "Importing…" : "Import items"}
        </button>
        {file && !busy && (
          <button className="inv-btn inv-btn--outline" onClick={clearFile}>
            Clear
          </button>
        )}
      </div>

      {/* Progress bar */}
      {state.status === "uploading" && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            height: 4, background: "var(--erp-border-soft)",
            borderRadius: 999, overflow: "hidden", marginBottom: 6,
          }}>
            <div style={{
              height: "100%", width: `${state.progress}%`,
              background: "var(--erp-accent)", transition: "width 0.3s",
            }} />
          </div>
          <p style={{ fontSize: 12, color: "var(--erp-text-muted)", margin: 0 }}>
            {state.label}
          </p>
        </div>
      )}

      {/* Error banner */}
      {state.status === "error" && (
        <div className="inv-alert inv-alert--error" style={{ marginBottom: 16 }}>
          {state.message}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          <div className="inv-kpi-grid" style={{ marginBottom: 16 }}>
            <div className="inv-kpi">
              <div className="inv-kpi__label">Rows read</div>
              <div className="inv-kpi__value">{result.totalRows}</div>
            </div>
            <div className="inv-kpi">
              <div className="inv-kpi__label">Inserted</div>
              <div className="inv-kpi__value" style={{ color: "var(--erp-success)" }}>
                {result.inserted}
              </div>
            </div>
            <div className="inv-kpi">
              <div className="inv-kpi__label">Skipped</div>
              <div className="inv-kpi__value">{result.skipped}</div>
            </div>
            <div className="inv-kpi">
              <div className="inv-kpi__label">Errors</div>
              <div className="inv-kpi__value"
                style={{ color: result.failed > 0 ? "var(--erp-danger)" : undefined }}>
                {result.failed}
              </div>
            </div>
          </div>

          {result.inserted > 0 && (
            <div className="inv-alert inv-alert--success" style={{ marginBottom: 16 }}>
              ✓ {result.inserted} item{result.inserted !== 1 ? "s" : ""} imported successfully.
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="inv-card">
              <div className="inv-card__head">
                <h2 className="inv-card__title">Row errors</h2>
                <p className="inv-card__subtitle">
                  {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} were
                  skipped or failed.
                </p>
              </div>
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Row</th>
                      <th>Item name</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "var(--erp-mono)", fontSize: 12 }}>
                          {err.row}
                        </td>
                        <td>{err.itemName || "—"}</td>
                        <td style={{ color: "var(--erp-danger)", fontSize: 12 }}>
                          {err.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}