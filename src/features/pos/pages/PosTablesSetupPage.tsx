import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useAppScope } from "../../../app/useAppScope";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { posServiceApi, type DiningAreaDto, type PosServiceSettingsDto, type RestaurantTableDto } from "../api/posServiceApi";
import { Textarea } from "../../../components/ui/textarea";
import { PosDialog } from "../components/PosDialog";
import { extractApiError } from "../utils/posUtils";
import "../pos-service.css";

type TableDraft = Omit<RestaurantTableDto, "id"> & { id?: string };

function TableRow({ table, areas, busy, canManage, onSave }: {
  table: TableDraft;
  areas: DiningAreaDto[];
  busy: boolean;
  canManage: boolean;
  onSave: (table: TableDraft) => Promise<boolean>;
}) {
  const { tx } = useI18n();
  const [draft, setDraft] = useState(table);
  useEffect(() => setDraft(table), [table]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(table);
  const isNew = !table.id;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSave(draft) && isNew) setDraft(table);
  };

  return (
    <form className={isNew ? "rpos-setup-row rpos-setup-row--new" : "rpos-setup-row"} onSubmit={submit}
      aria-label={isNew ? tx("New table") : `${tx("Table")} ${table.number}`}>
      <Input value={draft.number} maxLength={30} required disabled={!canManage || busy} placeholder={isNew ? tx("New table number") : undefined}
        aria-label={tx("Table number")} onChange={(e) => setDraft({ ...draft, number: e.target.value })} />
      <Input type="number" min={1} max={100} value={draft.seats} required disabled={!canManage || busy} aria-label={tx("Seats")}
        onChange={(e) => setDraft({ ...draft, seats: Number(e.target.value) })} />
      <Select value={draft.areaId} disabled={!canManage || busy} aria-label={tx("Area")} onChange={(e) => setDraft({ ...draft, areaId: e.target.value })}>
        {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
      </Select>
      {isNew ? <span /> : (
        <label className="rpos-check">
          <Checkbox checked={draft.isActive} disabled={!canManage || busy} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
          {tx("In service")}
        </label>
      )}
      {canManage ? (
        <Button type="submit" size="sm" variant={isNew ? "default" : "outline"} disabled={busy || !dirty || !draft.number.trim() || !(draft.seats >= 1)}>
          {isNew ? <><Plus size={14} aria-hidden="true" /> {tx("Add table")}</> : tx("Save")}
        </Button>
      ) : null}
    </form>
  );
}

type ServiceDraft = Omit<PosServiceSettingsDto, "source" | "tableRequired" | "waiterRequired" | "holdReasons"> & { holdReasons: string };

