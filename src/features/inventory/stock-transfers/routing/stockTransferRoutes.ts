// src/features/inventory/stockTransfers/routing/stockTransferRoutes.ts

export type StockTransferPaths = {
  list: string;
  approvals: string;
  create: string;
  detail: (id: string) => string;
  edit: (id: string) => string;
};

function encodeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

export function buildStockTransferPaths(
  companyId: string | null | undefined
): StockTransferPaths | null {
  const company = companyId?.trim();
  if (!company) return null;

  const base = `/companies/${encodeSegment(company)}/inventory/stock-transfers`;

  return {
    list: base,
    approvals: `${base}/approvals`,
    create: `${base}/new`,
    detail: (id: string) => `${base}/${encodeSegment(id)}`,
    edit: (id: string) => `${base}/${encodeSegment(id)}/edit`,
  };
}
