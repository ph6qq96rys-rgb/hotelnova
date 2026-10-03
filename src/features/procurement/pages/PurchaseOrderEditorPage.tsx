import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useI18n } from "../../../i18n";
import { useAppScope } from "../../../app/useAppScope";
import { inventoryItemsApi } from "../../inventoryMaster/items/api/inventoryItemsApi";
import NegotiatedPriceHint from "../components/NegotiatedPriceHint";
import type { InventoryItemDto, ItemUomDto } from "../../inventoryMaster/items/types";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";
import type { StockLocationDto } from "../../inventory/stock-locations/types";
import {
  PO_LINE_TYPES,
  purchaseOrdersApi,
  purchasingSetupApi,
  suppliersApi,
  type PurchaseOrder,
  type PurchaseOrderInput,
  type SupplierItem,
  type SupplierLookup,
} from "../api/purchasingApi";
import { LabeledSelect, LabeledTextarea, apiError, money, splitWords, todayIso, useCompanyId } from "../components/p2pShared";

type LineForm = {
  key: string;
  lineType: string;
  inventoryItemId: string;
  itemName: string;
  uomId: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxRatePercent: string;
  requisitionLineId?: string | null;
  notes: string;
};

let seq = 0;
const newLine = (): LineForm => ({
  key: `l${++seq}`,
  lineType: "InventoryItem",
  inventoryItemId: "",
  itemName: "",
  uomId: "",
  quantity: "",
  unitPrice: "",
  discountPercent: "0",
  taxRatePercent: "",
  notes: "",
});

