import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Textarea } from "../../../../components/ui/textarea";
import { StateMessage, EmptyState } from "../../../../components/ui/Feedback";
import { useDialogFocus } from "../../../../components/ui/useDialogFocus";
import ConfirmModal from "../../../../components/ConfirmModal";
import { useAppScope } from "../../../../app/useAppScope";
import { useHasPermission } from "../../../../auth/usePermissions";
import { useI18n } from "../../../../i18n";
import { useInventoryCatalogs } from "../../../../components/controls/useInventoryCatalogs";
import { sivApi, type SivLookupOptionDto } from "../api/sivApi";
import {
  replenishmentRulesApi,
  type ReplenishmentRuleDto,
  type ReplenishmentRuleInput,
} from "../api/replenishmentRulesApi";
import { fmtQty, getApiError } from "../types/sivTypes";
import "../components/sivLowStock.css";

type Target = "all" | "category" | "item";
type Location = { id: string; name: string };

type FormState = {
  branchId: string;
  stockLocationId: string;
  target: Target;
  categoryId: string;
  inventoryItemId: string;
  coverageDays: string;
  leadTimeDays: string;
  safetyStockDays: string;
  safetyStockQty: string;
  minStockQty: string;
  maxStockQty: string;
  excluded: "" | "true" | "false";
  notes: string;
};

const EMPTY_FORM: FormState = {
  branchId: "",
  stockLocationId: "",
  target: "all",
  categoryId: "",
  inventoryItemId: "",
  coverageDays: "",
  leadTimeDays: "",
  safetyStockDays: "",
  safetyStockQty: "",
  minStockQty: "",
  maxStockQty: "",
  excluded: "",
  notes: "",
};

const text = (value: number | null | undefined) => (value == null ? "" : String(value));
const num = (value: string) => (value.trim() === "" ? null : Number(value));

function toForm(rule: ReplenishmentRuleDto): FormState {
  return {
    branchId: rule.branchId ?? "",
    stockLocationId: rule.stockLocationId ?? "",
    target: rule.inventoryItemId ? "item" : rule.categoryId ? "category" : "all",
    categoryId: rule.categoryId ?? "",
    inventoryItemId: rule.inventoryItemId ?? "",
    coverageDays: text(rule.coverageDays),
    leadTimeDays: text(rule.leadTimeDays),
    safetyStockDays: text(rule.safetyStockDays),
    safetyStockQty: text(rule.safetyStockQty),
    minStockQty: text(rule.minStockQty),
    maxStockQty: text(rule.maxStockQty),
    excluded: rule.excluded == null ? "" : rule.excluded ? "true" : "false",
    notes: rule.notes ?? "",
  };
}

function toLocations(rows: unknown[]): Location[] {
  const seen = new Set<string>();
  return (rows as Array<Record<string, unknown>>)
    .map((x) => ({ id: String(x.id ?? x.locationId ?? ""), name: String(x.name ?? x.locationName ?? x.code ?? "") }))
    .filter((x) => x.id && x.name && !seen.has(x.id) && !!seen.add(x.id));
}

/**
 * Replenishment rules for the low-stock SIV generator. For each parameter the
 * most specific active rule wins: item over category over "all items", then
 * location over branch over company. Empty fields inherit.
 */
