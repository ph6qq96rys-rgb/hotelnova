import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useI18n } from "../../../i18n";
import {
  purchaseOrdersApi,
  supplierInvoicesApi,
  suppliersApi,
  type PurchaseOrder,
  type SupplierInvoice,
  type SupplierInvoiceInput,
  type SupplierLookup,
} from "../api/purchasingApi";
import { LabeledSelect, LabeledTextarea, apiError, money, qty, todayIso, useCompanyId } from "../components/p2pShared";

type LineForm = {
  key: string;
  purchaseOrderLineId?: string | null;
  inventoryItemId?: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
  hint?: string;
};

let seq = 0;
const blankLine = (): LineForm => ({ key: `i${++seq}`, description: "", quantity: "", unitPrice: "", taxRatePercent: "" });
const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const INVOICEABLE = new Set(["Approved", "Sent", "PartiallyReceived", "Received", "Closed"]);

function linesFromPo(po: PurchaseOrder, tx: (text: string) => string): LineForm[] {
  return po.lines
    .map((l) => {
      // Matching compares against received (stock) or accepted (services) quantity, both reported as receivedQty.
      const basis = l.receivedQty;
      const open = Math.max(0, basis - l.invoicedQty);
      return {
        key: `i${++seq}`,
        purchaseOrderLineId: l.id,
        inventoryItemId: l.inventoryItemId,
        description: l.itemName,
        quantity: open > 0 ? String(open) : "",
        unitPrice: String(l.netUnitPrice),
        taxRatePercent: String(l.taxRatePercent),
        hint: `${l.uomName || ""} · ${tx(l.lineType === "InventoryItem" ? "Received" : "Accepted")} ${qty(basis)} · ${tx("Invoiced")} ${qty(l.invoicedQty)}`,
      };
    })
    .filter((l) => l.quantity !== "");
}

