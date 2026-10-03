// src/features/inventoryMaster/items/pages/Importinventoryitemspage.tsx

import { useCallback, useMemo, useRef, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { http } from "../../../../api/http";
import { appPaths } from "../../../../routes/routeConfig";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { useI18n } from "../../../../i18n";
import "./inventory-items.css";

type ImportRowError = {
  row: number;
  itemName: string;
  reason: string;
};

type ImportResult = {
  totalRows: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
};

type ImportStep = "idle" | "ready" | "importing" | "completed" | "error";

type ImportState = {
  step: ImportStep;
  progress: number;
  label: string;
  message: string | null;
  result: ImportResult | null;
};

type ImportOptions = {
  skipDuplicates: boolean;
  markInactiveReview: boolean;
};

const ACCEPTED_EXTENSIONS = [".xlsx", ".xlsm"];
const ACCEPTED_FILE_TYPES = ACCEPTED_EXTENSIONS.join(",");
const MAX_BYTES = 10 * 1024 * 1024;

const initialState: ImportState = {
  step: "idle",
  progress: 0,
  label: "",
  message: null,
  result: null,
};

const initialOptions: ImportOptions = {
  skipDuplicates: true,
  markInactiveReview: true,
};

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return `.${parts.pop()?.toLowerCase() ?? ""}`;
}

function extractErrorMessage(error: unknown): string {
  const err = error as any;
  const data = err?.response?.data;

  return (
    (typeof data === "string" ? data : null) ??
    data?.message ??
    data?.error ??
    data?.title ??
    err?.message ??
    "Import failed."
  );
}

function useSafeErpNavigation() {
  const erpNav = useErpNavigate() as any;

  const go = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (typeof erpNav === "function") {
        erpNav(path, options);
        return;
      }

      if (typeof erpNav?.go === "function") {
        erpNav.go(path, options?.replace);
        return;
      }

      console.error("Invalid ERP navigation hook result", erpNav);
    },
    [erpNav]
  );

  return { go };
}