/** How the branch takes and holds orders: table service or quick service, and what Hold Order asks for. */
function ServiceSettingsCard({ scope, canManage }: { scope: { companyId: string; branchId: string }; canManage: boolean }) {
  const { tx } = useI18n();
  const [current, setCurrent] = useState<PosServiceSettingsDto | null>(null);
  const [draft, setDraft] = useState<ServiceDraft | null>(null);
  const [level, setLevel] = useState<"branch" | "company">("branch");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const toDraft = (x: PosServiceSettingsDto): ServiceDraft => ({
    serviceStyle: x.serviceStyle, quickServiceRequiresTable: x.quickServiceRequiresTable, quickServiceRequiresWaiter: x.quickServiceRequiresWaiter,
    requireGuestCount: x.requireGuestCount, requireHoldReason: x.requireHoldReason, holdReasons: x.holdReasons.join("\n"),
    markTableForCleaningAfterPayment: x.markTableForCleaningAfterPayment, version: x.version ?? null,
  });

  useEffect(() => {
    if (!scope.companyId || !scope.branchId) return;
    posServiceApi.serviceSettings(scope)
      .then((x) => { setCurrent(x); setDraft(toDraft(x)); setLevel(x.source === "company" ? "company" : "branch"); })
      .catch((err) => setMessage({ tone: "error", text: extractApiError(err, tx("POS service settings could not be loaded.")) }));
  }, [scope, tx]);

  if (!draft) return null;
  const set = (patch: Partial<ServiceDraft>) => setDraft({ ...draft, ...patch });
  const reasons = draft.holdReasons.split("\n").map((x) => x.trim()).filter(Boolean);
  const quick = draft.serviceStyle === "quickService";
  const save = async () => {
    setBusy(true); setMessage(null);
    try {
      const sameRow = current?.source === level;
      const saved = await posServiceApi.saveServiceSettings(scope, { ...draft, holdReasons: reasons, version: sameRow ? draft.version ?? null : null }, level);
      setCurrent(saved); setDraft(toDraft(saved));
      setMessage({ tone: "success", text: tx("POS service settings saved.") });
    } catch (err) {
      setMessage({ tone: "error", text: extractApiError(err, tx("The change could not be saved.")) });
    } finally {
      setBusy(false);
    }
  };
  const locked = !canManage || busy;

  return (
    <section className="rpos-setup-area" aria-label={tx("Order taking")}>
      <header><h2>{tx("Order taking")}</h2>
        <span className="rpos-muted">{tx(current?.source === "branch" ? "This branch uses its own settings." : current?.source === "company" ? "This branch uses the company default." : "Default settings.")}</span>
      </header>
      {message ? <StateMessage tone={message.tone}>{message.text}</StateMessage> : null}
      <div className="rpos-chip-row" role="radiogroup" aria-label={tx("Service style")}>
        {(["tableService", "quickService"] as const).map((style) => (
          <Button key={style} type="button" role="radio" aria-checked={draft.serviceStyle === style} disabled={locked}
            variant={draft.serviceStyle === style ? "default" : "outline"} onClick={() => set({ serviceStyle: style })}>
            {tx(style === "tableService" ? "Table service (dine-in restaurant)" : "Quick service (fast food)")}
          </Button>
        ))}
      </div>
      <p className="rpos-muted">{tx(quick
        ? "Orders can be held without a table or waiter unless you require them below."
        : "Dine-in orders are held at a table for a waiter. Waiters are their own server; cashiers choose one.")}</p>
      {quick ? (
        <div className="rpos-chip-row">
          <label className="rpos-check"><Checkbox checked={draft.quickServiceRequiresTable} disabled={locked} onChange={(e) => set({ quickServiceRequiresTable: e.target.checked })} />{tx("Dine-in holds need a table")}</label>
          <label className="rpos-check"><Checkbox checked={draft.quickServiceRequiresWaiter} disabled={locked} onChange={(e) => set({ quickServiceRequiresWaiter: e.target.checked })} />{tx("Holds need a waiter")}</label>
        </div>
      ) : null}
      <div className="rpos-chip-row">
        <label className="rpos-check"><Checkbox checked={draft.requireGuestCount} disabled={locked} onChange={(e) => set({ requireGuestCount: e.target.checked })} />{tx("Ask for the guest count")}</label>
        <label className="rpos-check"><Checkbox checked={draft.requireHoldReason} disabled={locked} onChange={(e) => set({ requireHoldReason: e.target.checked })} />{tx("A hold reason is required")}</label>
        <label className="rpos-check"><Checkbox checked={draft.markTableForCleaningAfterPayment} disabled={locked} onChange={(e) => set({ markTableForCleaningAfterPayment: e.target.checked })} />{tx("Mark tables Needs cleaning after payment")}</label>
      </div>
      <label className="rpos-field">
        <span>{tx("Hold reasons (one per line)")}</span>
        <Textarea rows={4} value={draft.holdReasons} disabled={locked} onChange={(e) => set({ holdReasons: e.target.value })} />
      </label>
      {canManage ? (
        <div className="rpos-tip-save">
          <label className="rpos-field">
            <span>{tx("Save for")}</span>
            <Select value={level} disabled={busy} onChange={(e) => setLevel(e.target.value as "branch" | "company")}>
              <option value="branch">{tx("This branch only")}</option>
              <option value="company">{tx("Company default (branches without their own settings)")}</option>
            </Select>
          </label>
          <Button type="button" disabled={busy || (draft.requireHoldReason && reasons.length === 0)} onClick={() => void save()}>
            {busy ? tx("Saving...") : tx("Save settings")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** Dining areas and numbered tables that the POS floor plan is built from. */
export function PosTablesSetupPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const canManage = useHasPermission("tables.manage");
  const [areas, setAreas] = useState<DiningAreaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newArea, setNewArea] = useState("");
  const [rename, setRename] = useState<{ area: DiningAreaDto; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!scope.companyId || !scope.branchId) { setAreas([]); setLoading(false); return; }
    setLoading(true);
    try {
      setAreas(await posServiceApi.areas(scope, true));
      setError(null);
    } catch (err) {
      setError(extractApiError(err, tx("Dining areas could not be loaded.")));
    } finally {
      setLoading(false);
    }
  }, [scope, tx]);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await action();
      setNotice(tx(success));
      await load();
      return true;
    } catch (err) {
      setError(extractApiError(err, tx("The change could not be saved.")));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveTable = (table: TableDraft) => {
    const body = { areaId: table.areaId, number: table.number.trim(), seats: table.seats, sortOrder: table.sortOrder, isActive: table.isActive };
    return run(() => (table.id ? posServiceApi.updateTable(scope, table.id, body) : posServiceApi.createTable(scope, body)),
      table.id ? "Table saved." : "Table added.");
  };

  const tableCount = areas.reduce((sum, area) => sum + area.tables.length, 0);

  return (
    <main className="rpos-page rpos-setup ui-page">
      <PageHeader title={tx("Tables and dining areas")}
        subtitle={tx("{areas} areas · {tables} tables. The POS floor plan shows active tables of active areas.", { areas: areas.length, tables: tableCount })} />
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {!canManage ? <StateMessage tone="info">{tx("You can view the floor setup. Changing it requires the manage tables permission.")}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">{tx("Loading tables...")}</StateMessage> : null}

      <ServiceSettingsCard scope={scope} canManage={canManage} />

      {canManage ? (
        <form className="rpos-setup-area" onSubmit={(event) => {
          event.preventDefault();
          void run(() => posServiceApi.createArea(scope, { name: newArea.trim(), sortOrder: areas.length, isActive: true }), "Area added.")
            .then((ok) => ok && setNewArea(""));
        }}>
          <div className="rpos-setup-new-area">
            <label className="rpos-field">
              <span>{tx("New dining area")}</span>
              <Input value={newArea} maxLength={80} placeholder={tx("Main hall, Terrace, VIP room...")} onChange={(e) => setNewArea(e.target.value)} />
            </label>
            <Button type="submit" disabled={busy || !newArea.trim()}><Plus size={14} aria-hidden="true" /> {tx("Add area")}</Button>
          </div>
        </form>
      ) : null}

      {areas.map((area) => (
        <section key={area.id} className="rpos-setup-area" aria-label={area.name}>
          <header>
            <h2>{area.name} <span className="rpos-muted">· {tx("{count} tables", { count: area.tables.length })}</span></h2>
            {canManage ? (
              <div className="rpos-chip-row">
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setRename({ area, name: area.name })}>{tx("Rename")}</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy}
                  onClick={() => void run(() => posServiceApi.updateArea(scope, area.id, { name: area.name, sortOrder: area.sortOrder, isActive: !area.isActive }),
                    area.isActive ? "Area taken out of service." : "Area back in service.")}>
                  {tx(area.isActive ? "Take out of service" : "Put back in service")}
                </Button>
              </div>
            ) : null}
          </header>
          {!area.isActive ? <p className="rpos-muted">{tx("Out of service: hidden from the POS floor plan.")}</p> : null}
          <div className="rpos-setup-row rpos-setup-head" aria-hidden="true">
            <span>{tx("Table number")}</span><span>{tx("Seats")}</span><span>{tx("Area")}</span><span /><span />
          </div>
          {area.tables.map((table) => (
            <TableRow key={table.id} table={table} areas={areas} busy={busy} canManage={canManage} onSave={saveTable} />
          ))}
          {canManage ? (
            <TableRow table={{ areaId: area.id, number: "", seats: 4, sortOrder: area.tables.length, isActive: true }}
              areas={areas} busy={busy} canManage={canManage} onSave={saveTable} />
          ) : null}
        </section>
      ))}

      <PosDialog open={!!rename} title={tx("Rename area")} confirmText={tx("Save")} busy={busy}
        confirmDisabled={!rename?.name.trim() || rename.name.trim() === rename.area.name}
        onClose={() => setRename(null)}
        onConfirm={() => rename && void run(() => posServiceApi.updateArea(scope, rename.area.id,
          { name: rename.name.trim(), sortOrder: rename.area.sortOrder, isActive: rename.area.isActive }), "Area saved.").then((ok) => ok && setRename(null))}>
        <label className="rpos-field">
          <span>{tx("Area name")}</span>
          <Input value={rename?.name ?? ""} maxLength={80} onChange={(e) => rename && setRename({ ...rename, name: e.target.value })} />
        </label>
      </PosDialog>
    </main>
  );
}
