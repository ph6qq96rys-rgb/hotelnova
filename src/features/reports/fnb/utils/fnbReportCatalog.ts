export type FnbReportKey =
  | "kitchen-consumption"
  | "bar-consumption"
  | "cogs"
  | "inventory-valuation"
  | "negative-inventory"
  | "dead-stock"
  | "fifo-aging"
  | "stock-turnover"
  | "theoretical-vs-actual"
  | "variance"
  | "fast-moving-items"
  | "production-yield";

export type FnbReportGroup = "Consumption" | "Stock Control" | "Performance";

export type FnbReportDefinition = {
  key: FnbReportKey;
  label: string;
  group: FnbReportGroup;
  description: string;
  requiresDays?: boolean;
};

export const FNB_REPORTS: FnbReportDefinition[] = [
  {
    key: "kitchen-consumption",
    label: "Daily Kitchen Consumption",
    group: "Consumption",
    description: "Track issued and consumed kitchen inventory.",
  },
  {
    key: "bar-consumption",
    label: "Bar Consumption",
    group: "Consumption",
    description: "Track bar item usage and cost.",
  },
  {
    key: "cogs",
    label: "COGS",
    group: "Consumption",
    description: "Analyze cost of goods sold.",
  },
  {
    key: "inventory-valuation",
    label: "Inventory Valuation",
    group: "Stock Control",
    description: "View current stock quantity and value.",
  },
  {
    key: "negative-inventory",
    label: "Negative Inventory",
    group: "Stock Control",
    description: "Find items with negative stock.",
  },
  {
    key: "dead-stock",
    label: "Dead Stock",
    group: "Stock Control",
    description: "Find inactive stock items.",
    requiresDays: true,
  },
  {
    key: "fifo-aging",
    label: "FIFO Aging",
    group: "Stock Control",
    description: "Analyze FIFO lots by aging bucket.",
  },
  {
    key: "stock-turnover",
    label: "Stock Turnover",
    group: "Stock Control",
    description: "Measure stock movement velocity.",
  },
  {
    key: "theoretical-vs-actual",
    label: "Theoretical vs Actual",
    group: "Performance",
    description: "Compare recipe theoretical usage against actual usage.",
  },
  {
    key: "variance",
    label: "Variance",
    group: "Performance",
    description: "Identify inventory variance by item.",
  },
  {
    key: "fast-moving-items",
    label: "Fast Moving Items",
    group: "Performance",
    description: "Rank high-velocity inventory items.",
  },
  {
    key: "production-yield",
    label: "Production Yield",
    group: "Performance",
    description: "Review production output and yield performance.",
  },
];