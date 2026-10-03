import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  createPurchaseRequisition,
  createReorderPurchaseRequisition,
  listReorderSuggestions,
  type PurchaseRequisitionLineInput,
  type PurchaseRequisitionReorderSuggestion,
} from "../api/procurementApi";
import { inventoryItemsApi } from "../../inventoryMaster/items/api/inventoryItemsApi";
import type { InventoryItemDto, ItemUomDto } from "../../inventoryMaster/items/types";
import { useI18n } from "../../../i18n";
import "./procurement.css";

const priorities = ["Low", "Normal", "High", "Urgent", "Emergency"];
const lineTypes = ["InventoryItem", "NonInventoryGood", "Service", "Expense", "FixedAsset"];

function inventoryItemLabel(item: InventoryItemDto) {
  const sku = item.sku ? `${item.sku} - ` : "";
  return `${sku}${item.name}`;
}

function purchaseUomsForItem(item?: InventoryItemDto | null): ItemUomDto[] {
  const rows = item?.uoms ?? item?.allowedUoms ?? [];
  return rows
    .filter((uom) => uom.isActive !== false && uom.isPurchase)
    .sort((a, b) => Number(b.isBase) - Number(a.isBase) || a.code.localeCompare(b.code));
}

function uomLabel(uom: ItemUomDto) {
  return `${uom.code} - ${uom.name}`;
}

function todayPlus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function newLine(): PurchaseRequisitionLineInput {
  return {
    lineType: "InventoryItem",
    inventoryItemId: null,
    itemName: "",
    uomId: null,
    uomName: "",
    quantity: 1,
    estimatedUnitPrice: 0,
    specification: "",
    availableStockNote: "",
  };
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function errorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: { error?: string } } }).response?.data;
    return data?.error ?? fallback;
  }
  return fallback;
}

