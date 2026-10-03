import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";
import ConfirmModal from "../../../components/ConfirmModal";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import RequisitionDocuments from "../components/RequisitionDocuments";
import SupplierReview from "../components/SupplierReview";
import { useI18n } from "../../../i18n";
import { inventoryItemsApi } from "../../inventoryMaster/items/api/inventoryItemsApi";
import type { InventoryItemDto, ItemUomDto } from "../../inventoryMaster/items/types";
import { suppliersApi, type Supplier, type SupplierInput, type SupplierItem } from "../api/purchasingApi";
import {
  ActionDialog,
  BackButton,
  ManageCard,
  LabeledSelect,
  LabeledTextarea,
  StatusChip,
  apiError,
  dateTime,
  money,
  useCompanyId,
} from "../components/p2pShared";

const EMPTY: SupplierInput = {
  code: "",
  name: "",
  legalName: "",
  category: "",
  taxId: "",
  vatRegistrationNo: "",
  isVatRegistered: false,
  isWithholdingExempt: false,
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  country: "Ethiopia",
  paymentTermDays: 30,
  currencyCode: "ETB",
  leadTimeDays: 0,
  bankName: "",
  bankAccountName: "",
  bankAccountNo: "",
  notes: "",
};

function toInput(s: Supplier): SupplierInput {
  return {
    code: s.code,
    name: s.name,
    legalName: s.legalName ?? "",
    category: s.category ?? "",
    taxId: s.taxId ?? "",
    vatRegistrationNo: s.vatRegistrationNo ?? "",
    isVatRegistered: s.isVatRegistered,
    isWithholdingExempt: s.isWithholdingExempt,
    contactPerson: s.contactPerson ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    city: s.city ?? "",
    country: s.country ?? "",
    paymentTermDays: s.paymentTermDays,
    currencyCode: s.currencyCode,
    leadTimeDays: s.leadTimeDays,
    bankName: s.bankName ?? "",
    bankAccountName: s.bankAccountName ?? "",
    bankAccountNo: s.bankAccountNo ?? "",
    notes: s.notes ?? "",
  };
}

function trimmed(input: SupplierInput): SupplierInput {
  const out = { ...input } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string") out[k] = v.trim() || null;
  out.name = input.name.trim();
  return out as SupplierInput;
}

function purchaseUoms(item?: InventoryItemDto | null): ItemUomDto[] {
  return (item?.uoms ?? item?.allowedUoms ?? []).filter((u) => u.isActive !== false && u.isPurchase);
}

type StatusAction = { status: string; label: string; danger?: boolean };