function purchaseUoms(item?: InventoryItemDto | null): ItemUomDto[] {
  return (item?.uoms ?? item?.allowedUoms ?? [])
    .filter((u) => u.isActive !== false && u.isPurchase)
    .sort((a, b) => Number(b.isBase) - Number(a.isBase) || a.code.localeCompare(b.code));
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function PurchaseOrderEditorPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  // Branch-scoped users must send their branch when the delivery warehouse is company-level.
  const scope = useAppScope();

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [priceList, setPriceList] = useState<SupplierItem[]>([]);
  const [defaultVat, setDefaultVat] = useState(15);
  const [header, setHeader] = useState({
    supplierId: "",
    deliveryLocationId: "",
    orderDate: todayIso(),
    expectedDeliveryDate: todayIso(3),
    currencyCode: "",
    exchangeRate: "1",
    paymentTermDays: "",
    supplierReference: "",
    notes: "",
    terms: "",
  });
  const [lines, setLines] = useState<LineForm[]>([newLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const root = `/companies/${companyId}/procurement/purchase-orders`;

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sup, locs, its, settings] = await Promise.all([
          suppliersApi.lookup(companyId),
          stockLocationsApi.list(companyId),
          inventoryItemsApi.list(companyId),
          purchasingSetupApi.getSettings(companyId).catch(() => null),
        ]);
        if (cancelled) return;
        setSuppliers(sup);
        // Only warehouses that accept goods receipts can be PO delivery locations (the API enforces this too).
        const active = locs.filter((l) => l.isActive !== false);
        const receiving = active.filter((l) => (l as { canReceiveGrn?: boolean }).canReceiveGrn === true);
        setLocations(receiving.length > 0 ? receiving : active);
        setItems(its.filter((i) => i.isActive !== false));
        if (settings) setDefaultVat(settings.defaultVatRatePercent);
        if (id) {
          const po = await purchaseOrdersApi.get(companyId, id);
          if (cancelled) return;
          setOrder(po);
          if (!sup.some((s) => s.id === po.supplierId)) {
            setSuppliers([...sup, { id: po.supplierId, code: po.supplierCode ?? "", name: po.supplierName ?? "", status: "", currencyCode: po.currencyCode, paymentTermDays: po.paymentTermDays }]);
          }
          setHeader({
            supplierId: po.supplierId,
            deliveryLocationId: po.deliveryLocationId,
            orderDate: po.orderDate?.slice(0, 10) ?? todayIso(),
            expectedDeliveryDate: po.expectedDeliveryDate?.slice(0, 10) ?? "",
            currencyCode: po.currencyCode,
            exchangeRate: String(po.exchangeRate ?? 1),
            paymentTermDays: String(po.paymentTermDays ?? ""),
            supplierReference: po.supplierReference ?? "",
            notes: po.notes ?? "",
            terms: po.terms ?? "",
          });
          setLines(po.lines.map((l) => ({
            key: `l${++seq}`,
            lineType: l.lineType,
            inventoryItemId: l.inventoryItemId ?? "",
            itemName: l.itemName,
            uomId: l.uomId ?? "",
            quantity: String(l.orderedQty),
            unitPrice: String(l.unitPrice),
            discountPercent: String(l.discountPercent),
            taxRatePercent: String(l.taxRatePercent),
            requisitionLineId: l.requisitionLineId,
            notes: l.notes ?? "",
          })));
        }
      } catch (e) {
        if (!cancelled) setError(apiError(e, "Unable to load purchase order form."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, id]);

  useEffect(() => {
    if (!companyId || !header.supplierId) {
      setPriceList([]);
      return;
    }
    suppliersApi.items(companyId, { supplierId: header.supplierId }).then(setPriceList).catch(() => setPriceList([]));
  }, [companyId, header.supplierId]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const supplier = suppliers.find((s) => s.id === header.supplierId);
  const currency = header.currencyCode || supplier?.currencyCode || "ETB";

  function priceFor(itemId: string, uomId: string): string {
    const row = priceList.find((p) => p.inventoryItemId === itemId && p.uomId === uomId && p.isActive);
    if (row && (row.agreedPrice > 0 || row.lastPrice > 0)) return String(row.agreedPrice > 0 ? row.agreedPrice : row.lastPrice);
    return "";
  }

  const updateLine = (key: string, patch: Partial<LineForm>) =>
    setLines((rows) => rows.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const totals = useMemo(() => {
    let net = 0;
    let tax = 0;
    for (const l of lines) {
      const gross = num(l.quantity) * num(l.unitPrice);
      const lineNet = gross - (gross * num(l.discountPercent)) / 100;
      net += lineNet;
      tax += (lineNet * (l.taxRatePercent === "" ? defaultVat : num(l.taxRatePercent))) / 100;
    }
    return { net, tax, total: net + tax };
  }, [lines, defaultVat]);

  function buildInput(): PurchaseOrderInput | string {
    if (!header.supplierId) return "Select a supplier.";
    if (!header.deliveryLocationId) return "Select a delivery location.";
    const active = lines.filter((l) => l.inventoryItemId || l.itemName.trim() || l.quantity);
    if (active.length === 0) return "Add at least one line.";
    for (const [i, l] of active.entries()) {
      if (l.lineType === "InventoryItem" && (!l.inventoryItemId || !l.uomId)) return `Line ${i + 1}: select an item and unit.`;
      if (l.lineType !== "InventoryItem" && !l.itemName.trim()) return `Line ${i + 1}: enter a description.`;
      if (num(l.quantity) <= 0) return `Line ${i + 1}: quantity must be greater than zero.`;
    }
    return {
      supplierId: header.supplierId,
      deliveryLocationId: header.deliveryLocationId,
      orderDate: header.orderDate || null,
      expectedDeliveryDate: header.expectedDeliveryDate || null,
      currencyCode: header.currencyCode || null,
      exchangeRate: num(header.exchangeRate) || 1,
      paymentTermDays: header.paymentTermDays === "" ? null : num(header.paymentTermDays),
      supplierReference: header.supplierReference.trim() || null,
      notes: header.notes.trim() || null,
      terms: header.terms.trim() || null,
      lines: active.map((l) => ({
        lineType: l.lineType,
        inventoryItemId: l.lineType === "InventoryItem" ? l.inventoryItemId : null,
        itemName: l.lineType === "InventoryItem" ? null : l.itemName.trim(),
        uomId: l.lineType === "InventoryItem" ? l.uomId : null,
        quantity: num(l.quantity),
        unitPrice: l.unitPrice === "" ? null : num(l.unitPrice),
        discountPercent: num(l.discountPercent),
        taxRatePercent: l.taxRatePercent === "" ? null : num(l.taxRatePercent),
        requisitionLineId: l.requisitionLineId ?? null,
        notes: l.notes.trim() || null,
      })),
    };
  }

  async function save(submit: boolean, e?: FormEvent) {
    e?.preventDefault();
    if (saving) return;
    const input = buildInput();
    if (typeof input === "string") return setError(tx(input));
    setSaving(true);
    setError(null);
    try {
      let saved: PurchaseOrder;
      if (isNew) {
        saved = await purchaseOrdersApi.create(companyId, input, submit);
      } else {
        saved = await purchaseOrdersApi.update(companyId, order!.id, order!.version, input);
        if (submit) saved = await purchaseOrdersApi.action(companyId, saved.id, "submit", saved.version);
      }
      navigate(`${root}/${saved.id}`, { replace: true });
    } catch (err) {
      setError(apiError(err, "Unable to save purchase order."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="p2p-page"><StateMessage tone="loading">{tx("Loading purchase order form...")}</StateMessage></main>;
  if (order && order.status !== "Draft") {
    return (
      <main className="p2p-page">
        <StateMessage tone="warning" action={<Button variant="outline" size="sm" onClick={() => navigate(`${root}/${order.id}`)}>{tx("Open")}</Button>}>
          {tx("Only draft purchase orders can be edited. Use Amend on an approved order to create a new revision.")}
        </StateMessage>
      </main>
    );
  }

  return (
    <main className="p2p-page">
      <PageHeader
        title={isNew ? tx("New purchase order") : `${tx("Edit")} ${order?.poNo ?? ""}`}
        subtitle={tx("Blank prices default from the supplier price list, then last price, then item cost. Blank tax uses the company VAT rate.")}
        actions={<Button variant="outline" onClick={() => navigate(isNew ? root : `${root}/${id}`)}>{tx("Cancel")}</Button>}
      />
      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}

      <form onSubmit={(e) => void save(false, e)}>
        <fieldset disabled={saving} className="p2p-fieldset p2p-grid">
          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("Order")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              <LabeledSelect label={tx("Supplier")} required value={header.supplierId}
                onChange={(e) => {
                  const s = suppliers.find((x) => x.id === e.target.value);
                  setHeader((h) => ({ ...h, supplierId: e.target.value, currencyCode: s?.currencyCode ?? h.currencyCode, paymentTermDays: s ? String(s.paymentTermDays) : h.paymentTermDays }));
                }}>
                <option value="">{tx("Select supplier")}</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </LabeledSelect>
              <LabeledSelect label={tx("Deliver to")} required value={header.deliveryLocationId} onChange={(e) => setHeader((h) => ({ ...h, deliveryLocationId: e.target.value }))}>
                <option value="">{tx("Select receiving location")}</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.code ? ` (${l.code})` : ""}</option>)}
              </LabeledSelect>
              <FormField label={tx("Order date")} type="date" value={header.orderDate} onChange={(e) => setHeader((h) => ({ ...h, orderDate: e.target.value }))} />
              <FormField label={tx("Expected delivery")} type="date" value={header.expectedDeliveryDate} onChange={(e) => setHeader((h) => ({ ...h, expectedDeliveryDate: e.target.value }))} />
              <FormField label={tx("Currency")} maxLength={3} value={header.currencyCode} placeholder={currency} onChange={(e) => setHeader((h) => ({ ...h, currencyCode: e.target.value.toUpperCase() }))} />
              <FormField label={tx("Exchange rate")} type="number" min={0} step="0.000001" value={header.exchangeRate} onChange={(e) => setHeader((h) => ({ ...h, exchangeRate: e.target.value }))} />
              <FormField label={tx("Payment terms (days)")} type="number" min={0} value={header.paymentTermDays} onChange={(e) => setHeader((h) => ({ ...h, paymentTermDays: e.target.value }))} />
              <FormField label={tx("Supplier reference")} value={header.supplierReference} onChange={(e) => setHeader((h) => ({ ...h, supplierReference: e.target.value }))} />
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardHeader>
              <div className="p2p-section-head">
                <CardTitle>{tx("Lines")}</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((r) => [...r, newLine()])}><Plus size={14} />{tx("Add line")}</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table className="p2p-lines">
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Type")}</TableHead>
                    <TableHead>{tx("Item or Service")}</TableHead>
                    <TableHead>{tx("UOM")}</TableHead>
                    <TableHead className="p2p-right">{tx("Qty")}</TableHead>
                    <TableHead className="p2p-right">{tx("Unit Price")}</TableHead>
                    <TableHead className="p2p-right">{tx("Disc. %")}</TableHead>
                    <TableHead className="p2p-right">{tx("Tax %")}</TableHead>
                    <TableHead className="p2p-right">{tx("Net")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const item = itemById.get(l.inventoryItemId);
                    const uoms = purchaseUoms(item);
                    const gross = num(l.quantity) * num(l.unitPrice);
                    const net = gross - (gross * num(l.discountPercent)) / 100;
                    return (
                      <TableRow key={l.key}>
                        <TableCell className="p2p-type">
                          <Select aria-label={tx("Type")} value={l.lineType} onChange={(e) => updateLine(l.key, { lineType: e.target.value, inventoryItemId: "", uomId: "", itemName: "" })}>
                            {PO_LINE_TYPES.map((t) => <option key={t} value={t}>{tx(splitWords(t))}</option>)}
                          </Select>
                        </TableCell>
                        <TableCell className="p2p-wide">
                          {l.lineType === "InventoryItem" ? (
                            <Select aria-label={tx("Item")} value={l.inventoryItemId}
                              onChange={(e) => {
                                const next = itemById.get(e.target.value);
                                const u = purchaseUoms(next);
                                const uomId = u.find((x) => x.isBase)?.uomId ?? u[0]?.uomId ?? "";
                                updateLine(l.key, { inventoryItemId: e.target.value, uomId, unitPrice: l.unitPrice || priceFor(e.target.value, uomId) });
                              }}>
                              <option value="">{tx("Select item")}</option>
                              {items.map((i) => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} - ` : ""}{i.name}</option>)}
                            </Select>
                          ) : (
                            <Input aria-label={tx("Description")} value={l.itemName} onChange={(e) => updateLine(l.key, { itemName: e.target.value })} />
                          )}
                          {l.requisitionLineId && <div className="p2p-muted">{tx("From requisition")}</div>}
                        </TableCell>
                        <TableCell>
                          {l.lineType === "InventoryItem" ? (
                            <Select aria-label={tx("UOM")} value={l.uomId} onChange={(e) => updateLine(l.key, { uomId: e.target.value, unitPrice: priceFor(l.inventoryItemId, e.target.value) || l.unitPrice })}>
                              <option value="">-</option>
                              {uoms.map((u) => <option key={u.uomId} value={u.uomId}>{u.code}</option>)}
                            </Select>
                          ) : <span className="p2p-muted">-</span>}
                        </TableCell>
                        <TableCell><Input aria-label={tx("Qty")} type="number" min={0} step="0.0001" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} /></TableCell>
                        <TableCell><Input aria-label={tx("Unit Price")} type="number" min={0} step="0.0001" placeholder={tx("Auto")} value={l.unitPrice} onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })} /><NegotiatedPriceHint companyId={companyId} supplierId={header.supplierId} branchId={locations.find(x=>x.id===header.deliveryLocationId)?.branchId ?? (scope.branchId || null)} itemId={l.inventoryItemId} uomId={l.uomId} quantity={Number(l.quantity)} currency={currency} date={header.orderDate} onUse={price=>updateLine(l.key,{unitPrice:String(price),discountPercent:"0"})}/></TableCell>
                        <TableCell><Input aria-label={tx("Disc. %")} type="number" min={0} max={100} step="0.01" value={l.discountPercent} onChange={(e) => updateLine(l.key, { discountPercent: e.target.value })} /></TableCell>
                        <TableCell><Input aria-label={tx("Tax %")} type="number" min={0} max={100} step="0.01" placeholder={`${defaultVat}%`} value={l.taxRatePercent} onChange={(e) => updateLine(l.key, { taxRatePercent: e.target.value })} /></TableCell>
                        <TableCell className="p2p-right">{l.unitPrice === "" ? tx("Auto") : money(net, currency)}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" aria-label={tx("Remove line")} disabled={lines.length === 1} onClick={() => setLines((r) => r.filter((x) => x.key !== l.key))}>
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="p2p-totals">
                <span>{tx("Net")}: {money(totals.net, currency)}</span>
                <span>{tx("Tax")}: {money(totals.tax, currency)}</span>
                <strong>{tx("Estimated total")}: {money(totals.total, currency)}</strong>
                <span className="p2p-muted">{tx("Final totals are calculated by the server.")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardContent className="p2p-grid p2p-mt">
              <LabeledTextarea label={tx("Notes")} value={header.notes} onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))} />
              <LabeledTextarea label={tx("Terms and conditions")} value={header.terms} onChange={(e) => setHeader((h) => ({ ...h, terms: e.target.value }))} />
            </CardContent>
          </Card>
        </fieldset>

        <div className="p2p-actions p2p-mt">
          <Button type="button" disabled={saving} onClick={() => void save(true)}>{saving ? tx("Saving...") : tx("Save and submit")}</Button>
          <Button type="submit" variant="outline" disabled={saving}>{tx("Save draft")}</Button>
        </div>
      </form>
    </main>
  );
}