export default function PurchaseRequisitionCreatePage() {
  const { tx } = useI18n();
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [priority, setPriority] = useState("Normal");
  const [purchaseCategory, setPurchaseCategory] = useState("Inventory Replenishment");
  const [businessJustification, setBusinessJustification] = useState("Prepared from Main Store inventory reorder levels.");
  const [costCenterCode, setCostCenterCode] = useState("");
  const [relatedReference, setRelatedReference] = useState("Inventory reorder level");
  const [stockAvailabilityNote, setStockAvailabilityNote] = useState("");
  const [requiredByDateUtc, setRequiredByDateUtc] = useState(todayPlus(1));
  const [lines, setLines] = useState<PurchaseRequisitionLineInput[]>([newLine()]);
  const [suggestions, setSuggestions] = useState<PurchaseRequisitionReorderSuggestion[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingReorder, setLoadingReorder] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inventoryItemById = useMemo(() => new Map(inventoryItems.map((item) => [item.id, item])), [inventoryItems]);

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;
    setLoadingItems(true);
    inventoryItemsApi
      .list(companyId)
      .then((rows) => {
        if (!cancelled) {
          setInventoryItems(rows.filter((item) => item.isActive !== false && item.trackInventory !== false));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(tx(errorMessage(err, "Unable to load inventory item catalog.")));
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.estimatedUnitPrice) || 0), 0),
    [lines],
  );

  function updateLine(index: number, patch: Partial<PurchaseRequisitionLineInput>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  function selectInventoryItem(index: number, itemId: string) {
    const item = inventoryItemById.get(itemId);
    const defaultUom = purchaseUomsForItem(item)[0];

    updateLine(index, {
      lineType: "InventoryItem",
      inventoryItemId: item?.id ?? null,
      itemName: item?.name ?? "",
      uomId: defaultUom?.uomId ?? null,
      uomName: defaultUom ? uomLabel(defaultUom) : "",
      estimatedUnitPrice: item?.defaultCost ?? 0,
    });
  }

  function selectPurchaseUom(index: number, itemId: string | null | undefined, uomId: string) {
    const item = itemId ? inventoryItemById.get(itemId) : null;
    const uom = purchaseUomsForItem(item).find((row) => row.uomId === uomId);
    updateLine(index, { uomId: uom?.uomId ?? null, uomName: uom ? uomLabel(uom) : "" });
  }

  async function loadReorderLines() {
    if (!companyId) return;
    setLoadingReorder(true);
    setError(null);
    try {
      const rows = await listReorderSuggestions(companyId, { pageSize: 100 });
      setSuggestions(rows);

      if (rows.length === 0) {
        setError(tx("No active inventory items are below reorder level."));
        return;
      }

      setLines(rows.map((item) => ({
        lineType: "InventoryItem",
        inventoryItemId: item.inventoryItemId,
        itemName: item.itemName,
        uomId: item.uomId,
        uomName: item.uomName,
        quantity: item.suggestedPurchaseQty,
        estimatedUnitPrice: item.estimatedUnitPrice,
        specification: item.recommendation,
        availableStockNote: `${tx("Available")} ${item.availableBaseQty}; ${tx("reorder")} ${item.reorderLevelBaseQty}; ${tx("shortage")} ${item.shortageBaseQty}.`,
      })));
      setStockAvailabilityNote(`${tx("Prepared from")} ${rows.length} ${tx("item(s) below reorder level.")}`);
    } catch (err) {
      setError(tx(errorMessage(err, "Unable to load reorder suggestions.")));
    } finally {
      setLoadingReorder(false);
    }
  }

  async function createSystemDraft(submit: boolean) {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createReorderPurchaseRequisition(companyId, {
        priority,
        purchaseCategory,
        businessJustification,
        requiredByDateUtc: toIsoDate(requiredByDateUtc),
        submit,
      });

      if (!result.success) {
        setError(tx(result.error ?? "Unable to create reorder requisition."));
        return;
      }

      navigate(`/companies/${companyId}/procurement/requisitions/${result.id}`);
    } catch (err) {
      setError(tx(errorMessage(err, "Unable to create reorder requisition.")));
    } finally {
      setSaving(false);
    }
  }

  async function save(submit: boolean) {
    if (!companyId) return;
    setSaving(true);
    setError(null);

    try {
      const result = await createPurchaseRequisition(companyId, {
        priority,
        purchaseCategory,
        businessJustification,
        costCenterCode: costCenterCode || null,
        relatedReference: relatedReference || null,
        stockAvailabilityNote: stockAvailabilityNote || null,
        requiredByDateUtc: toIsoDate(requiredByDateUtc),
        submit,
        lines: lines.map((line) => ({
          ...line,
          quantity: Number(line.quantity) || 0,
          estimatedUnitPrice: Number(line.estimatedUnitPrice) || 0,
          itemName: line.itemName.trim(),
          uomName: line.uomName.trim() || "Unit",
        })),
      });

      if (!result.success) {
        setError(tx(result.error ?? "Unable to save purchase requisition."));
        return;
      }

      navigate(`/companies/${companyId}/procurement/requisitions/${result.id}`);
    } catch (err: unknown) {
      setError(tx(errorMessage(err, "Unable to save purchase requisition.")));
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) return null;

  return (
    <main className="prq-page">
      <header className="prq-page-header">
        <div>
          <div className="prq-kicker">{tx("Procurement / Purchase Requisitions / New")}</div>
          <h1>{tx("New Purchase Requisition")}</h1>
          <p>{tx("Prepare a company-scoped purchase request from Main Store reorder levels, or enter exceptional manual demand.")}</p>
        </div>
        <div className="prq-actions">
          <button className="prq-btn" type="button" onClick={() => navigate(-1)}>{tx("Cancel")}</button>
          <button className="prq-btn" type="button" disabled={saving} onClick={() => save(false)}>{tx("Save draft")}</button>
          <button className="prq-btn prq-btn--primary" type="button" disabled={saving} onClick={() => save(true)}>{tx("Submit for approval")}</button>
        </div>
      </header>

      {error && <div className="prq-alert">{tx(error)}</div>}

      <section className="prq-panel prq-reorder-panel">
        <div>
          <h2>{tx("Inventory Reorder Preparation")}</h2>
          <p>{tx("Generate company-scoped requisition lines from active inventory items below reorder level at the Main Warehouse/Main Store.")}</p>
        </div>
        <div className="prq-actions">
          <button className="prq-btn" type="button" disabled={loadingReorder || saving} onClick={loadReorderLines}>
            <RefreshCw size={16} /> {tx("Load below reorder")}
          </button>
          <button className="prq-btn" type="button" disabled={saving} onClick={() => createSystemDraft(false)}>
            {tx("Create reorder draft")}
          </button>
          <button className="prq-btn prq-btn--primary" type="button" disabled={saving} onClick={() => createSystemDraft(true)}>
            {tx("Create & submit reorder PR")}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="prq-reorder-summary">
            <strong>{suggestions.length}</strong> {tx("item(s) below reorder level loaded into the requisition lines.")}
          </div>
        )}
      </section>

      <section className="prq-panel prq-form-grid">
        <label>{tx("Priority")}<select value={priority} onChange={(e) => setPriority(e.target.value)}>{priorities.map((x) => <option key={x} value={x}>{tx(x)}</option>)}</select></label>
        <label>{tx("Required by")}<input type="date" value={requiredByDateUtc} onChange={(e) => setRequiredByDateUtc(e.target.value)} /></label>
        <label>{tx("Purchase category")}<input value={purchaseCategory} onChange={(e) => setPurchaseCategory(e.target.value)} placeholder={tx("Food, beverage, maintenance, service")} /></label>
        <label>{tx("Cost center")}<input value={costCenterCode} onChange={(e) => setCostCenterCode(e.target.value)} placeholder={tx("Optional")} /></label>
        <label>{tx("Reference")}<input value={relatedReference} onChange={(e) => setRelatedReference(e.target.value)} placeholder={tx("Optional project, event, work order")} /></label>
        <label className="prq-span-2">{tx("Business justification")}<textarea value={businessJustification} onChange={(e) => setBusinessJustification(e.target.value)} placeholder={tx("Why this purchase is required")} /></label>
        <label className="prq-span-2">{tx("Stock availability note")}<textarea value={stockAvailabilityNote} onChange={(e) => setStockAvailabilityNote(e.target.value)} placeholder={tx("Current stock, urgency, substitution notes")} /></label>
      </section>

      <section className="prq-panel">
        <div className="prq-section-title">
          <div><h2>{tx("Requested Lines")}</h2><p>{tx("Reorder-generated quantities remain editable before saving or submission.")}</p></div>
          <button className="prq-btn" type="button" onClick={() => setLines((current) => [...current, newLine()])}><Plus size={16} /> {tx("Add line")}</button>
        </div>
        <div className="prq-lines">
          {lines.map((line, index) => {
            const selectedItem = inventoryItemById.get(line.inventoryItemId ?? "");
            const purchaseUoms = purchaseUomsForItem(selectedItem);
            const isInventoryLine = line.lineType === "InventoryItem";

            return (
              <div className="prq-line" key={index}>
                <select
                  value={line.lineType}
                  onChange={(e) => updateLine(index, {
                    lineType: e.target.value,
                    inventoryItemId: e.target.value === "InventoryItem" ? line.inventoryItemId : null,
                    uomId: e.target.value === "InventoryItem" ? line.uomId : null,
                  })}
                >
                  {lineTypes.map((x) => <option key={x} value={x}>{tx(x)}</option>)}
                </select>
                {isInventoryLine ? (
                  <select
                    value={line.inventoryItemId ?? ""}
                    onChange={(e) => selectInventoryItem(index, e.target.value)}
                    disabled={loadingItems}
                  >
                    <option value="">{loadingItems ? tx("Loading inventory...") : tx("Select inventory item...")}</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{inventoryItemLabel(item)}</option>
                    ))}
                  </select>
                ) : (
                  <input value={line.itemName} onChange={(e) => updateLine(index, { itemName: e.target.value })} placeholder={tx("Item or service name")} />
                )}
                {isInventoryLine ? (
                  <select
                    value={line.uomId ?? ""}
                    onChange={(e) => selectPurchaseUom(index, line.inventoryItemId, e.target.value)}
                    disabled={!line.inventoryItemId || purchaseUoms.length === 0}
                  >
                    <option value="">{line.inventoryItemId ? tx("Select purchase UOM...") : tx("Select item first")}</option>
                    {purchaseUoms.map((uom) => (
                      <option key={uom.uomId} value={uom.uomId}>{uomLabel(uom)}</option>
                    ))}
                  </select>
                ) : (
                  <input value={line.uomName} onChange={(e) => updateLine(index, { uomName: e.target.value })} placeholder={tx("UOM")} />
                )}
                <input type="number" min="0" step="0.0001" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} />
                <input type="number" min="0" step="0.01" value={line.estimatedUnitPrice} onChange={(e) => updateLine(index, { estimatedUnitPrice: Number(e.target.value) })} />
                <strong>ETB {((Number(line.quantity) || 0) * (Number(line.estimatedUnitPrice) || 0)).toFixed(2)}</strong>
                <button className="prq-icon-btn" type="button" onClick={() => removeLine(index)} aria-label={tx("Remove line")}><Trash2 size={16} /></button>
                <textarea value={line.specification ?? ""} onChange={(e) => updateLine(index, { specification: e.target.value })} placeholder={tx("Specification, brand, grade, pack size")} />
                {isInventoryLine && line.inventoryItemId && purchaseUoms.length === 0 && (
                  <div className="prq-line-note">{tx("This inventory item has no active purchase UOM configured.")}</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="prq-total"><span>{tx("Estimated requisition total")}</span><strong>ETB {total.toFixed(2)}</strong></div>
      </section>
    </main>
  );
}