export default function SupplierInvoiceCreatePage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const [editing, setEditing] = useState<SupplierInvoice | null>(null);
  const initialPoId = params.get("purchaseOrderId") ?? "";

  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [header, setHeader] = useState({
    supplierId: "",
    purchaseOrderId: initialPoId,
    supplierInvoiceNo: "",
    fiscalReference: "",
    invoiceDate: todayIso(),
    dueDate: "",
    currencyCode: "",
    exchangeRate: "1",
    notes: "",
  });
  const [lines, setLines] = useState<LineForm[]>([blankLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = `/companies/${companyId}/procurement/supplier-invoices`;

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const sup = await suppliersApi.lookup(companyId, undefined, true);
        if (cancelled) return;
        setSuppliers(sup);
        if (editId) {
          const inv = await supplierInvoicesApi.get(companyId, editId);
          if (cancelled) return;
          setEditing(inv);
          if (inv.purchaseOrderId) {
            const order = await purchaseOrdersApi.get(companyId, inv.purchaseOrderId);
            if (!cancelled) setPo(order);
          }
          setHeader({
            supplierId: inv.supplierId,
            purchaseOrderId: inv.purchaseOrderId ?? "",
            supplierInvoiceNo: inv.supplierInvoiceNo,
            fiscalReference: inv.fiscalReference ?? "",
            invoiceDate: inv.invoiceDate?.slice(0, 10) ?? todayIso(),
            dueDate: inv.dueDate?.slice(0, 10) ?? "",
            currencyCode: inv.currencyCode,
            exchangeRate: String(inv.exchangeRate ?? 1),
            notes: inv.notes ?? "",
          });
          setLines(inv.lines.map((l) => ({
            key: `i${++seq}`,
            purchaseOrderLineId: l.purchaseOrderLineId ?? null,
            inventoryItemId: l.inventoryItemId ?? null,
            description: l.description,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            taxRatePercent: String(l.taxRatePercent),
            hint: l.poReceivedQty != null ? `${tx("Received")} ${qty(l.poReceivedQty)}` : undefined,
          })));
        } else if (initialPoId) {
          const order = await purchaseOrdersApi.get(companyId, initialPoId);
          if (cancelled) return;
          setPo(order);
          setHeader((h) => ({ ...h, supplierId: order.supplierId, purchaseOrderId: order.id, currencyCode: order.currencyCode, exchangeRate: String(order.exchangeRate) }));
          setLines(linesFromPo(order, tx));
        }
      } catch (e) {
        if (!cancelled) setError(apiError(e, "Unable to load invoice form."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, initialPoId, editId]);

  useEffect(() => {
    if (!companyId || !header.supplierId) {
      setOrders([]);
      return;
    }
    purchaseOrdersApi
      .list(companyId, { supplierId: header.supplierId, pageSize: 100 })
      .then((r) => setOrders(r.items.filter((o) => INVOICEABLE.has(o.status))))
      .catch(() => setOrders([]));
  }, [companyId, header.supplierId]);

  async function selectPo(id: string) {
    setHeader((h) => ({ ...h, purchaseOrderId: id }));
    if (!id) {
      setPo(null);
      setLines([blankLine()]);
      return;
    }
    try {
      const order = await purchaseOrdersApi.get(companyId, id);
      setPo(order);
      setHeader((h) => ({ ...h, currencyCode: order.currencyCode, exchangeRate: String(order.exchangeRate) }));
      const prefilled = linesFromPo(order, tx);
      setLines(prefilled.length ? prefilled : [blankLine()]);
      if (!prefilled.length) setError(tx("Nothing is left to invoice on this purchase order."));
    } catch (e) {
      setError(apiError(e, "Unable to load purchase order."));
    }
  }

  const updateLine = (key: string, patch: Partial<LineForm>) => setLines((rows) => rows.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const currency = header.currencyCode || po?.currencyCode || suppliers.find((s) => s.id === header.supplierId)?.currencyCode || "ETB";

  const totals = useMemo(() => {
    let net = 0;
    let tax = 0;
    for (const l of lines) {
      const n = num(l.quantity) * num(l.unitPrice);
      net += n;
      tax += (n * num(l.taxRatePercent)) / 100;
    }
    return { net, tax, total: net + tax };
  }, [lines]);

  async function save(e: FormEvent, runMatch: boolean) {
    e.preventDefault();
    if (saving) return;
    if (!header.supplierId) return setError(tx("Select a supplier."));
    if (!header.supplierInvoiceNo.trim()) return setError(tx("Supplier invoice number is required."));
    const active = lines.filter((l) => l.description.trim() || l.quantity);
    if (active.length === 0) return setError(tx("Add at least one line."));
    if (active.some((l) => num(l.quantity) <= 0 || !l.description.trim())) return setError(tx("Every line needs a description and a quantity above zero."));

    const input: SupplierInvoiceInput = {
      supplierId: header.supplierId,
      purchaseOrderId: header.purchaseOrderId || null,
      supplierInvoiceNo: header.supplierInvoiceNo.trim(),
      fiscalReference: header.fiscalReference.trim() || null,
      invoiceDate: header.invoiceDate,
      dueDate: header.dueDate || null,
      currencyCode: header.currencyCode || null,
      exchangeRate: num(header.exchangeRate) || 1,
      notes: header.notes.trim() || null,
      prefillFromPurchaseOrder: false,
      lines: active.map((l) => ({
        purchaseOrderLineId: l.purchaseOrderLineId ?? null,
        inventoryItemId: l.inventoryItemId ?? null,
        description: l.description.trim(),
        quantity: num(l.quantity),
        unitPrice: num(l.unitPrice),
        taxRatePercent: l.taxRatePercent === "" ? null : num(l.taxRatePercent),
      })),
    };
    setSaving(true);
    setError(null);
    try {
      let saved: SupplierInvoice;
      if (editing) {
        // Editing resets the three-way match; re-run it when asked so the invoice is reviewable again.
        saved = await supplierInvoicesApi.update(companyId, editing.id, editing.version, input);
        if (runMatch) saved = await supplierInvoicesApi.match(companyId, saved.id, saved.version);
      } else {
        saved = await supplierInvoicesApi.create(companyId, input, runMatch);
      }
      navigate(`${root}/${saved.id}`, { replace: true });
    } catch (err) {
      setError(apiError(err, "Unable to record supplier invoice."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="p2p-page"><StateMessage tone="loading">{tx("Loading invoice form...")}</StateMessage></main>;

  return (
    <main className="p2p-page">
      <PageHeader
        title={editing ? `${tx("Edit")} ${editing.internalNo}` : tx("Record supplier invoice")}
        subtitle={tx("Enter the invoice exactly as the supplier issued it. The three-way match compares it with the purchase order and goods received.")}
        actions={<Button variant="outline" onClick={() => navigate(-1)}>{tx("Cancel")}</Button>}
      />
      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}

      <form onSubmit={(e) => void save(e, true)}>
        <fieldset disabled={saving} className="p2p-fieldset p2p-grid">
          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("Invoice")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              <LabeledSelect label={tx("Supplier")} required value={header.supplierId} disabled={!!initialPoId || !!editing}
                onChange={(e) => {
                  setHeader((h) => ({ ...h, supplierId: e.target.value, purchaseOrderId: "" }));
                  setPo(null);
                  setLines([blankLine()]);
                }}>
                <option value="">{tx("Select supplier")}</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </LabeledSelect>
              <LabeledSelect label={tx("Purchase order")} value={header.purchaseOrderId} disabled={!header.supplierId || !!initialPoId || !!editing} onChange={(e) => void selectPo(e.target.value)}>
                <option value="">{tx("No purchase order (direct expense)")}</option>
                {po && !orders.some((o) => o.id === po.id) && <option value={po.id}>{po.poNo}</option>}
                {orders.map((o) => <option key={o.id} value={o.id}>{o.poNo} · {money(o.grandTotal, o.currencyCode)}</option>)}
              </LabeledSelect>
              <FormField label={tx("Supplier invoice no.")} required value={header.supplierInvoiceNo} onChange={(e) => setHeader((h) => ({ ...h, supplierInvoiceNo: e.target.value }))} />
              <FormField label={tx("Fiscal / machine receipt no.")} value={header.fiscalReference} onChange={(e) => setHeader((h) => ({ ...h, fiscalReference: e.target.value }))} />
              <FormField label={tx("Invoice date")} type="date" required value={header.invoiceDate} onChange={(e) => setHeader((h) => ({ ...h, invoiceDate: e.target.value }))} />
              <FormField label={tx("Due date")} type="date" value={header.dueDate} help={tx("Blank = invoice date + supplier terms")} onChange={(e) => setHeader((h) => ({ ...h, dueDate: e.target.value }))} />
              <FormField label={tx("Currency")} maxLength={3} placeholder={currency} value={header.currencyCode} onChange={(e) => setHeader((h) => ({ ...h, currencyCode: e.target.value.toUpperCase() }))} />
              <FormField label={tx("Exchange rate")} type="number" min={0} step="0.000001" value={header.exchangeRate} onChange={(e) => setHeader((h) => ({ ...h, exchangeRate: e.target.value }))} />
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardHeader>
              <div className="p2p-section-head">
                <CardTitle>{tx("Lines")}</CardTitle>
                {!po && <Button type="button" variant="outline" size="sm" onClick={() => setLines((r) => [...r, blankLine()])}><Plus size={14} />{tx("Add line")}</Button>}
              </div>
            </CardHeader>
            <CardContent>
              {po && <StateMessage tone="info">{tx("Lines are prefilled with the quantity not yet invoiced at the PO net price. Change them to match the supplier's invoice.")}</StateMessage>}
              <Table className="p2p-lines">
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Description")}</TableHead>
                    <TableHead className="p2p-right">{tx("Qty")}</TableHead>
                    <TableHead className="p2p-right">{tx("Unit Price")}</TableHead>
                    <TableHead className="p2p-right">{tx("Tax %")}</TableHead>
                    <TableHead className="p2p-right">{tx("Net")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell className="p2p-wide">
                        {l.purchaseOrderLineId
                          ? <div className="p2p-text-cell">{l.description}</div>
                          : <Input aria-label={tx("Description")} value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} />}
                        {l.hint && <div className="p2p-muted">{l.hint}</div>}
                      </TableCell>
                      <TableCell><Input aria-label={tx("Qty")} type="number" min={0} step="0.0001" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} /></TableCell>
                      <TableCell><Input aria-label={tx("Unit Price")} type="number" min={0} step="0.0001" value={l.unitPrice} onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })} /></TableCell>
                      <TableCell><Input aria-label={tx("Tax %")} type="number" min={0} max={100} step="0.01" value={l.taxRatePercent} onChange={(e) => updateLine(l.key, { taxRatePercent: e.target.value })} /></TableCell>
                      <TableCell className="p2p-right">{money(num(l.quantity) * num(l.unitPrice), currency)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" aria-label={tx("Remove line")} disabled={lines.length === 1} onClick={() => setLines((r) => r.filter((x) => x.key !== l.key))}>
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p2p-totals">
                <span>{tx("Net")}: {money(totals.net, currency)}</span>
                <span>{tx("Tax")}: {money(totals.tax, currency)}</span>
                <strong>{tx("Invoice total")}: {money(totals.total, currency)}</strong>
                <span className="p2p-muted">{tx("Withholding, if applicable, is calculated by the server.")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardContent className="p2p-mt">
              <LabeledTextarea label={tx("Notes")} value={header.notes} onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))} />
            </CardContent>
          </Card>
        </fieldset>

        <div className="p2p-actions p2p-mt">
          <Button type="submit" disabled={saving}>{saving ? tx("Saving...") : tx("Save and match")}</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={(e) => void save(e as unknown as FormEvent, false)}>{tx(editing ? "Save without matching" : "Save as draft")}</Button>
        </div>
      </form>
    </main>
  );
}
