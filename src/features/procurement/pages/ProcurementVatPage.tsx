import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import {
  purchaseVatApi,
  VAT_TREATMENT_LABELS,
  type VatCategoryRow,
  type VatItemRow,
  type VatTreatment,
} from "../api/purchasingApi";
import { apiError, useCompanyId } from "../components/p2pShared";

/**
 * Which purchases carry VAT. Each category has a VAT setting its items follow, and any item can have its own.
 * Purchase order and invoice lines take their VAT from here; exempt and zero-rated items carry none.
 */

const TREATMENTS: VatTreatment[] = ["Standard", "ZeroRated", "Exempt"];
const INHERIT = "";

function badgeVariant(t: VatTreatment) {
  return t === "Standard" ? "secondary" : t === "Exempt" ? "warning" : "success";
}

export default function ProcurementVatPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const canManagePurchasing = useHasPermission("purchasing.manage");
  const canManagePayables = useHasPermission("finance.payables.manage");
  const canManage = canManagePurchasing || canManagePayables;
  const [categories, setCategories] = useState<VatCategoryRow[]>([]);
  const [items, setItems] = useState<VatItemRow[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [treatmentFilter, setTreatmentFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkValue, setBulkValue] = useState<string>("Exempt");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    if (!companyId) return;
    setCategories(await purchaseVatApi.categories(companyId));
  }, [companyId]);

  const loadItems = useCallback(async () => {
    if (!companyId) return;
    setItems(await purchaseVatApi.items(companyId, {
      q: search.trim() || undefined,
      categoryId: categoryFilter || undefined,
      treatment: (treatmentFilter || undefined) as VatTreatment | undefined,
    }));
    setSelected([]);
  }, [companyId, search, categoryFilter, treatmentFilter]);

  useEffect(() => {
    loadCategories().catch((e) => setError(apiError(e, "Unable to load VAT settings.")));
  }, [loadCategories]);

  useEffect(() => {
    const timer = setTimeout(() => { loadItems().catch((e) => setError(apiError(e, "Unable to load items."))); }, 250);
    return () => clearTimeout(timer);
  }, [loadItems]);

  async function run(work: () => Promise<string>) {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try { setNotice(await work()); }
    catch (e) { setError(apiError(e, "Unable to save the VAT setting.")); }
    finally { setBusy(false); }
  }

  const setCategory = (row: VatCategoryRow, value: string) => run(async () => {
    await purchaseVatApi.setCategory(companyId, row.id, value === INHERIT ? null : value as VatTreatment);
    await Promise.all([loadCategories(), loadItems()]);
    return tx("VAT setting saved for {name}.", { name: row.name });
  });

  const setItemsTo = (ids: string[], value: string) => run(async () => {
    const result = await purchaseVatApi.setItems(companyId, ids, value === INHERIT ? null : value as VatTreatment);
    await loadItems();
    return tx("{count} items updated.", { count: result.changed });
  });

  const counts = useMemo(() => ({
    exempt: items.filter((i) => i.effective === "Exempt").length,
    zero: items.filter((i) => i.effective === "ZeroRated").length,
  }), [items]);
  const allSelected = items.length > 0 && selected.length === items.length;

  return (
    <main className="p2p-page">
      <PageHeader
        title={tx("VAT on Purchases")}
        subtitle={tx("Set which items are VAT exempt or zero-rated. Purchase order and invoice lines follow these settings; exempt and zero-rated items carry no VAT.")}
      />
      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
      {notice && <StateMessage tone="success">{notice}</StateMessage>}
      {!canManage && <StateMessage tone="info">{tx("You can view these settings. Changing them requires the purchasing manage permission.")}</StateMessage>}
      <StateMessage tone="info">{tx("Changes apply to new purchase orders and invoices. Documents already saved keep their VAT until they are edited.")}</StateMessage>

      <Card className="p2p-mt">
        <CardHeader><CardTitle>{tx("By category")}</CardTitle></CardHeader>
        <CardContent>
          <p className="p2p-muted">{tx("Items without their own setting follow their category (or its parent category). Categories without a setting are standard VAT.")}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Category")}</TableHead>
                <TableHead className="p2p-right">{tx("Items")}</TableHead>
                <TableHead>{tx("VAT setting")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><strong>{c.name}</strong> <span className="p2p-muted">{c.code}</span></TableCell>
                  <TableCell className="p2p-right">{c.itemCount}</TableCell>
                  <TableCell>
                    <Select aria-label={`${tx("VAT setting")} ${c.name}`} value={c.vatTreatment ?? INHERIT} disabled={!canManage || busy}
                      onChange={(e) => void setCategory(c, e.target.value)}>
                      <option value={INHERIT}>{c.parentId ? tx("Same as parent category") : tx("Standard VAT (not set)")}</option>
                      {TREATMENTS.map((t) => <option key={t} value={t}>{tx(VAT_TREATMENT_LABELS[t])}</option>)}
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="p2p-mt">
        <CardHeader><CardTitle>{tx("By item")}</CardTitle></CardHeader>
        <CardContent>
          <div className="p2p-grid">
            <Input aria-label={tx("Search items")} placeholder={tx("Search name or SKU")} value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select aria-label={tx("Category")} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">{tx("All categories")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select aria-label={tx("VAT")} value={treatmentFilter} onChange={(e) => setTreatmentFilter(e.target.value)}>
              <option value="">{tx("Any VAT")}</option>
              {TREATMENTS.map((t) => <option key={t} value={t}>{tx(VAT_TREATMENT_LABELS[t])}</option>)}
            </Select>
          </div>
          <p className="p2p-muted p2p-mt">{tx("{shown} items shown · {exempt} exempt · {zero} zero-rated", { shown: items.length, exempt: counts.exempt, zero: counts.zero })}</p>
          {canManage && (
            <div className="p2p-actions p2p-mt">
              <Select aria-label={tx("Set selected items to")} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
                {TREATMENTS.map((t) => <option key={t} value={t}>{tx(VAT_TREATMENT_LABELS[t])}</option>)}
                <option value={INHERIT}>{tx("Follow the category")}</option>
              </Select>
              <Button type="button" disabled={busy || selected.length === 0} onClick={() => void setItemsTo(selected, bulkValue)}>
                {tx("Apply to {count} selected", { count: selected.length })}
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && <TableHead><Checkbox aria-label={tx("Select all")} checked={allSelected} onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])} /></TableHead>}
                <TableHead>{tx("Item")}</TableHead>
                <TableHead>{tx("Category")}</TableHead>
                <TableHead>{tx("VAT")}</TableHead>
                <TableHead>{tx("Item setting")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  {canManage && <TableCell><Checkbox aria-label={`${tx("Select")} ${i.name}`} checked={selected.includes(i.id)}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, i.id] : selected.filter((x) => x !== i.id))} /></TableCell>}
                  <TableCell><strong>{i.name}</strong>{i.sku ? <div className="p2p-muted">{i.sku}</div> : null}</TableCell>
                  <TableCell>{i.categoryName ?? "-"}</TableCell>
                  <TableCell><Badge variant={badgeVariant(i.effective)}>{tx(VAT_TREATMENT_LABELS[i.effective])}</Badge></TableCell>
                  <TableCell>
                    <Select aria-label={`${tx("VAT setting")} ${i.name}`} value={i.vatTreatment ?? INHERIT} disabled={!canManage || busy}
                      onChange={(e) => void setItemsTo([i.id], e.target.value)}>
                      <option value={INHERIT}>{tx("Follow the category")}</option>
                      {TREATMENTS.map((t) => <option key={t} value={t}>{tx(VAT_TREATMENT_LABELS[t])}</option>)}
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {items.length >= 300 && <p className="p2p-muted">{tx("Showing the first 300 items. Search or filter to find others.")}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
