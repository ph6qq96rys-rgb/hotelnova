import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useI18n } from "../../../i18n";
import { grnApi } from "../../inventory/grn/api/grnApi";
import type { GrnDetailDto, GrnListDto } from "../../inventory/grn/types/grn.types";
import { purchaseReturnsApi } from "../api/purchasingApi";
import { LabeledSelect, LabeledTextarea, apiError, date, money, qty, todayIso, useCompanyId } from "../components/p2pShared";

const REASONS = ["Damaged", "Expired", "Wrong item", "Quality rejected", "Over-delivered", "Other"];

export default function PurchaseReturnCreatePage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [grns, setGrns] = useState<GrnListDto[]>([]);
  const [grnId, setGrnId] = useState(params.get("grnId") ?? "");
  const [grn, setGrn] = useState<GrnDetailDto | null>(null);
  const [form, setForm] = useState({ returnDate: todayIso(), reason: "Damaged", notes: "" });
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    grnApi.list(companyId, { status: "POSTED" }).then(setGrns).catch((e) => setError(apiError(e, "Unable to load goods receipts.")));
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !grnId) {
      setGrn(null);
      return;
    }
    setQuantities({});
    grnApi.getById(companyId, grnId).then(setGrn).catch((e) => setError(apiError(e, "Unable to load goods receipt.")));
  }, [companyId, grnId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!grn || saving) return;
    const lines = Object.entries(quantities)
      .map(([grnLineId, v]) => ({ grnLineId, quantity: Number(v) }))
      .filter((l) => Number.isFinite(l.quantity) && l.quantity > 0);
    if (lines.length === 0) return setError(tx("Enter a return quantity on at least one line."));
    const over = grn.lines.find((l) => Number(quantities[l.id] || 0) > Number(l.quantity));
    if (over) return setError(`${over.itemName ?? ""}: ${tx("return quantity cannot exceed the quantity received.")}`);
    setSaving(true);
    setError(null);
    try {
      const created = await purchaseReturnsApi.create(companyId, {
        grnId: grn.id,
        returnDate: form.returnDate,
        reason: form.reason,
        notes: form.notes.trim() || null,
        lines,
      });
      navigate(`/companies/${companyId}/procurement/purchase-returns/${created.id}`, { replace: true });
    } catch (err) {
      setError(apiError(err, "Unable to create purchase return."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p2p-page">
      <PageHeader
        title={tx("New purchase return")}
        subtitle={tx("Saved as a draft. Posting it removes the stock at receipt cost and reduces the PO received quantity.")}
        actions={<Button variant="outline" onClick={() => navigate(-1)}>{tx("Cancel")}</Button>}
      />
      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}

      <form onSubmit={save}>
        <fieldset disabled={saving} className="p2p-fieldset p2p-grid">
          <Card className="p2p-span-all">
            <CardContent className="p2p-grid p2p-mt">
              <LabeledSelect label={tx("Goods receipt")} required value={grnId} onChange={(e) => setGrnId(e.target.value)}>
                <option value="">{tx("Select posted GRN")}</option>
                {grns.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.grnNo ?? g.grnNumber} · {g.supplierName ?? "-"} · {date(g.receivedDate ?? g.receiptDate ?? g.receivedAt ?? null)}
                  </option>
                ))}
              </LabeledSelect>
              <FormField label={tx("Return date")} type="date" required value={form.returnDate} onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))} />
              <LabeledSelect label={tx("Reason")} required value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
                {REASONS.map((r) => <option key={r} value={r}>{tx(r)}</option>)}
              </LabeledSelect>
            </CardContent>
          </Card>

          {grn && (
            <Card className="p2p-span-all">
              <CardHeader><CardTitle>{tx("Lines")} · {grn.supplierName ?? ""} · {grn.receivingLocationName ?? grn.locationName ?? ""}</CardTitle></CardHeader>
              <CardContent>
                <Table className="p2p-lines">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tx("Item")}</TableHead>
                      <TableHead>{tx("Batch")}</TableHead>
                      <TableHead className="p2p-right">{tx("Received")}</TableHead>
                      <TableHead className="p2p-right">{tx("Unit cost")}</TableHead>
                      <TableHead className="p2p-right">{tx("Return qty")}</TableHead>
                      <TableHead className="p2p-right">{tx("Value")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grn.lines.map((l) => {
                      const returning = Number(quantities[l.id] || 0);
                      const tooMany = returning > Number(l.quantity);
                      return (
                      <TableRow key={l.id}>
                        <TableCell>{l.itemName ?? l.itemCode}<div className="p2p-muted">{l.uomName ?? l.uomCode}</div></TableCell>
                        <TableCell>{l.batchNo || "-"}</TableCell>
                        <TableCell className="p2p-right">{qty(Number(l.quantity))}</TableCell>
                        <TableCell className="p2p-right">{money(Number(l.unitCost))}</TableCell>
                        <TableCell>
                          <Input aria-label={tx("Return qty")} aria-invalid={tooMany || undefined} type="number" min={0} max={Number(l.quantity)} step="0.0001" value={quantities[l.id] ?? ""}
                            onChange={(e) => setQuantities((q) => ({ ...q, [l.id]: e.target.value }))} />
                        </TableCell>
                        <TableCell className="p2p-right p2p-nowrap">{returning > 0 ? money(returning * Number(l.unitCost)) : "-"}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="p2p-totals">
                  <strong>{tx("Return value")}: {money(grn.lines.reduce((sum, l) => sum + Number(quantities[l.id] || 0) * Number(l.unitCost), 0))}</strong>
                  <span className="p2p-muted">{tx("Quantities already returned on other returns are checked by the server.")}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="p2p-span-all">
            <CardContent className="p2p-mt">
              <LabeledTextarea label={tx("Notes")} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </CardContent>
          </Card>
        </fieldset>
        <div className="p2p-actions p2p-mt">
          <Button type="submit" disabled={saving || !grn}>{saving ? tx("Saving...") : tx("Save draft return")}</Button>
        </div>
      </form>
    </main>
  );
}
