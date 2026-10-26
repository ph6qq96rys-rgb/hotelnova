import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Printer, RefreshCw } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import {
  posDevicesApi,
  type PosPrinterDto,
  type PrepStationDto,
  type PrintAgentDto,
  type PrintJobDto,
  type RoutableMenuDto,
  type SavePosPrinterRequest,
  type SavePrepStationRequest,
  type TillDto,
} from "../api/posDevicesApi";
import { PosDialog } from "../components/PosDialog";
import { extractApiError } from "../utils/posUtils";
import "../pos-service.css";
import "../pos-kitchen.css";

const NEW_PRINTER: SavePosPrinterRequest = { name: "", role: "receipt", address: "", charsPerLine: 42, hasCashDrawer: false, isActive: true };
const NEW_STATION: SavePrepStationRequest = { code: "", name: "", kind: "kitchen", printerId: null, usesDisplay: true, isDefault: false, isActive: true, categoryIds: [], menuItemIds: [] };
const KIND_TEXT: Record<string, string> = { kitchen: "Kitchen", bar: "Bar", pastry: "Pastry", other: "Other" };
const JOB_STATUS_TEXT: Record<string, string> = { queued: "Queued", sent: "Sent", printed: "Printed", failed: "Failed" };

/**
 * POS devices of a branch: printers, which printer each till prints receipts on (and its fiscal machine code),
 * preparation stations with the menu categories and items routed to them, print agents and the print queue.
 */
