import type { FnbReportRow } from "../api/fnbReportsApi";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportRowsToCsv({
  filename,
  rows,
}: {
  filename: string;
  rows: FnbReportRow[];
}) {
  const headers = [
    "Item Code",
    "Item Name",
    "Category",
    "Location",
    "UOM",
    "Qty",
    "Closing Qty",
    "Theoretical Qty",
    "Actual Qty",
    "Variance Qty",
    "Unit Cost",
    "Value",
    "Bucket",
    "Days Since Last Movement",
  ];

  const body = rows.map((r) =>
    [
      r.itemCode,
      r.itemName,
      r.categoryName,
      r.locationName,
      r.uomName,
      r.qty,
      r.closingQty,
      r.theoreticalQty,
      r.actualQty,
      r.varianceQty,
      r.unitCost,
      r.value,
      r.bucket,
      r.daysSinceLastMovement,
    ].map(csvEscape).join(",")
  );

  const csv = [headers.map(csvEscape).join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}