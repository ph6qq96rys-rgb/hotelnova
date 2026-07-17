// src/features/inventory/stockTransfers/utils/stockTransferStatus.ts

import {
  STOCK_TRANSFER_STATUS,
  type StockTransferStatus,
} from "../types";

const STATUS_VALUES = new Set<StockTransferStatus>(
  Object.values(STOCK_TRANSFER_STATUS)
);

export function normalizeStockTransferStatus(raw: unknown): StockTransferStatus {
  if (STATUS_VALUES.has(raw as StockTransferStatus)) {
    return raw as StockTransferStatus;
  }

  const value = String(raw ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");

  switch (value) {
    case "0":
    case "draft":
      return STOCK_TRANSFER_STATUS.Draft;

    case "1":
    case "submitted":
      return STOCK_TRANSFER_STATUS.Submitted;

    case "2":
    case "approved":
      return STOCK_TRANSFER_STATUS.Approved;

    case "3":
    case "posted":
      return STOCK_TRANSFER_STATUS.Posted;

    case "4":
    case "rejected":
      return STOCK_TRANSFER_STATUS.Rejected;

    case "5":
    case "reversed":
      return STOCK_TRANSFER_STATUS.Reversed;

    case "6":
    case "cancelled":
    case "canceled":
      return STOCK_TRANSFER_STATUS.Cancelled;

    case "7":
    case "failed":
      return STOCK_TRANSFER_STATUS.Failed;

    case "8":
    case "issued":
      return STOCK_TRANSFER_STATUS.Issued;

    case "9":
    case "changesrequested":
      return STOCK_TRANSFER_STATUS.ChangesRequested;

    default:
      return STOCK_TRANSFER_STATUS.Draft;
  }
}

export function canEditTransfer(status: StockTransferStatus): boolean {
  return (
    status === STOCK_TRANSFER_STATUS.Draft ||
    status === STOCK_TRANSFER_STATUS.Rejected
  );
}

export function canSubmitTransfer(status: StockTransferStatus): boolean {
  return canEditTransfer(status);
}

export function canApproveTransfer(status: StockTransferStatus): boolean {
  return status === STOCK_TRANSFER_STATUS.Submitted;
}

export function canPostTransfer(status: StockTransferStatus): boolean {
  return status === STOCK_TRANSFER_STATUS.Approved;
}

export function canCancelTransfer(status: StockTransferStatus): boolean {
  return (
    status === STOCK_TRANSFER_STATUS.Draft ||
    status === STOCK_TRANSFER_STATUS.Submitted ||
    status === STOCK_TRANSFER_STATUS.Approved
  );
}