export function PosDevicesPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const [printers, setPrinters] = useState<PosPrinterDto[]>([]);
  const [stations, setStations] = useState<PrepStationDto[]>([]);
  const [tills, setTills] = useState<TillDto[]>([]);
  const [agents, setAgents] = useState<PrintAgentDto[]>([]);
  const [jobs, setJobs] = useState<PrintJobDto[]>([]);
  const [menu, setMenu] = useState<RoutableMenuDto>({ categories: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [printerEdit, setPrinterEdit] = useState<{ id: string | null; body: SavePosPrinterRequest } | null>(null);
  const [stationEdit, setStationEdit] = useState<{ id: string | null; body: SavePrepStationRequest } | null>(null);
  const [itemFilter, setItemFilter] = useState("");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [tillDrafts, setTillDrafts] = useState<Record<string, { receiptPrinterId: string; fiscalMachineCode: string }>>({});

  const load = useCallback(async () => {
    if (!scope.companyId || !scope.branchId) { setLoading(false); return; }
    try {
      const [p, s, t, a, j, m] = await Promise.all([posDevicesApi.printers(scope), posDevicesApi.stations(scope), posDevicesApi.tills(scope),
        posDevicesApi.agents(scope), posDevicesApi.jobs(scope), posDevicesApi.menu(scope)]);
      setPrinters(p); setStations(s); setTills(t); setAgents(a); setJobs(j); setMenu(m);
      setTillDrafts(Object.fromEntries(t.map((x) => [x.id, { receiptPrinterId: x.receiptPrinterId ?? "", fiscalMachineCode: x.fiscalMachineCode ?? "" }])));
      setError(null);
    } catch (err) {
      setError(extractApiError(err, tx("POS devices could not be loaded.")));
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

  const savePrinter = async () => {
    if (!printerEdit) return;
    if (await run(() => posDevicesApi.savePrinter(scope, printerEdit.id, printerEdit.body), "Printer saved.")) setPrinterEdit(null);
  };
  const saveStation = async () => {
    if (!stationEdit) return;
    if (await run(() => posDevicesApi.saveStation(scope, stationEdit.id, stationEdit.body), "Station saved.")) setStationEdit(null);
  };
  const registerAgent = async () => {
    if (!agentName?.trim()) return;
    setBusy(true); setError(null);
    try {
      const created = await posDevicesApi.registerAgent(scope, agentName.trim());
      setNewKey(created.key);
      setAgentName(null);
      await load();
    } catch (err) {
      setError(extractApiError(err, tx("The print agent could not be registered.")));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));
  const printerName = (id?: string | null) => printers.find((p) => p.id === id)?.name ?? tx("Display only");
  const routedElsewhere = (stationId: string | null, kind: "categoryIds" | "menuItemIds", id: string) =>
    stations.find((s) => s.id !== stationId && s[kind].includes(id))?.name;
  const filteredItems = menu.items.filter((x) => !itemFilter || x.name.toLowerCase().includes(itemFilter.toLowerCase()));

  return (
    <main className="rpos-page ui-page rpos-devices">
      <PageHeader title={tx("POS Devices")}
        subtitle={tx("Printers, receipt printing per till, kitchen and bar stations, and the print agent that connects the branch's printers.")}
        actions={<Button type="button" variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw size={15} aria-hidden="true" /> {tx("Refresh")}</Button>} />
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">{tx("Loading POS devices...")}</StateMessage> : null}

      <section aria-label={tx("Printers")}>
        <header className="rpos-kds-toolbar">
          <h2>{tx("Printers")}</h2>
          <Button type="button" size="sm" onClick={() => setPrinterEdit({ id: null, body: { ...NEW_PRINTER } })}><Plus size={14} aria-hidden="true" /> {tx("Add printer")}</Button>
        </header>
        <p className="rpos-muted">{tx("Thermal (ESC/POS) printers on the branch network, for example 192.168.1.50:9100. A Windows USB printer can be shared and entered as \\\\localhost\\PrinterName.")}</p>
        {printers.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>{tx("Name")}</TableHead><TableHead>{tx("Role")}</TableHead><TableHead>{tx("Address")}</TableHead><TableHead>{tx("Paper")}</TableHead><TableHead>{tx("Cash drawer")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {printers.map((p) => (
                <TableRow key={p.id} className={p.isActive ? "" : "is-voided"}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{tx(p.role === "receipt" ? "Receipts" : "Kitchen orders")}</TableCell>
                  <TableCell>{p.address}</TableCell>
                  <TableCell>{tx("{count} characters", { count: p.charsPerLine })}</TableCell>
                  <TableCell>{p.hasCashDrawer ? tx("Yes") : tx("No")}</TableCell>
                  <TableCell>
                    <div className="rpos-chip-row">
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setPrinterEdit({ id: p.id, body: { ...p } })}>{tx("Edit")}</Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy || !p.isActive} onClick={() => void run(() => posDevicesApi.testPrinter(scope, p.id), "Test page queued.")}>
                        <Printer size={14} aria-hidden="true" /> {tx("Test print")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="rpos-muted">{tx("No printers yet. Without printers, receipts and guest checks print from the browser.")}</p>}
      </section>

      <section aria-label={tx("Tills")}>
        <h2>{tx("Tills")}</h2>
        <p className="rpos-muted">{tx("Each till prints receipts on its receipt printer. The fiscal machine code (MRC) is printed on every receipt once the till is registered with the tax authority.")}</p>
        <div className="rpos-devices-grid">
          {tills.map((till) => {
            const draft = tillDrafts[till.id] ?? { receiptPrinterId: "", fiscalMachineCode: "" };
            const dirty = draft.receiptPrinterId !== (till.receiptPrinterId ?? "") || draft.fiscalMachineCode !== (till.fiscalMachineCode ?? "");
            return (
              <div key={till.id} className="rpos-form-grid">
                <strong>{till.name} <span className="rpos-muted">{till.code}</span></strong>
                <label className="rpos-field">
                  <span>{tx("Receipt printer")}</span>
                  <Select value={draft.receiptPrinterId} onChange={(e) => setTillDrafts({ ...tillDrafts, [till.id]: { ...draft, receiptPrinterId: e.target.value } })}>
                    <option value="">{tx("Browser printing")}</option>
                    {printers.filter((p) => p.role === "receipt" && p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </label>
                <label className="rpos-field">
                  <span>{tx("Fiscal machine code (MRC)")}</span>
                  <Input value={draft.fiscalMachineCode} maxLength={50} onChange={(e) => setTillDrafts({ ...tillDrafts, [till.id]: { ...draft, fiscalMachineCode: e.target.value } })} />
                </label>
                <Button type="button" size="sm" disabled={busy || !dirty}
                  onClick={() => void run(() => posDevicesApi.saveTill(scope, till.id, { receiptPrinterId: draft.receiptPrinterId || null, fiscalMachineCode: draft.fiscalMachineCode.trim() || null }), "Till saved.")}>
                  {tx("Save till")}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label={tx("Preparation stations")}>
        <header className="rpos-kds-toolbar">
          <h2>{tx("Preparation stations")}</h2>
          <Button type="button" size="sm" onClick={() => setStationEdit({ id: null, body: { ...NEW_STATION, isDefault: stations.length === 0 } })}><Plus size={14} aria-hidden="true" /> {tx("Add station")}</Button>
        </header>
        <p className="rpos-muted">{tx("Each round sent from a ticket is split by station. An item goes to the station it is routed to, else to its category's station, else to the default station. Items with no station (bottled drinks served at the counter) are not sent.")}</p>
        {stations.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>{tx("Station")}</TableHead><TableHead>{tx("Type")}</TableHead><TableHead>{tx("Printer")}</TableHead><TableHead>{tx("Routed")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {stations.map((s) => (
                <TableRow key={s.id} className={s.isActive ? "" : "is-voided"}>
                  <TableCell>{s.name} <span className="rpos-muted">{s.code}</span>{s.isDefault ? ` · ${tx("Default")}` : ""}</TableCell>
                  <TableCell>{tx(KIND_TEXT[s.kind] ?? s.kind)}{s.usesDisplay ? ` · ${tx("Kitchen display")}` : ""}</TableCell>
                  <TableCell>{printerName(s.printerId)}</TableCell>
                  <TableCell>{tx("{categories} categories, {items} items", { categories: s.categoryIds.length, items: s.menuItemIds.length })}</TableCell>
                  <TableCell><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setStationEdit({ id: s.id, body: { ...s } })}>{tx("Edit")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="rpos-muted">{tx("No stations: orders are not sent to the kitchen.")}</p>}
      </section>

      <section aria-label={tx("Print agents")}>
        <header className="rpos-kds-toolbar">
          <h2>{tx("Print agents")}</h2>
          <Button type="button" size="sm" onClick={() => setAgentName("")}><Plus size={14} aria-hidden="true" /> {tx("Register agent")}</Button>
        </header>
        <p className="rpos-muted">{tx("The print agent runs on one computer in the branch and sends print jobs to the printers. Install it from tools/print-agent and give it the key shown when you register it.")}</p>
        {agents.map((a) => (
          <div key={a.id} className="rpos-kds-toolbar">
            <span><strong>{a.name}</strong> <span className="rpos-muted">{a.keyPrefix}… · {a.lastSeenAtUtc ? tx("Last seen {time}", { time: formatAppDateTime(a.lastSeenAtUtc) }) : tx("Never connected")}{a.isActive ? "" : ` · ${tx("Revoked")}`}</span></span>
            {a.isActive ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => posDevicesApi.revokeAgent(scope, a.id), "Print agent revoked.")}>{tx("Revoke")}</Button> : null}
          </div>
        ))}
      </section>

      <section aria-label={tx("Print queue")}>
        <h2>{tx("Print queue")}</h2>
        {jobs.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>{tx("Time")}</TableHead><TableHead>{tx("Document")}</TableHead><TableHead>{tx("Printer")}</TableHead><TableHead>{tx("Status")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>{formatAppDateTime(j.createdAtUtc)}</TableCell>
                  <TableCell>{j.kind} {j.documentNo ?? ""}</TableCell>
                  <TableCell>{j.printerName}</TableCell>
                  <TableCell>{tx(JOB_STATUS_TEXT[j.status] ?? j.status)}{j.lastError ? ` · ${j.lastError}` : ""}</TableCell>
                  <TableCell>{j.status === "failed" ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => posDevicesApi.retryJob(scope, j.id), "Print job queued again.")}>{tx("Retry")}</Button> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="rpos-muted">{tx("Nothing printed yet.")}</p>}
      </section>

      <PosDialog open={!!printerEdit} title={tx(printerEdit?.id ? "Edit printer" : "Add printer")} confirmText={tx("Save printer")} busy={busy}
        confirmDisabled={!printerEdit || !printerEdit.body.name.trim() || !printerEdit.body.address.trim()} onConfirm={() => void savePrinter()} onClose={() => setPrinterEdit(null)}>
        {printerEdit ? (
          <div className="rpos-form-grid">
            <label className="rpos-field"><span>{tx("Name")}</span>
              <Input value={printerEdit.body.name} maxLength={100} onChange={(e) => setPrinterEdit({ ...printerEdit, body: { ...printerEdit.body, name: e.target.value } })} /></label>
            <label className="rpos-field"><span>{tx("Role")}</span>
              <Select value={printerEdit.body.role} onChange={(e) => setPrinterEdit({ ...printerEdit, body: { ...printerEdit.body, role: e.target.value as "receipt" | "kitchen" } })}>
                <option value="receipt">{tx("Receipts")}</option><option value="kitchen">{tx("Kitchen orders")}</option>
              </Select></label>
            <label className="rpos-field"><span>{tx("Address")}</span>
              <Input value={printerEdit.body.address} maxLength={200} placeholder="192.168.1.50:9100" onChange={(e) => setPrinterEdit({ ...printerEdit, body: { ...printerEdit.body, address: e.target.value } })} /></label>
            <label className="rpos-field"><span>{tx("Characters per line")}</span>
              <Select value={String(printerEdit.body.charsPerLine)} onChange={(e) => setPrinterEdit({ ...printerEdit, body: { ...printerEdit.body, charsPerLine: Number(e.target.value) } })}>
                <option value="32">{tx("32 (58 mm paper)")}</option><option value="42">{tx("42 (80 mm paper)")}</option><option value="48">{tx("48 (80 mm, small font)")}</option>
              </Select></label>
            {printerEdit.body.role === "receipt" ? (
              <label className="rpos-check"><Checkbox checked={printerEdit.body.hasCashDrawer} onChange={(e) => setPrinterEdit({ ...printerEdit, body: { ...printerEdit.body, hasCashDrawer: e.target.checked } })} /><span>{tx("A cash drawer is connected to this printer")}</span></label>
            ) : null}
            <label className="rpos-check"><Checkbox checked={printerEdit.body.isActive} onChange={(e) => setPrinterEdit({ ...printerEdit, body: { ...printerEdit.body, isActive: e.target.checked } })} /><span>{tx("In use")}</span></label>
          </div>
        ) : null}
      </PosDialog>

      <PosDialog open={!!stationEdit} title={tx(stationEdit?.id ? "Edit station" : "Add station")} confirmText={tx("Save station")} busy={busy}
        confirmDisabled={!stationEdit || !stationEdit.body.code.trim() || !stationEdit.body.name.trim()} onConfirm={() => void saveStation()} onClose={() => setStationEdit(null)}>
        {stationEdit ? (
          <div className="rpos-form-grid">
            <label className="rpos-field"><span>{tx("Code")}</span>
              <Input value={stationEdit.body.code} maxLength={20} onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, code: e.target.value } })} /></label>
            <label className="rpos-field"><span>{tx("Name")}</span>
              <Input value={stationEdit.body.name} maxLength={100} onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, name: e.target.value } })} /></label>
            <label className="rpos-field"><span>{tx("Type")}</span>
              <Select value={stationEdit.body.kind} onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, kind: e.target.value as SavePrepStationRequest["kind"] } })}>
                {Object.entries(KIND_TEXT).map(([value, label]) => <option key={value} value={value}>{tx(label)}</option>)}
              </Select></label>
            <label className="rpos-field"><span>{tx("Printer")}</span>
              <Select value={stationEdit.body.printerId ?? ""} onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, printerId: e.target.value || null } })}>
                <option value="">{tx("Display only")}</option>
                {printers.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select></label>
            <label className="rpos-check"><Checkbox checked={stationEdit.body.usesDisplay} onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, usesDisplay: e.target.checked } })} /><span>{tx("Show on the kitchen display")}</span></label>
            <label className="rpos-check"><Checkbox checked={stationEdit.body.isDefault} onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, isDefault: e.target.checked } })} /><span>{tx("Default station for items with no route")}</span></label>
            <label className="rpos-check"><Checkbox checked={stationEdit.body.isActive} onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, isActive: e.target.checked } })} /><span>{tx("In use")}</span></label>
            <fieldset className="rpos-span-all">
              <legend>{tx("Menu categories")}</legend>
              <div className="rpos-pick-list">
                {menu.categories.map((c) => {
                  const other = routedElsewhere(stationEdit.id, "categoryIds", c.id);
                  return (
                    <label key={c.id} className="rpos-check">
                      <Checkbox checked={stationEdit.body.categoryIds.includes(c.id)}
                        onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, categoryIds: toggle(stationEdit.body.categoryIds, c.id, e.target.checked) } })} />
                      <span>{c.name}{other ? <small className="rpos-muted"> · {tx("now at {station}", { station: other })}</small> : null}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="rpos-span-all">
              <legend>{tx("Single items (override their category)")}</legend>
              <Input value={itemFilter} placeholder={tx("Search items")} onChange={(e) => setItemFilter(e.target.value)} />
              <div className="rpos-pick-list">
                {filteredItems.slice(0, 200).map((item) => {
                  const other = routedElsewhere(stationEdit.id, "menuItemIds", item.id);
                  return (
                    <label key={item.id} className="rpos-check">
                      <Checkbox checked={stationEdit.body.menuItemIds.includes(item.id)}
                        onChange={(e) => setStationEdit({ ...stationEdit, body: { ...stationEdit.body, menuItemIds: toggle(stationEdit.body.menuItemIds, item.id, e.target.checked) } })} />
                      <span>{item.name}{other ? <small className="rpos-muted"> · {tx("now at {station}", { station: other })}</small> : null}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        ) : null}
      </PosDialog>

      <PosDialog open={agentName !== null} title={tx("Register print agent")} confirmText={tx("Register agent")} busy={busy}
        confirmDisabled={!agentName?.trim()} onConfirm={() => void registerAgent()} onClose={() => setAgentName(null)}>
        <label className="rpos-field"><span>{tx("Computer name")}</span>
          <Input value={agentName ?? ""} maxLength={100} placeholder={tx("Cashier PC")} onChange={(e) => setAgentName(e.target.value)} /></label>
      </PosDialog>

      <PosDialog open={!!newKey} title={tx("Print agent key")} confirmText={tx("I have copied the key")} onConfirm={() => setNewKey(null)} onClose={() => setNewKey(null)}
        description={tx("Copy this key into print-agent.json on the branch computer now. It is shown only once.")}>
        <p className="rpos-devices-key">{newKey}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(newKey ?? ""); }}>{tx("Copy key")}</Button>
      </PosDialog>
    </main>
  );
}
