import { useId, type ReactNode } from "react";

import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
import { useI18n } from "../../../i18n";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { toUserFriendlyError } from "../../../shared/errors/errorMessage.utils";
import type {
  AcquisitionMethod,
  AssignmentType,
  DepreciationMethod,
  DisposalMethod,
  FixedAssetCondition,
  FixedAssetEventType,
  FixedAssetStatus,
} from "../api/fixedAssetsApi";

export const money = (value?: number | null) => formatCurrency(value ?? 0);

/** The backend explains rule violations in plain words; show them instead of a generic failure. */
export function apiError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { detail?: string; message?: string; error?: string } } })?.response?.data;
  const text = data?.detail || data?.message || data?.error;
  return typeof text === "string" && text.trim() ? text.trim() : toUserFriendlyError(error, fallback);
}

/** Date-input value (local day, yyyy-MM-dd) for an ISO timestamp. */
export const toDateInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** ISO timestamp for a picked day. Today keeps the current time so "now" events sort correctly. */
export const fromDateInput = (value: string) => {
  if (!value) return null;
  const today = toDateInput(new Date().toISOString());
  if (value === today) return new Date().toISOString();
  return new Date(`${value}T12:00:00`).toISOString();
};

export const todayInput = () => toDateInput(new Date().toISOString());

export const STATUS_LABEL: Record<FixedAssetStatus, string> = {
  draft: "Draft",
  active: "Active",
  assigned: "Assigned",
  inTransit: "In transit",
  underInspection: "Under inspection",
  underMaintenance: "Under maintenance",
  outOfService: "Out of service",
  missing: "Missing",
  stolen: "Stolen",
  retired: "Retired",
  disposed: "Disposed",
};

export const STATUS_TONE: Record<FixedAssetStatus, "neutral" | "ok" | "warn" | "bad" | "info" | "muted"> = {
  draft: "neutral",
  active: "ok",
  assigned: "ok",
  inTransit: "info",
  underInspection: "info",
  underMaintenance: "warn",
  outOfService: "warn",
  missing: "bad",
  stolen: "bad",
  retired: "muted",
  disposed: "muted",
};

export const CONDITION_LABEL: Record<FixedAssetCondition, string> = {
  new: "New",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  damaged: "Damaged",
  unsafe: "Unsafe",
  beyondRepair: "Beyond repair",
};

export const ACQUISITION_LABEL: Record<AcquisitionMethod, string> = {
  purchase: "Purchase",
  donation: "Donation",
  transferIn: "Transfer in",
  openingBalance: "Opening balance",
  lease: "Lease",
};

export const METHOD_LABEL: Record<DepreciationMethod, string> = {
  straightLine: "Straight line",
  reducingBalance: "Reducing balance",
  unitsOfProduction: "Units of production",
  notDepreciable: "Not depreciable",
};

export const ASSIGNMENT_LABEL: Record<AssignmentType, string> = {
  custody: "Custody",
  departmentUse: "Department use",
  locationUse: "Location use",
  temporaryCheckout: "Temporary checkout",
  transfer: "Transfer",
};

export const EVENT_LABEL: Record<FixedAssetEventType, string> = {
  inspection: "Inspection",
  maintenanceStarted: "Maintenance started",
  maintenanceCompleted: "Maintenance completed",
  outOfService: "Taken out of service",
  returnedToService: "Returned to service",
  reportedMissing: "Reported missing",
  reportedStolen: "Reported stolen",
  found: "Found",
  retired: "Retired",
  disposed: "Disposed",
};

export const DISPOSAL_LABEL: Record<DisposalMethod, string> = {
  sale: "Sale",
  scrap: "Scrap",
  donation: "Donation",
  writeOff: "Write-off",
  tradeIn: "Trade-in",
};

export function StatusChip({ status }: { status: FixedAssetStatus }) {
  const { tx } = useI18n();
  return <span className={`fa-chip fa-chip--${STATUS_TONE[status]}`}>{tx(STATUS_LABEL[status])}</span>;
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "fa-field fa-field--wide" : "fa-field"}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

type DialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText: string;
  busy?: boolean;
  danger?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  wide?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

/** Modal form used by every fixed-asset action. Errors show inside the dialog, never behind it. */
export function FaDialog({ open, title, description, confirmText, busy, danger, confirmDisabled, error, wide, children, onConfirm, onClose }: DialogProps) {
  const { tx } = useI18n();
  const titleId = useId();
  useDialogFocus(open, !!busy, onClose);
  if (!open) return null;
  return (
    <div className="ui-dialog-backdrop">
      <div className={wide ? "ui-dialog fa-dialog fa-dialog--wide" : "ui-dialog fa-dialog"} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ui-dialog-header"><h3 id={titleId}>{title}</h3></div>
        <form className="ui-dialog-body fa-dialog-body" onSubmit={(e) => { e.preventDefault(); if (!busy && !confirmDisabled) onConfirm(); }}>
          {description ? <div className="fa-muted">{description}</div> : null}
          {error ? <StateMessage tone="error">{error}</StateMessage> : null}
          {children}
          <div className="fa-dialog-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{tx("Cancel")}</Button>
            <Button type="submit" variant={danger ? "destructive" : "default"} disabled={busy || confirmDisabled} aria-busy={busy}>
              {busy ? tx("Saving...") : confirmText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Downloads rows as a CSV file (opens in Excel). */
export function downloadCsv(fileName: string, header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: string | number | null | undefined) => {
    const text = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