export default function Importinventoryitemspage() {
  const { tx } = useI18n();
  const { companyId } = useAppScope();
  const { go } = useSafeErpNavigation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, setState] = useState<ImportState>(initialState);
  const [options, setOptions] = useState<ImportOptions>(initialOptions);

  const busy = state.step === "importing";
  const result = state.result;

  const canImport = Boolean(companyId && file && !busy);

  const fileSummary = useMemo(() => {
    if (!file) return null;

    return {
      name: file.name,
      size: fmtBytes(file.size),
      extension: getFileExtension(file.name),
    };
  }, [file]);

  const applyFile = useCallback((nextFile: File) => {
    setFileError(null);
    setState(initialState);

    const ext = getFileExtension(nextFile.name);

    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFile(null);
      setFileError("Only .xlsx and .xlsm files are supported.");
      return;
    }

    if (nextFile.size > MAX_BYTES) {
      setFile(null);
      setFileError("File exceeds the 10 MB limit.");
      return;
    }

    setFile(nextFile);
    setState({
      ...initialState,
      step: "ready",
      label: "File ready for import.",
    });
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setFileError(null);
    setState(initialState);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const updateOption = useCallback(
    <K extends keyof ImportOptions>(key: K, value: ImportOptions[K]) => {
      setOptions((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const runImport = useCallback(async () => {
    if (!file || !companyId || busy) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("skipDuplicates", String(options.skipDuplicates));
    formData.append("markInactiveReview", String(options.markInactiveReview));

    try {
      setState({
        step: "importing",
        progress: 25,
        label: "Uploading spreadsheet...",
        message: null,
        result: null,
      });

      setState((prev) => ({
        ...prev,
        progress: 55,
        label: "Validating and processing rows...",
      }));

      const response = await http.post<ImportResult>(
        `/companies/${companyId}/inventory/items/import`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setState({
        step: "completed",
        progress: 100,
        label: "Import completed.",
        message: null,
        result: response.data,
      });
    } catch (error) {
      setState({
        step: "error",
        progress: 0,
        label: "",
        message: extractErrorMessage(error),
        result: null,
      });
    }
  }, [file, companyId, busy, options]);

  function openFilePicker() {
    if (busy) return;
    fileInputRef.current?.click();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (busy) return;

    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) applyFile(nextFile);
  }

  if (!companyId) {
    return (
      <div className="inv-page">
        <div className="inv-page-guard">
          <div style={{ fontSize: 32 }}></div>
          <div>{tx("Select a company to import inventory items.")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="inv-page">
      <div className="inv-banner">
        <div>
          <p className="inv-banner__kicker">{tx("Inventory - Items")}</p>
          <h1 className="inv-banner__title">{tx("Import Inventory Items")}</h1>
          <p className="inv-banner__subtitle">
            Upload the approved Excel template to create inventory items,
            validate UOMs, skip duplicates, and prepare items for operational
            use.
          </p>
        </div>

        <button
          type="button"
          className="inv-btn inv-btn--outline"
          onClick={() => go(`/companies/${companyId}/inventory-master/items`)}
          disabled={busy}
        >
          {tx("Back to Items")}
        </button>
      </div>

      <div className="inv-kpi-grid" style={{ marginBottom: 16 }}>
        <ImportStepCard
          number="1"
          title={tx("Upload")}
          text={tx("Choose the Excel file.")}
          active={state.step === "idle" || state.step === "ready"}
        />
        <ImportStepCard
          number="2"
          title={tx("Validate")}
          text={tx("Check file format and options.")}
          active={state.step === "ready"}
        />
        <ImportStepCard
          number="3"
          title={tx("Import")}
          text={tx("Process inventory rows.")}
          active={state.step === "importing"}
        />
        <ImportStepCard
          number="4"
          title={tx("Review")}
          text={tx("Review imported and failed rows.")}
          active={state.step === "completed" || state.step === "error"}
        />
      </div>

      <div className="inv-card" style={{ marginBottom: 16 }}>
        <div className="inv-card__head">
          <h2 className="inv-card__title">{tx("Spreadsheet Requirements")}</h2>
          <p className="inv-card__subtitle">
            {tx("Use this format to prevent import errors.")}
          </p>
        </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>{tx("Required Column")}</th>
                <th>{tx("Example")}</th>
                <th>{tx("Notes")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{tx("Material Name")}</td>
                <td>{tx("Chicken Breast")}</td>
                <td>{tx("Must be unique unless duplicate skipping is enabled.")}</td>
              </tr>
              <tr>
                <td>{tx("Base UOM")}</td>
                <td>kg</td>
                <td>{tx("Must match an existing unit of measure.")}</td>
              </tr>
              <tr>
                <td>{tx("Unit Cost")}</td>
                <td>12.50</td>
                <td>{tx("Numeric value only.")}</td>
              </tr>
              <tr>
                <td>{tx("Recipe/Material Type")}</td>
                <td>{tx("Raw Material")}</td>
                <td>{tx("Used for recipe and costing setup.")}</td>
              </tr>
              <tr>
                <td>{tx("Status")}</td>
                <td>{tx("Active")}</td>
                <td>{tx("Inactive rows may be imported as inactive.")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={`inv-import-dropzone${dragging ? " is-dragging" : ""}${
          file ? " has-file" : ""
        }`}
        onClick={openFilePicker}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
          }
        }}
        aria-label={tx("Click or drop to upload spreadsheet")}
      >
        <span className="inv-import-dropzone__icon"></span>

        {fileSummary ? (
          <>
            <p className="inv-import-dropzone__title">{fileSummary.name}</p>
            <p className="inv-import-dropzone__sub">
              {fileSummary.size} - {fileSummary.extension} - {tx("click to change")}
            </p>
          </>
        ) : (
          <>
            <p className="inv-import-dropzone__title">
              {tx("Drop spreadsheet here, or click to browse")}
            </p>
            <p className="inv-import-dropzone__sub">
              {tx(".xlsx or .xlsm - max 10 MB")}
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          style={{ display: "none" }}
          disabled={busy}
          onChange={(event) => {
            const nextFile = event.target.files?.[0];
            if (nextFile) applyFile(nextFile);
          }}
        />
      </div>

      {fileError ? (
        <div className="inv-alert inv-alert--error" style={{ marginBottom: 12 }}>
          {tx(fileError)}
        </div>
      ) : null}

      <div className="inv-card" style={{ marginBottom: 16 }}>
        <div className="inv-card__head">
          <h2 className="inv-card__title">{tx("Import Options")}</h2>
          <p className="inv-card__subtitle">
            {tx("Configure how duplicate and review items should be handled.")}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <label className="inv-import-check">
            <input
              type="checkbox"
              checked={options.skipDuplicates}
              disabled={busy}
              onChange={(event) =>
                updateOption("skipDuplicates", event.target.checked)
              }
            />
            <span>{tx("Skip duplicate item names")}</span>
          </label>

          <label className="inv-import-check">
            <input
              type="checkbox"
              checked={options.markInactiveReview}
              disabled={busy}
              onChange={(event) =>
                updateOption("markInactiveReview", event.target.checked)
              }
            />
            <span>{tx("Mark review-price items as inactive")}</span>
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          className="inv-btn inv-btn--primary"
          disabled={!canImport}
          onClick={() => void runImport()}
        >
          {busy ? tx("Importing...") : tx("Import Items")}
        </button>

        {file && !busy ? (
          <button
            type="button"
            className="inv-btn inv-btn--outline"
            onClick={clearFile}
          >
            {tx("Clear File")}
          </button>
        ) : null}
      </div>

      {state.step === "importing" ? (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              height: 4,
              background: "var(--erp-border-soft)",
              borderRadius: 999,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${state.progress}%`,
                background: "var(--erp-accent)",
                transition: "width 0.3s",
              }}
            />
          </div>

          <p
            style={{
              fontSize: 12,
              color: "var(--erp-text-muted)",
              margin: 0,
            }}
          >
            {tx(state.label)}
          </p>
        </div>
      ) : null}

      {state.step === "error" && state.message ? (
        <div className="inv-alert inv-alert--error" style={{ marginBottom: 16 }}>
          {tx(state.message)}
        </div>
      ) : null}

      {result ? <ImportResults result={result} tx={tx} /> : null}
    </div>
  );
}

function ImportStepCard({
  number,
  title,
  text,
  active,
}: {
  number: string;
  title: string;
  text: string;
  active?: boolean;
}) {
  const { tx } = useI18n();

  return (
    <div
      className="inv-kpi"
      style={{
        outline: active ? "2px solid var(--erp-accent)" : undefined,
      }}
    >
      <div className="inv-kpi__label">{tx("Step")} {number}</div>
      <div className="inv-kpi__value" style={{ fontSize: 18 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: "var(--erp-text-muted)" }}>{text}</div>
    </div>
  );
}

function ImportResults({ result, tx }: { result: ImportResult; tx: (text: string) => string }) {
  return (
    <>
      <div className="inv-kpi-grid" style={{ marginBottom: 16 }}>
        <ResultKpi label={tx("Rows Read")} value={result.totalRows} />
        <ResultKpi label={tx("Inserted")} value={result.inserted} tone="success" />
        <ResultKpi label={tx("Skipped")} value={result.skipped} />
        <ResultKpi
          label={tx("Errors")}
          value={result.failed}
          tone={result.failed > 0 ? "danger" : undefined}
        />
      </div>

      {result.inserted > 0 ? (
        <div className="inv-alert inv-alert--success" style={{ marginBottom: 16 }}>          {tx("Items imported successfully.").replace("{count}", String(result.inserted))}
        </div>
      ) : null}

      {result.errors.length > 0 ? (
        <div className="inv-card">
          <div className="inv-card__head">
            <h2 className="inv-card__title">{tx("Row Errors")}</h2>
            <p className="inv-card__subtitle">              {tx("Rows were skipped or failed.").replace("{count}", String(result.errors.length))}
            </p>
          </div>

          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>{tx("Row")}</th>
                  <th>{tx("Item Name")}</th>
                  <th>{tx("Reason")}</th>
                </tr>
              </thead>

              <tbody>
                {result.errors.map((error, index) => (
                  <tr key={`${error.row}-${index}`}>
                    <td
                      style={{
                        fontFamily: "var(--erp-mono)",
                        fontSize: 12,
                      }}
                    >
                      {error.row}
                    </td>
                    <td>{error.itemName || "-"}</td>
                    <td
                      style={{
                        color: "var(--erp-danger)",
                        fontSize: 12,
                      }}
                    >
                      {tx(error.reason)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResultKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "var(--erp-success)"
      : tone === "danger"
      ? "var(--erp-danger)"
      : undefined;

  return (
    <div className="inv-kpi">
      <div className="inv-kpi__label">{label}</div>
      <div className="inv-kpi__value" style={{ color }}>
        {value}
      </div>
    </div>
  );
}