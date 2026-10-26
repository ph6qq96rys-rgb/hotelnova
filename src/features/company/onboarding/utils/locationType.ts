// Names and numeric values must match the API's LocationType enum.
export const LOCATION_TYPE_NAMES = [
  "Warehouse", "Kitchen", "Bar", "Production", "Retail", "Transit", "Waste", "Store", "POS", "Consumtion",
] as const;

export function normalizeLocationType(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return LOCATION_TYPE_NAMES[Number(raw) - 1] ?? raw;
  if (raw.toLowerCase() === "consumption") return "Consumtion";
  return LOCATION_TYPE_NAMES.find(name => name.toLowerCase() === raw.toLowerCase()) ?? raw;
}
