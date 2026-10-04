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
import { posServiceApi, type DiningAreaDto, type RestaurantTableDto } from "../api/posServiceApi";
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