export default function ReplenishmentRulesPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const canManage = useHasPermission("inventory.replenishment.manage");
  const catalogs = useInventoryCatalogs(companyId || null);

  const [rules, setRules] = useState<ReplenishmentRuleDto[]>([]);
  const [branches, setBranches] = useState<SivLookupOptionDto[]>([]);
  const [filterBranchId, setFilterBranchId] = useState(branchId || "");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ReplenishmentRuleDto | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<ReplenishmentRuleDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      setRules(await replenishmentRulesApi.list(companyId, { branchId: filterBranchId || undefined, includeInactive }));
    } catch (e) {
      setError(getApiError(e, tx("Unable to load replenishment rules.")));
    } finally {
      setLoading(false);
    }
  }, [companyId, filterBranchId, includeInactive, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    sivApi
      .getFilterLookups(companyId)
      .then((x) => setBranches(x.branches))
      .catch(() => setBranches([]));
  }, [companyId]);

  async function confirmDeactivate() {
    if (!companyId || !deactivating) return;
    setBusy(true);
    try {
      await replenishmentRulesApi.deactivate(companyId, deactivating.id, deactivating.version);
      setDeactivating(null);
      await load();
    } catch (e) {
      setError(getApiError(e, tx("Unable to deactivate the rule.")));
      setDeactivating(null);
    } finally {
      setBusy(false);
    }
  }

  function safetyText(rule: ReplenishmentRuleDto) {
    if (rule.safetyStockQty != null) return `${fmtQty(rule.safetyStockQty)} ${rule.baseUomCode ?? ""}`.trim();
    if (rule.safetyStockDays != null) return `${fmtQty(rule.safetyStockDays)} ${tx("days")}`;
    return "–";
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">{tx("Inventory")}</div>
          <div className="page-title">{tx("Replenishment Rules")}</div>
          <div className="page-sub">
            {tx("Coverage, lead time, safety and min/max stock used when generating SIVs from low stock. The most specific rule wins for each value; empty values inherit.")}
          </div>
        </div>
        {canManage && (
          <div className="ui-page-actions">
            <Button type="button" onClick={() => setEditing("new")} disabled={!companyId}>
              {tx("+ New rule")}
            </Button>
          </div>
        )}
      </div>

      <div className="replenishment-rules__toolbar">
        <label className="ui-field">
          <span>{tx("Branch")}</span>
          <Select value={filterBranchId} onChange={(e) => setFilterBranchId(e.target.value)}>
            <option value="">{tx("All branches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="replenishment-rules__check">
          <Checkbox checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          <span>{tx("Show inactive rules")}</span>
        </label>
      </div>

      {error && <StateMessage tone="error">{error}</StateMessage>}
      {loading && <StateMessage tone="loading">{tx("Loading...")}</StateMessage>}

      {!loading && rules.length === 0 && !error ? (
        <EmptyState
          title={tx("No replenishment rules yet")}
          detail={tx("Without rules, the low-stock check uses the days to cover you choose, no lead time or safety stock, and each item's reorder level as the minimum.")}
        />
      ) : (
        <div className="siv-lowstock__table-wrap">
          <table className="siv-lowstock__table">
            <thead>
              <tr>
                <th>{tx("Applies to")}</th>
                <th>{tx("Where")}</th>
                <th className="num">{tx("Days to cover")}</th>
                <th className="num">{tx("Lead time")}</th>
                <th className="num">{tx("Safety stock")}</th>
                <th className="num">{tx("Minimum")}</th>
                <th className="num">{tx("Maximum")}</th>
                <th>{tx("Replenish")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className={rule.isActive ? undefined : "is-off"}>
                  <td>
                    <div className="siv-lowstock__item">
                      <strong>
                        {rule.itemName ?? (rule.categoryName ? `${tx("Category")}: ${rule.categoryName}` : tx("All items"))}
                      </strong>
                      <span>
                        {rule.itemCode ?? ""}
                        {!rule.isActive && <span className="siv-lowstock__status">{tx("Inactive")}</span>}
                      </span>
                      {rule.notes && <small>{rule.notes}</small>}
                    </div>
                  </td>
                  <td>{rule.stockLocationName ?? rule.branchName ?? tx("Whole company")}</td>
                  <td className="num">{rule.coverageDays ?? "–"}</td>
                  <td className="num">{rule.leadTimeDays == null ? "–" : `${rule.leadTimeDays} ${tx("days")}`}</td>
                  <td className="num">{safetyText(rule)}</td>
                  <td className="num">{rule.minStockQty == null ? "–" : `${fmtQty(rule.minStockQty)} ${rule.baseUomCode ?? ""}`}</td>
                  <td className="num">{rule.maxStockQty == null ? "–" : `${fmtQty(rule.maxStockQty)} ${rule.baseUomCode ?? ""}`}</td>
                  <td>{rule.excluded == null ? "–" : rule.excluded ? tx("Excluded") : tx("Included")}</td>
                  <td>
                    {canManage && rule.isActive && (
                      <div className="replenishment-rules__actions">
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(rule)}>
                          {tx("Edit")}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setDeactivating(rule)}>
                          {tx("Deactivate")}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && companyId && (
        <RuleDialog
          companyId={companyId}
          rule={editing === "new" ? null : editing}
          defaultBranchId={filterBranchId}
          branches={branches}
          categories={catalogs.data?.categories ?? []}
          items={catalogs.data?.items ?? []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      <ConfirmModal
        open={!!deactivating}
        title={tx("Deactivate rule?")}
        message={tx("The low-stock check will stop using this rule. It stays in the history and broader rules apply instead.")}
        confirmText={tx("Deactivate")}
        cancelText={tx("Cancel")}
        danger
        busy={busy}
        onConfirm={confirmDeactivate}
        onClose={() => setDeactivating(null)}
      />
    </div>
  );
}

function RuleDialog({
  companyId,
  rule,
  defaultBranchId,
  branches,
  categories,
  items,
  onClose,
  onSaved,
}: {
  companyId: string;
  rule: ReplenishmentRuleDto | null;
  defaultBranchId: string;
  branches: SivLookupOptionDto[];
  categories: { id: string; name: string; isActive?: boolean }[];
  items: { id: string; name: string; sku?: string | null; isActive?: boolean }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { tx } = useI18n();
  const titleId = useId();
  const [form, setForm] = useState<FormState>(rule ? toForm(rule) : { ...EMPTY_FORM, branchId: defaultBranchId });
  const [locations, setLocations] = useState<Location[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const close = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);
  useDialogFocus(true, saving, close);

  useEffect(() => {
    let cancelled = false;
    sivApi
      .getStockLocations(companyId, { branchId: form.branchId || undefined })
      .then((rows) => {
        if (!cancelled) setLocations(toLocations(rows));
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, form.branchId]);

  const itemOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return items
      .filter((x) => x.isActive !== false || x.id === form.inventoryItemId)
      .filter((x) => !q || x.name.toLowerCase().includes(q) || (x.sku ?? "").toLowerCase().includes(q) || x.id === form.inventoryItemId)
      .slice(0, 200);
  }, [items, itemSearch, form.inventoryItemId]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const isItem = form.target === "item";

  async function save() {
    setError("");
    if (form.target === "item" && !form.inventoryItemId) return setError(tx("Choose an item."));
    if (form.target === "category" && !form.categoryId) return setError(tx("Choose a category."));

    const input: ReplenishmentRuleInput = {
      branchId: form.branchId || null,
      stockLocationId: form.stockLocationId || null,
      inventoryItemId: isItem ? form.inventoryItemId : null,
      categoryId: form.target === "category" ? form.categoryId : null,
      coverageDays: num(form.coverageDays),
      leadTimeDays: num(form.leadTimeDays),
      safetyStockDays: num(form.safetyStockDays),
      safetyStockQty: isItem ? num(form.safetyStockQty) : null,
      minStockQty: isItem ? num(form.minStockQty) : null,
      maxStockQty: isItem ? num(form.maxStockQty) : null,
      excluded: form.excluded === "" ? null : form.excluded === "true",
      notes: form.notes.trim() || null,
      version: rule?.version ?? null,
    };

    setSaving(true);
    try {
      if (rule) await replenishmentRulesApi.update(companyId, rule.id, input);
      else await replenishmentRulesApi.create(companyId, input);
      await onSaved();
    } catch (e) {
      setError(getApiError(e, tx("Unable to save the rule.")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ui-dialog-backdrop">
      <div className="ui-dialog replenishment-rules__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ui-dialog-header">
          <h3 id={titleId}>{rule ? tx("Edit replenishment rule") : tx("New replenishment rule")}</h3>
        </div>
        <div className="ui-dialog-body replenishment-rules__form">
          <fieldset>
            <legend>{tx("Where")}</legend>
            <label className="ui-field">
              <span>{tx("Branch")}</span>
              <Select value={form.branchId} disabled={saving} onChange={(e) => set({ branchId: e.target.value, stockLocationId: "" })}>
                <option value="">{tx("All branches")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="ui-field">
              <span>{tx("Stock location")}</span>
              <Select value={form.stockLocationId} disabled={saving} onChange={(e) => set({ stockLocationId: e.target.value })}>
                <option value="">{tx("All locations")}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </label>
          </fieldset>

          <fieldset>
            <legend>{tx("Applies to")}</legend>
            <label className="ui-field">
              <span>{tx("Items")}</span>
              <Select value={form.target} disabled={saving} onChange={(e) => set({ target: e.target.value as Target })}>
                <option value="all">{tx("All items")}</option>
                <option value="category">{tx("A category")}</option>
                <option value="item">{tx("One item")}</option>
              </Select>
            </label>
            {form.target === "category" && (
              <label className="ui-field">
                <span>{tx("Category")}</span>
                <Select value={form.categoryId} disabled={saving} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="">{tx("Select category")}</option>
                  {categories
                    .filter((c) => c.isActive !== false || c.id === form.categoryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </label>
            )}
            {isItem && (
              <>
                <label className="ui-field">
                  <span>{tx("Find item")}</span>
                  <Input value={itemSearch} disabled={saving} placeholder={tx("Name or code")} onChange={(e) => setItemSearch(e.target.value)} />
                </label>
                <label className="ui-field">
                  <span>{tx("Item")}</span>
                  <Select value={form.inventoryItemId} disabled={saving} onChange={(e) => set({ inventoryItemId: e.target.value })}>
                    <option value="">{tx("Select item")}</option>
                    {itemOptions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                        {i.sku ? ` (${i.sku})` : ""}
                      </option>
                    ))}
                  </Select>
                </label>
              </>
            )}
          </fieldset>

          <fieldset>
            <legend>{tx("Values (leave empty to inherit)")}</legend>
            <NumberField label={tx("Days to cover")} value={form.coverageDays} disabled={saving} min={1} max={90} onChange={(v) => set({ coverageDays: v })} />
            <NumberField label={tx("Lead time (days)")} value={form.leadTimeDays} disabled={saving} min={0} max={60} onChange={(v) => set({ leadTimeDays: v })} />
            <NumberField label={tx("Safety stock (days of usage)")} value={form.safetyStockDays} disabled={saving} min={0} max={60} step="0.5" onChange={(v) => set({ safetyStockDays: v })} />
            {isItem ? (
              <>
                <NumberField label={tx("Safety stock (base unit)")} value={form.safetyStockQty} disabled={saving} min={0} step="any" onChange={(v) => set({ safetyStockQty: v })} />
                <NumberField label={tx("Minimum stock (base unit)")} value={form.minStockQty} disabled={saving} min={0} step="any" onChange={(v) => set({ minStockQty: v })} />
                <NumberField label={tx("Maximum stock (base unit)")} value={form.maxStockQty} disabled={saving} min={0} step="any" onChange={(v) => set({ maxStockQty: v })} />
              </>
            ) : (
              <p className="replenishment-rules__hint">{tx("Quantities in base units can only be set on a single-item rule.")}</p>
            )}
            <label className="ui-field">
              <span>{tx("Replenish")}</span>
              <Select value={form.excluded} disabled={saving} onChange={(e) => set({ excluded: e.target.value as FormState["excluded"] })}>
                <option value="">{tx("Inherit")}</option>
                <option value="true">{tx("Exclude from replenishment")}</option>
                <option value="false">{tx("Include (overrides a broader exclusion)")}</option>
              </Select>
            </label>
            <label className="ui-field replenishment-rules__notes">
              <span>{tx("Notes")}</span>
              <Textarea value={form.notes} disabled={saving} maxLength={500} rows={2} onChange={(e) => set({ notes: e.target.value })} />
            </label>
          </fieldset>

          {error && <StateMessage tone="error">{error}</StateMessage>}
        </div>
        <div className="ui-dialog-actions">
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            {tx("Cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? tx("Saving...") : tx("Save rule")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  min,
  max,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      <Input type="number" inputMode="decimal" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
