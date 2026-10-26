import {
  STOCK_TRANSFER_STATUS,
  STOCK_TRANSFER_TYPE,
  type StockTransferStatus,
  type StockTransferType,
} from "../types";
import { normalizeStockTransferStatus } from "./stockTransferStatus";

export function normalizeTransferType(raw: unknown): StockTransferType {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "2" || value === "interbranch"
    ? STOCK_TRANSFER_TYPE.InterBranch
    : STOCK_TRANSFER_TYPE.InterDepartment;
}

export function transferTypeLabel(type: StockTransferType): string {
  return type === STOCK_TRANSFER_TYPE.InterBranch ? "Branch to branch" : "Within this branch";
}

/** "Location (Branch)", the way a transfer route is shown. */
export function routeParty(location?: string | null, branch?: string | null): string {
  const place = (location ?? "").trim();
  const owner = (branch ?? "").trim();
  if (place && owner) return `${place} (${owner})`;
  return place || owner || "-";
}

/** Issued means "in transit" for a transfer to another branch; Posted means received / completed. */
export function transferStatusLabel(rawStatus: unknown, type: StockTransferType): string {
  const status = normalizeStockTransferStatus(rawStatus);
  const interBranch = type === STOCK_TRANSFER_TYPE.InterBranch;

  switch (status) {
    case STOCK_TRANSFER_STATUS.Submitted:
      return "Awaiting approval";
    case STOCK_TRANSFER_STATUS.Approved:
      return interBranch ? "Approved – ready to dispatch" : "Approved – ready to post";
    case STOCK_TRANSFER_STATUS.Issued:
      return "In transit";
    case STOCK_TRANSFER_STATUS.Posted:
      return interBranch ? "Received" : "Posted";
    case STOCK_TRANSFER_STATUS.Reversed:
      return interBranch ? "Recalled" : "Reversed";
    default:
      return status;
  }
}

export function transferStatusTone(rawStatus: unknown): string {
  const status: StockTransferStatus = normalizeStockTransferStatus(rawStatus);

  switch (status) {
    case STOCK_TRANSFER_STATUS.Draft:
      return "bg-slate-100 text-slate-700";
    case STOCK_TRANSFER_STATUS.Submitted:
      return "bg-amber-100 text-amber-800";
    case STOCK_TRANSFER_STATUS.Approved:
      return "bg-sky-100 text-sky-800";
    case STOCK_TRANSFER_STATUS.Issued:
      return "bg-indigo-100 text-indigo-800";
    case STOCK_TRANSFER_STATUS.Posted:
      return "bg-emerald-100 text-emerald-800";
    case STOCK_TRANSFER_STATUS.Rejected:
    case STOCK_TRANSFER_STATUS.Cancelled:
    case STOCK_TRANSFER_STATUS.Reversed:
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function qty(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "-";
}