export default function SupplierEditorPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const { supplierId } = useParams<{ supplierId: string }>();
  const isNew = !supplierId;
  const navigate = useNavigate();
  const canCreate = useHasPermission("suppliers.create");
  const canUpdate = useHasPermission("suppliers.update");
  const canManage = useHasPermission("suppliers.manage");
  const canDelete = useHasPermission("suppliers.delete");
  const editable = isNew ? canCreate : canUpdate;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [priceList, setPriceList] = useState<SupplierItem[]>([]);
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [priceRow, setPriceRow] = useState({ inventoryItemId: "", uomId: "", agreedPrice: "", minOrderQty: "", leadTimeDays: "", supplierItemCode: "", isPreferred: false });

  const root = `/companies/${companyId}/procurement/suppliers`;
  const set = <K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function load() {
    if (!companyId || !supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await suppliersApi.get(companyId, supplierId);
      setSupplier(row);
      setForm(toInput(row));
      setPriceList(await suppliersApi.items(companyId, { supplierId }));
    } catch (e) {
      setError(apiError(e, "Unable to load supplier."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId, supplierId]);

  useEffect(() => {
    if (!companyId || isNew || !canUpdate) return;
    inventoryItemsApi.list(companyId).then((rows) => setItems(rows.filter((i) => i.isActive !== false))).catch(() => setItems([]));
  }, [companyId, isNew, canUpdate]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const rowUoms = purchaseUoms(itemById.get(priceRow.inventoryItemId));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) return setError(tx("Supplier name is required."));
    if (form.isVatRegistered && !form.taxId?.trim()) return setError(tx("A VAT-registered supplier needs a TIN."));
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (isNew) {
        const created = await suppliersApi.create(companyId, trimmed(form));
        navigate(`${root}/${created.id}`, { replace: true });
      } else if (supplier) {
        const updated = await suppliersApi.update(companyId, supplier.id, supplier.version, trimmed(form));
        setSupplier(updated);
        setForm(toInput(updated));
        setNotice(tx("Supplier saved."));
      }
    } catch (err) {
      setError(apiError(err, "Unable to save supplier."));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(reason: string) {
    if (!supplier || !statusAction) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await suppliersApi.changeStatus(companyId, supplier.id, supplier.version, statusAction.status, reason || undefined);
      setSupplier(updated);
      setForm(toInput(updated));
      setStatusAction(null);
    } catch (err) {
      setError(apiError(err, "Unable to change supplier status."));
      setStatusAction(null);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!supplier) return;
    setSaving(true);
    try {
      await suppliersApi.remove(companyId, supplier.id);
      navigate(root, { replace: true });
    } catch (err) {
      setError(apiError(err, "Unable to delete supplier. Set it to Inactive instead."));
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  async function savePrice(e: FormEvent) {
    e.preventDefault();
    if (!supplier || !priceRow.inventoryItemId || !priceRow.uomId) return;
    setSaving(true);
    setError(null);
    try {
      await suppliersApi.upsertItem(companyId, {
        supplierId: supplier.id,
        inventoryItemId: priceRow.inventoryItemId,
        uomId: priceRow.uomId,
        supplierItemCode: priceRow.supplierItemCode.trim() || null,
        agreedPrice: Number(priceRow.agreedPrice || 0),
        minOrderQty: Number(priceRow.minOrderQty || 0),
        leadTimeDays: priceRow.leadTimeDays ? Number(priceRow.leadTimeDays) : null,
        isPreferred: priceRow.isPreferred,
        isActive: true,
      });
      setPriceRow({ inventoryItemId: "", uomId: "", agreedPrice: "", minOrderQty: "", leadTimeDays: "", supplierItemCode: "", isPreferred: false });
      setPriceList(await suppliersApi.items(companyId, { supplierId: supplier.id }));
    } catch (err) {
      setError(apiError(err, "Unable to save price."));
    } finally {
      setSaving(false);
    }
  }

  const statusActions: StatusAction[] = !supplier || !canManage ? [] : [
    { status: "Approved", label: "Approve supplier" },
    { status: "PendingReview", label: "Request supplier review" },
    { status: "Suspended", label: "Suspend supplier", danger: true },
    { status: "Inactive", label: "Deactivate", danger: true },
  ].filter((a) => a.status !== supplier.status);

  if (loading) return <main className="p2p-page"><StateMessage tone="loading">{tx("Loading supplier...")}</StateMessage></main>;

  return (
    <main className="p2p-page">
      <PageHeader
        title={isNew ? tx("New supplier") : `${supplier?.code ?? ""} · ${supplier?.name ?? ""}`}
        subtitle={isNew ? tx("Register a vendor with tax and payment details.") : tx("Supplier master record")}
        actions={
          <>
            <BackButton to={root} label={tx("Suppliers")} />
            {supplier && <StatusChip status={supplier.status} />}
          </>
        }
      />

      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
      {notice && <StateMessage tone="success">{notice}</StateMessage>}
      {supplier?.statusReason && !["Active", "Approved"].includes(supplier.status) && (
        <StateMessage tone="warning">{tx("Status reason")}: {supplier.statusReason}</StateMessage>
      )}

      <form onSubmit={save}>
        <fieldset disabled={!editable || saving} className="p2p-grid p2p-fieldset">
          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("General")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              <FormField label={tx("Code")} value={form.code ?? ""} help={isNew ? tx("Leave blank to auto-number") : undefined} onChange={(e) => set("code", e.target.value)} />
              <FormField label={tx("Name")} required value={form.name} onChange={(e) => set("name", e.target.value)} />
              <FormField label={tx("Legal name")} value={form.legalName ?? ""} onChange={(e) => set("legalName", e.target.value)} />
              <FormField label={tx("Category")} value={form.category ?? ""} placeholder={tx("e.g. Meat, Beverage, Dry goods")} onChange={(e) => set("category", e.target.value)} />
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("Tax")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              <FormField label={tx("TIN")} value={form.taxId ?? ""} required={form.isVatRegistered} onChange={(e) => set("taxId", e.target.value)} />
              <FormField label={tx("VAT registration no.")} value={form.vatRegistrationNo ?? ""} onChange={(e) => set("vatRegistrationNo", e.target.value)} />
              <label className="p2p-check"><Checkbox checked={form.isVatRegistered} onChange={(e) => set("isVatRegistered", e.target.checked)} />{tx("VAT registered")}</label>
              <label className="p2p-check"><Checkbox checked={form.isWithholdingExempt} onChange={(e) => set("isWithholdingExempt", e.target.checked)} />{tx("Exempt from withholding")}</label>
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("Contact")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              <FormField label={tx("Contact person")} value={form.contactPerson ?? ""} onChange={(e) => set("contactPerson", e.target.value)} />
              <FormField label={tx("Phone")} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              <FormField label={tx("Email")} type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              <FormField label={tx("Address")} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              <FormField label={tx("City")} value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
              <FormField label={tx("Country")} value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("Commercial & bank")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              <FormField label={tx("Payment terms (days)")} type="number" min={0} max={365} value={form.paymentTermDays} onChange={(e) => set("paymentTermDays", Number(e.target.value || 0))} />
              <FormField label={tx("Lead time (days)")} type="number" min={0} max={365} value={form.leadTimeDays} onChange={(e) => set("leadTimeDays", Number(e.target.value || 0))} />
              <FormField label={tx("Currency")} maxLength={3} value={form.currencyCode ?? ""} onChange={(e) => set("currencyCode", e.target.value.toUpperCase())} />
              <FormField label={tx("Bank")} disabled={!canManage} value={form.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} />
              <FormField label={tx("Account name")} disabled={!canManage} value={form.bankAccountName ?? ""} onChange={(e) => set("bankAccountName", e.target.value)} />
              <FormField label={tx("Account number")} disabled={!canManage} value={form.bankAccountNo ?? ""} onChange={(e) => set("bankAccountNo", e.target.value)} />
              <div className="p2p-span-all">
                <LabeledTextarea label={tx("Notes")} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </fieldset>

        <div className="p2p-actions p2p-mt">
          {editable && <Button type="submit" disabled={saving}>{saving ? tx("Saving...") : isNew ? tx("Create supplier") : tx("Save changes")}</Button>}
        </div>
      </form>

      {supplier && (statusActions.length > 0 || canDelete) && (
        <ManageCard
          title={tx("Supplier status")}
          detail={tx("Only active or approved suppliers can receive new purchase orders. Suppliers with purchase history cannot be deleted; set them to Inactive instead.")}
        >
          {statusActions.map((a) => (
            <Button key={a.status} type="button" variant={a.danger ? "destructive" : "outline"} disabled={saving} onClick={() => setStatusAction(a)}>{tx(a.label)}</Button>
          ))}
          {canDelete && <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmDelete(true)}>{tx("Delete")}</Button>}
        </ManageCard>
      )}

      <SupplierReview companyId={companyId} id={supplier?.id} name={form.name} taxId={form.taxId} phone={form.phone}/>
      {supplier&&<RequisitionDocuments companyId={companyId} id={supplier.id} documentType="supplier" editable={canUpdate} onChanged={()=>void load()}/>}

      {supplier && (
        <Card>
          <CardHeader><CardTitle>{tx("Price list")}</CardTitle></CardHeader>
          <CardContent>
            {priceList.length === 0 ? (
              <EmptyState title={tx("No prices yet")} detail={tx("Agreed prices default onto purchase orders. Last prices update when receipts are posted.")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Item")}</TableHead>
                    <TableHead>{tx("UOM")}</TableHead>
                    <TableHead>{tx("Supplier code")}</TableHead>
                    <TableHead className="p2p-right">{tx("Agreed price")}</TableHead>
                    <TableHead className="p2p-right">{tx("Last price")}</TableHead>
                    <TableHead>{tx("Last purchase")}</TableHead>
                    <TableHead className="p2p-right">{tx("Min qty")}</TableHead>
                    <TableHead>{tx("Preferred")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.itemName ?? p.inventoryItemId}</TableCell>
                      <TableCell>{p.uomName ?? "-"}</TableCell>
                      <TableCell>{p.supplierItemCode ?? "-"}</TableCell>
                      <TableCell className="p2p-right">{money(p.agreedPrice, supplier.currencyCode)}</TableCell>
                      <TableCell className="p2p-right">{money(p.lastPrice, supplier.currencyCode)}</TableCell>
                      <TableCell>{dateTime(p.lastPurchaseAtUtc)}</TableCell>
                      <TableCell className="p2p-right">{p.minOrderQty}</TableCell>
                      <TableCell>{p.isPreferred ? tx("Yes") : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {canUpdate && <h3 className="p2p-subhead">{tx("Add or update a price")}</h3>}
            {canUpdate && (
              <form onSubmit={savePrice} className="p2p-toolbar">
                <LabeledSelect label={tx("Item")} required value={priceRow.inventoryItemId}
                  onChange={(e) => {
                    const uoms = purchaseUoms(itemById.get(e.target.value));
                    setPriceRow((r) => ({ ...r, inventoryItemId: e.target.value, uomId: uoms.find((u) => u.isBase)?.uomId ?? uoms[0]?.uomId ?? "" }));
                  }}>
                  <option value="">{tx("Select item")}</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} - ` : ""}{i.name}</option>)}
                </LabeledSelect>
                <LabeledSelect label={tx("UOM")} required value={priceRow.uomId} onChange={(e) => setPriceRow((r) => ({ ...r, uomId: e.target.value }))}>
                  <option value="">{tx("Select")}</option>
                  {rowUoms.map((u) => <option key={u.uomId} value={u.uomId}>{u.code} - {u.name}</option>)}
                </LabeledSelect>
                <FormField label={tx("Agreed price")} type="number" min={0} step="0.0001" required value={priceRow.agreedPrice} onChange={(e) => setPriceRow((r) => ({ ...r, agreedPrice: e.target.value }))} />
                <FormField label={tx("Min qty")} type="number" min={0} step="0.0001" value={priceRow.minOrderQty} onChange={(e) => setPriceRow((r) => ({ ...r, minOrderQty: e.target.value }))} />
                <FormField label={tx("Supplier code")} value={priceRow.supplierItemCode} onChange={(e) => setPriceRow((r) => ({ ...r, supplierItemCode: e.target.value }))} />
                <label className="p2p-check"><Checkbox checked={priceRow.isPreferred} onChange={(e) => setPriceRow((r) => ({ ...r, isPreferred: e.target.checked }))} />{tx("Preferred")}</label>
                <div className="p2p-toolbar-actions"><Button type="submit" disabled={saving}>{tx("Save price")}</Button></div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <ActionDialog
        open={!!statusAction}
        title={statusAction ? tx(statusAction.label) : ""}
        message={tx("Only active or approved suppliers can receive new purchase orders.")}
        confirmText={statusAction ? tx(statusAction.label) : ""}
        danger={statusAction?.danger}
        commentLabel={tx("Reason")}
        commentRequired={statusAction?.status !== "Approved"}
        busy={saving}
        onConfirm={(reason) => void changeStatus(reason)}
        onClose={() => setStatusAction(null)}
      />
      <ConfirmModal
        open={confirmDelete}
        title={tx("Delete supplier")}
        message={tx("Suppliers with purchase history cannot be deleted. Set them to Inactive instead.")}
        confirmText={tx("Delete")}
        cancelText={tx("Cancel")}
        danger
        busy={saving}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </main>
  );
}
