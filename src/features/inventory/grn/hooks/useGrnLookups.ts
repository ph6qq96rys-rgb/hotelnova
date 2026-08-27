import { useEffect, useMemo, useRef, useState } from "react";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";
import type { InventoryItemDto } from "../../../inventoryMaster/items/types";
import type { SelectOption } from "../types/grn.types";
import { getApiErrorMessage } from "../helpers/grn.errors";

type UomCatalog = Map<string, { code: string; name: string }>;

export type GrnItemVm = {
  id: string;
  label: string;
  uoms: SelectOption<string>[];
  defaultUomId: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function unwrapArray<T>(value: unknown): T[] {
  const envelope = value as { data?: unknown; items?: unknown; result?: unknown };
  const raw = envelope?.data ?? envelope?.items ?? envelope?.result ?? value;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function isActive(row: Record<string, unknown>): boolean {
  return row.isActive === true || row.isActive === undefined || row.isActive === null;
}

function isReceivingLocation(row: Record<string, unknown>): boolean {
  const type = clean(row.locationType ?? row.type ?? row.stockLocationType).toLowerCase();
  if (!type) return true;
  return ["warehouse", "mainwarehouse", "main warehouse", "storage", "store", "receiving", "receivinglocation", "receiving location"].includes(type);
}

function locationLabel(row: Record<string, unknown>): string {
  const name = clean(row.name) || "Location";
  const code = clean(row.code);
  const type = clean(row.locationType ?? row.type ?? row.stockLocationType);
  return [name, code ? `(${code})` : "", type ? `- ${type}` : ""].filter(Boolean).join(" ");
}

function uomLabel(uomId: string, catalog: UomCatalog): string {
  const uom = catalog.get(uomId);
  if (!uom) return uomId;
  return uom.code ? `${uom.code} - ${uom.name}` : uom.name;
}

function itemToVm(dto: InventoryItemDto, catalog: UomCatalog): GrnItemVm {
  const baseUomId = clean(dto.baseUomId);
  const name = clean(dto.name);
  const sku = clean(dto.sku);

  return {
    id: clean(dto.id),
    label: sku && name ? `${sku} - ${name}` : name || sku || "Unnamed item",
    uoms: baseUomId
      ? [{ value: baseUomId, label: `${uomLabel(baseUomId, catalog)} - Base / Purchasing` }]
      : [],
    defaultUomId: baseUomId,
  };
}

export function useGrnLookups(companyId?: string | null) {
  const itemDetailCache = useRef<Map<string, InventoryItemDto>>(new Map());

  const [locations, setLocations] = useState<SelectOption<string>[]>([]);
  const [items, setItems] = useState<GrnItemVm[]>([]);
  const [uomCatalog, setUomCatalog] = useState<UomCatalog>(new Map());
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLocations([]);
      return;
    }

    let alive = true;
    setLoadingLocations(true);
    setError(null);

    stockLocationsApi
      .list(companyId)
      .then((response) => {
        if (!alive) return;
        const options = unwrapArray<Record<string, unknown>>(response)
          .filter((row) => isActive(row) && isReceivingLocation(row))
          .map((row) => ({ value: clean(row.id), label: locationLabel(row) }))
          .filter((option) => option.value);
        setLocations(options);
      })
      .catch((err) => {
        if (!alive) return;
        setLocations([]);
        setError(getApiErrorMessage(err, "Failed to load receiving locations."));
      })
      .finally(() => {
        if (alive) setLoadingLocations(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setItems([]);
      setUomCatalog(new Map());
      itemDetailCache.current.clear();
      return;
    }

    let alive = true;
    setLoadingItems(true);
    setError(null);

    Promise.all([inventoryItemsApi.list(companyId), inventoryItemsApi.getUoms(companyId)])
      .then(([itemsResponse, uomsResponse]) => {
        if (!alive) return;

        const catalog = new Map(
          (uomsResponse ?? []).map((u) => [
            u.id,
            { code: u.code ?? u.symbol ?? "", name: u.name },
          ]),
        );

        setUomCatalog(catalog);
        setItems(unwrapArray<InventoryItemDto>(itemsResponse).map((dto) => itemToVm(dto, catalog)));
      })
      .catch((err) => {
        if (!alive) return;
        setItems([]);
        setError(getApiErrorMessage(err, "Failed to load inventory items."));
      })
      .finally(() => {
        if (alive) setLoadingItems(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const itemOptions = useMemo(() => items.map((item) => ({ value: item.id, label: item.label })), [items]);

  async function ensureItem(itemId: string): Promise<GrnItemVm | null> {
    if (!companyId || !itemId) return null;

    const existing = itemMap.get(itemId);
    if (existing) return existing;

    const cached = itemDetailCache.current.get(itemId);
    const detail = cached ?? (await inventoryItemsApi.get(companyId, itemId));
    itemDetailCache.current.set(itemId, detail);

    const vm = itemToVm(detail, uomCatalog);
    setItems((current) =>
      current.some((item) => item.id === itemId)
        ? current.map((item) => (item.id === itemId ? vm : item))
        : [...current, vm],
    );

    return vm;
  }

  return {
    locations,
    items,
    itemMap,
    itemOptions,
    loadingLocations,
    loadingItems,
    error,
    ensureItem,
  };
}
