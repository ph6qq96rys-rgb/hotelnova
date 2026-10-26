import type { FnbReportRow } from "../api/fnbReportsApi";

/** Client-side explanation shown when the server does not return a methodology. */
export const REPORT_METHODS: Record<string, string> = {
  "inventory-valuation": "Inventory quantities use each item's base unit. Values use the company currency and the selected reporting cutoff. Quantities and unit costs from different items are not added together.",
  consumption: "Posted inventory usage is grouped by item and stock location. Store transfers are excluded from consumption. Quantities use each item's base unit; consumption value is not revenue or gross margin.",
  "fifo-aging": "Current remaining FIFO layers are aged from their receipt date. Layer age does not indicate an item's expiry date. Historical inventory valuation is available in Inventory Valuation.",
  "dead-stock": "Stock held at the selected cutoff with no movement for the inactivity threshold. This identifies stock for review; it does not post a write-off or a valuation adjustment.",
  "stock-turnover": "Period usage cost (sales net of returns, production, butchery and catering events) divided by the average of opening and closing inventory value. Turnover is a ratio; it is not annualized. Missing or zero inventory denominators require review.",
  "stock-movement": "Opening stock at the start of the period, every posted movement by kind, and closing stock, per item and location. Reversals are netted into the movement they correct. Opening plus movements equals closing; the Check column confirms it.",
  reorder: "Current stock against the reorder point: the larger of minimum stock, the item reorder level, and lead-time demand plus safety stock from the replenishment rules. Daily use is net outbound demand over the look-back days. Suggested quantity fills the coverage window, net of stock in transit.",
  expiry: "Remaining FIFO batches with an expiry date that has passed or falls within the window, valued at their batch cost. Batches without an expiry date are counted in a note.",
  "in-transit": "Inter-branch transfer stock that has left the sending branch and has not been received, plus shortfalls left in transit after a receipt. Valued at dispatch cost.",
  "count-variance": "Approved physical count lines with posted adjustments: system quantity, counted quantity, variance and variance value.",
  "waste-adjustments": "Posted stock adjustments (waste, damage, spoilage, expiry, corrections and count adjustments) by document, type and reason. Negative values are write-downs.",
  "branch-comparison": "Company-wide comparison per branch: closing stock value, receipts, usage cost and adjustments in the period, and stock currently in transit out of the branch.",
};

export const MOVEMENT_PAGE_SIZE = 100;

export type ReportFamily = {
  key: string;
  title: string;
  owner: string;
  description: string;
  liveReportKeys: string[];
  /** Workspace route relative to /companies/:companyId/. */
  route?: string;
  /** Hidden in production builds until the workspace is released. */
  preview?: boolean;
};

export const REPORT_FAMILIES: ReportFamily[] = [
  {
    key: "executive",
    title: "Executive",
    owner: "Management",
    description: "Branch comparison of stock value, receipts, usage, adjustments and transit.",
    liveReportKeys: ["branch-comparison"],
  },
  {
    key: "sales-pos",
    title: "Sales and POS",
    owner: "Sales / Cashier",
    description: "Daily sales, cashier sessions, payment reconciliation, discounts, and COGS posting.",
    liveReportKeys: [],
    route: "sales/reports",
  },
  {
    key: "inventory",
    title: "Inventory control",
    owner: "Store / Controller",
    description: "Stock on hand, valuation, ledger, GRN, SIV, exception, and reconciliation reporting.",
    liveReportKeys: ["inventory-valuation", "stock-movement", "reorder", "expiry", "in-transit", "fifo-aging", "dead-stock", "stock-turnover"],
    route: "inventory-master/reports",
  },
  {
    key: "procurement",
    title: "Procurement",
    owner: "Procurement",
    description: "Purchase requests, supplier performance, price variance, commitments, and matching exceptions.",
    liveReportKeys: [],
  },
  {
    key: "recipe-food-cost",
    title: "Recipe and food cost",
    owner: "Chef / Cost control",
    description: "Recipe cost, menu margin, theoretical versus actual cost, substitutions, and price recommendations.",
    liveReportKeys: ["consumption"],
  },
  {
    key: "production-waste",
    title: "Production and waste",
    owner: "Kitchen / Butchery",
    description: "Waste, spoilage, expiry write-offs, count variances and loss accountability.",
    liveReportKeys: ["waste-adjustments", "count-variance"],
  },
  {
    key: "finance",
    title: "Finance reconciliation",
    owner: "Finance",
    description: "COGS, inventory-to-GL, payments, tax, accruals, and period-close exceptions.",
    liveReportKeys: [],
  },
  {
    key: "catering",
    title: "Catering and events",
    owner: "Catering manager",
    description: "Pipeline, event profitability, deposits, consumption, returns, staffing, and closure.",
    liveReportKeys: [],
    route: "eventmanagment/reports",
    preview: true,
  },
  {
    key: "workforce-audit",
    title: "Workforce and audit",
    owner: "HR / Compliance",
    description: "Attendance, labor productivity, approvals, user activity, permissions, and access audit.",
    liveReportKeys: [],
  },
];

export type ReportFocus = "consumption" | "aging" | null;

/** Default for the Days input per report (matches the server defaults). */
export const DEFAULT_DAYS: Record<string, number> = { "dead-stock": 30, reorder: 30, expiry: 30 };

/** Which insight panel, if any, summarizes a report. */
export function reportFocus(reportKey: string): ReportFocus {
  const key = reportKey.toLowerCase();
  if (key.includes("consumption")) return "consumption";
  if (key.includes("aging") || key.includes("ageing")) return "aging";
  return null;
}

/** Receipt-age buckets in the order the server assigns them (FifoAgingReportProvider.AgeBucket). */
export const AGING_BUCKET_ORDER = ["0-7 Days", "8-30 Days", "31-60 Days", "61-90 Days", "90+ Days"];
export const AGING_RISK_BUCKETS = new Set(["61-90 Days", "90+ Days"]);

export function numberFrom(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function topRowsByValue(rows: FnbReportRow[], limit = 5): FnbReportRow[] {
  return [...rows].sort((a, b) => numberFrom(b.value) - numberFrom(a.value)).slice(0, limit);
}

export type AgingBucket = { bucket: string; qty: number; value: number; count: number };

export function buildAgingBuckets(rows: FnbReportRow[]): AgingBucket[] {
  const buckets = new Map<string, AgingBucket>();

  for (const row of rows) {
    const bucket = String(row.bucket || "Unbucketed");
    const current = buckets.get(bucket) ?? { bucket, qty: 0, value: 0, count: 0 };
    current.qty += numberFrom(row.qty ?? row.closingQty);
    current.value += numberFrom(row.value);
    current.count += 1;
    buckets.set(bucket, current);
  }

  const rank = (bucket: string) => {
    const index = AGING_BUCKET_ORDER.indexOf(bucket);
    return index < 0 ? AGING_BUCKET_ORDER.length : index;
  };
  return [...buckets.values()].sort((a, b) => rank(a.bucket) - rank(b.bucket) || a.bucket.localeCompare(b.bucket));
}

/** Text fields matched by the "search current result" box. */
const SEARCHABLE_FIELDS = ["itemName", "itemCode", "locationName", "categoryName", "uomName", "bucket", "consumptionType",
  "branchName", "sourceNumber", "batchNo", "reason", "route"] as const;

export function filterReportRows(rows: FnbReportRow[], search: string): FnbReportRow[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) =>
    SEARCHABLE_FIELDS.some((field) => {
      const value = row[field];
      return value != null && value !== "" && String(value).toLowerCase().includes(query);
    }),
  );
}
