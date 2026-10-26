import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Pencil, Power, Trash2, X } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { formatAppDate, formatAppDateTime } from "../../../shared/datetime/dateFormat";
import {
  ASSIGNMENT_TYPES,
  CONDITIONS,
  DISPOSAL_METHODS,
  fixedAssetsApi,
  type AssignmentType,
  type DepreciationSchedule,
  type DisposalMethod,
  type FixedAssetCondition,
  type FixedAssetDetail,
  type FixedAssetEventType,
  type FixedAssetLookups,
} from "../api/fixedAssetsApi";
import {
  ACQUISITION_LABEL,
  apiError,
  ASSIGNMENT_LABEL,
  CONDITION_LABEL,
  DISPOSAL_LABEL,
  EVENT_LABEL,
  FaDialog,
  Field,
  fromDateInput,
  METHOD_LABEL,
  money,
  STATUS_LABEL,
  StatusChip,
  todayInput,
} from "./faShared";

type Props = {
  companyId: string;
  assetId: string | null;
  onClose: () => void;
  onEdit: (asset: FixedAssetDetail) => void;
  /** The asset changed (or was deleted when null): refresh the register. */
  onChanged: (message: string) => void;
};

type Tab = "overview" | "custody" | "depreciation" | "activity";
type Action =
  | { kind: "activate" }
  | { kind: "delete" }
  | { kind: "assign" }
  | { kind: "event"; type: FixedAssetEventType }
  | { kind: "retire" }
  | { kind: "dispose" };

/** Lifecycle actions offered for each status (the backend enforces the same rules). */
const EVENT_ACTIONS: Array<{ type: FixedAssetEventType; label: string; from: string[] }> = [
  { type: "inspection", label: "Record inspection", from: ["active", "assigned", "inTransit", "underInspection", "underMaintenance", "outOfService"] },
  { type: "maintenanceStarted", label: "Send to maintenance", from: ["active", "assigned", "outOfService", "underInspection"] },
  { type: "maintenanceCompleted", label: "Maintenance completed", from: ["underMaintenance"] },
  { type: "outOfService", label: "Take out of service", from: ["active", "assigned", "underMaintenance", "underInspection"] },
  { type: "returnedToService", label: "Return to service", from: ["outOfService"] },
  { type: "reportedMissing", label: "Report missing", from: ["active", "assigned", "inTransit", "underInspection", "underMaintenance", "outOfService"] },
  { type: "reportedStolen", label: "Report stolen", from: ["active", "assigned", "inTransit", "underInspection", "underMaintenance", "outOfService"] },
  { type: "found", label: "Record as found", from: ["missing", "stolen"] },
];

const emptyLookups: FixedAssetLookups = { branches: [], locations: [], departments: [], employees: [] };

export function AssetDrawer({ companyId, assetId, onClose, onEdit, onChanged }: Props) {
  const { tx } = useI18n();
  const titleId = useId();
  const can = {
    edit: useHasPermission("fixedassets.edit"),
    register: useHasPermission("fixedassets.register"),
    activate: useHasPermission("fixedassets.activate"),
    assign: useHasPermission("fixedassets.assign"),
    dispose: useHasPermission("fixedassets.dispose"),
  };
  const [asset, setAsset] = useState<FixedAssetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [schedule, setSchedule] = useState<DepreciationSchedule | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  useDialogFocus(!!assetId && !action, false, onClose);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      setAsset(await fixedAssetsApi.get(companyId, assetId));
    } catch (err) {
      setError(apiError(err, tx("The asset could not be loaded.")));
    } finally {
      setLoading(false);
    }
  }, [assetId, companyId, tx]);

  useEffect(() => { setAsset(null); setSchedule(null); setTab("overview"); void load(); }, [load]);

  useEffect(() => {
    if (tab !== "depreciation" || !assetId || schedule) return;
    fixedAssetsApi.schedule(companyId, assetId).then(setSchedule).catch((err) => setError(apiError(err, tx("The depreciation schedule could not be loaded."))));
  }, [tab, assetId, companyId, schedule, tx]);

  if (!assetId) return null;

  const done = (updated: FixedAssetDetail | null, message: string) => {
    setAction(null);
    if (updated) { setAsset(updated); setSchedule(null); }
    onChanged(message);
    if (!updated) onClose();
  };

  const status = asset?.status;
  const closed = status === "retired" || status === "disposed";
  const eventActions = asset && can.edit ? EVENT_ACTIONS.filter((x) => x.from.includes(asset.status)) : [];
  const due = asset?.nextInspectionDueUtc && new Date(asset.nextInspectionDueUtc) <= new Date() && !closed && status !== "draft";
  const currentAssignment = asset?.assignments.find((x) => x.isActivePrimary);

  return (
    <div className="ui-dialog-backdrop fa-drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !action) onClose(); }}>
      <aside className="fa-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="fa-drawer-head">
          <div>
            <p className="fa-kicker">{asset?.assetNo ?? tx("Loading...")}</p>
            <h2 id={titleId}>{asset?.name ?? ""}</h2>
            {asset ? <div className="fa-chip-row"><StatusChip status={asset.status} /><span className="fa-muted">{asset.categoryName}</span></div> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={tx("Close")} onClick={onClose}><X size={18} aria-hidden="true" /></Button>
        </header>

        {error ? <StateMessage tone="error">{error}</StateMessage> : null}
        {loading && !asset ? <StateMessage tone="loading">{tx("Loading...")}</StateMessage> : null}

        {asset ? (
          <>
            <div className="fa-actions">
              {status === "draft" && can.activate ? <Button type="button" size="sm" onClick={() => setAction({ kind: "activate" })}><Power size={14} aria-hidden="true" /> {tx("Activate")}</Button> : null}
              {!closed && can.edit ? <Button type="button" size="sm" variant="outline" onClick={() => onEdit(asset)}><Pencil size={14} aria-hidden="true" /> {tx("Edit")}</Button> : null}
              {!closed && status !== "draft" && status !== "missing" && status !== "stolen" && can.assign ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setAction({ kind: "assign" })}><ArrowRightLeft size={14} aria-hidden="true" /> {tx("Assign / transfer")}</Button>
              ) : null}
              {eventActions.length ? (
                <Select aria-label={tx("Record an event")} className="fa-action-select" value=""
                  onChange={(e) => { if (e.target.value) setAction({ kind: "event", type: e.target.value as FixedAssetEventType }); }}>
                  <option value="">{tx("Record an event...")}</option>
                  {eventActions.map((x) => <option key={x.type} value={x.type}>{tx(x.label)}</option>)}
                </Select>
              ) : null}
              {!closed && status !== "draft" && can.dispose ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAction({ kind: "retire" })}>{tx("Retire")}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAction({ kind: "dispose" })}>{tx("Dispose")}</Button>
                </>
              ) : status === "retired" && can.dispose ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setAction({ kind: "dispose" })}>{tx("Dispose")}</Button>
              ) : null}
              {status === "draft" && can.register ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setAction({ kind: "delete" })}><Trash2 size={14} aria-hidden="true" /> {tx("Delete draft")}</Button>
              ) : null}
            </div>

            {status === "draft" ? (
              <ActivationChecklist asset={asset} />
            ) : null}
            {due ? <p className="fa-note fa-note--warn"><AlertTriangle size={14} aria-hidden="true" /> {tx("Inspection was due on {date}.", { date: formatAppDate(asset.nextInspectionDueUtc) })}</p> : null}

            <div className="fa-tabs" role="tablist">
              {(["overview", "custody", "depreciation", "activity"] as Tab[]).map((t) => (
                <Button key={t} type="button" variant="ghost" role="tab" aria-selected={tab === t} className="fa-tab" onClick={() => setTab(t)}>
                  {tx(t === "overview" ? "Overview" : t === "custody" ? "custody" : t === "depreciation" ? "Depreciation" : "Activity")}
                  {t === "activity" && asset.events.length ? ` · ${asset.events.length}` : ""}
                </Button>
              ))}
            </div>

            {tab === "overview" ? <Overview asset={asset} /> : null}
            {tab === "custody" ? (
              <section className="fa-section">
                <dl className="fa-facts">
                  <div><dt>{tx("Branch")}</dt><dd>{asset.branchName ?? "—"}</dd></div>
                  <div><dt>{tx("Location")}</dt><dd>{[asset.locationName, asset.physicalLocation].filter(Boolean).join(" · ") || "—"}</dd></div>
                  <div><dt>{tx("Department")}</dt><dd>{asset.departmentName ?? "—"}</dd></div>
                  <div><dt>{tx("Custodian")}</dt><dd>{asset.custodianName ?? "—"}</dd></div>
                  {currentAssignment?.expectedReturnAtUtc ? <div><dt>{tx("Expected back")}</dt><dd>{formatAppDate(currentAssignment.expectedReturnAtUtc)}</dd></div> : null}
                </dl>
                <h3>{tx("Custody history")}</h3>
                {asset.assignments.length === 0 ? <p className="fa-muted">{tx("No assignments yet. The first one is created when the asset is activated.")}</p> : (
                  <ol className="fa-timeline">
                    {asset.assignments.map((a) => (
                      <li key={a.id} className={a.isActivePrimary ? "is-current" : ""}>
                        <strong>{tx(ASSIGNMENT_LABEL[a.assignmentType])}{a.isActivePrimary ? ` · ${tx("current")}` : ""}</strong>
                        <span>{[a.toBranchName, a.toLocationName, a.toDepartmentName, a.toEmployeeName].filter(Boolean).join(" · ") || "—"}</span>
                        <small>{formatAppDateTime(a.assignedAtUtc)}{a.returnedAtUtc ? ` → ${formatAppDateTime(a.returnedAtUtc)}` : ""}{a.businessReason ? ` · ${a.businessReason}` : ""}</small>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ) : null}
            {tab === "depreciation" ? <ScheduleView asset={asset} schedule={schedule} /> : null}
            {tab === "activity" ? (
              <section className="fa-section">
                {asset.events.length === 0 ? <p className="fa-muted">{tx("No inspections, maintenance or other events recorded yet.")}</p> : (
                  <ol className="fa-timeline">
                    {asset.events.map((e) => (
                      <li key={e.id}>
                        <strong>{tx(EVENT_LABEL[e.type])}</strong>
                        <span>
                          {e.fromStatus !== e.toStatus ? `${tx("Status")}: ${tx(STATUS_LABEL[e.fromStatus])} → ${tx(STATUS_LABEL[e.toStatus])}` : null}
                          {e.condition ? ` · ${tx("Condition")}: ${tx(CONDITION_LABEL[e.condition])}` : ""}
                          {e.amount != null ? ` · ${money(e.amount)}` : ""}
                          {e.gainLoss != null ? ` · ${tx(e.gainLoss >= 0 ? "Gain" : "Loss")} ${money(Math.abs(e.gainLoss))}` : ""}
                        </span>
                        {e.notes ? <span>{e.notes}</span> : null}
                        <small>{formatAppDateTime(e.occurredAtUtc)} · {e.recordedByName}{e.reference ? ` · ${tx("Ref.")} ${e.reference}` : ""}</small>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </aside>

      {asset && action?.kind === "activate" ? <ActivateDialog companyId={companyId} asset={asset} onClose={() => setAction(null)} onDone={done} /> : null}
      {asset && action?.kind === "delete" ? <DeleteDialog companyId={companyId} asset={asset} onClose={() => setAction(null)} onDone={done} /> : null}
      {asset && action?.kind === "assign" ? <AssignDialog companyId={companyId} asset={asset} onClose={() => setAction(null)} onDone={done} /> : null}
      {asset && action?.kind === "event" ? <EventDialog companyId={companyId} asset={asset} type={action.type} onClose={() => setAction(null)} onDone={done} /> : null}
      {asset && action?.kind === "retire" ? <RetireDialog companyId={companyId} asset={asset} onClose={() => setAction(null)} onDone={done} /> : null}
      {asset && action?.kind === "dispose" ? <DisposeDialog companyId={companyId} asset={asset} onClose={() => setAction(null)} onDone={done} /> : null}
    </div>
  );
}

// ── Overview and schedule ────────────────────────────────────────────────────

function Overview({ asset }: { asset: FixedAssetDetail }) {
  const { tx } = useI18n();
  const depreciable = Math.max(0, asset.acquisitionCost - asset.residualValue);
  const used = depreciable > 0 ? Math.min(100, (asset.accumulatedDepreciation / depreciable) * 100) : 0;
  return (
    <section className="fa-section">
      <div className="fa-value-strip">
        <div><span>{tx("Cost")}</span><strong>{money(asset.acquisitionCost)}</strong></div>
        <div><span>{tx("Accumulated depreciation")}</span><strong>{money(asset.accumulatedDepreciation)}</strong></div>
        <div><span>{tx("Net book value")}</span><strong>{money(asset.netBookValue)}</strong></div>
      </div>
      <div className="fa-meter" aria-hidden="true"><span style={{ width: `${used}%` }} /></div>
      <p className="fa-muted">{tx("{pct}% of the depreciable amount used", { pct: used.toFixed(0) })}{asset.lastDepreciationPeriod ? ` · ${tx("depreciated up to {period}", { period: asset.lastDepreciationPeriod })}` : ""}</p>
      {asset.status === "disposed" ? (
        <p className="fa-note">
          {tx("Disposed on {date} by {method}: proceeds {proceeds}, {result} {amount}.", {
            date: formatAppDate(asset.disposedAtUtc),
            method: asset.disposalMethod ? tx(DISPOSAL_LABEL[asset.disposalMethod]).toLowerCase() : "—",
            proceeds: money(asset.disposalProceeds),
            result: tx((asset.disposalGainLoss ?? 0) >= 0 ? "gain" : "loss"),
            amount: money(Math.abs(asset.disposalGainLoss ?? 0)),
          })}
        </p>
      ) : null}
      <dl className="fa-facts">
        <div><dt>{tx("Asset tag")}</dt><dd>{asset.assetTagNumber || "—"}</dd></div>
        <div><dt>{tx("Serial number")}</dt><dd>{asset.serialNumber || "—"}</dd></div>
        <div><dt>{tx("Brand / model")}</dt><dd>{[asset.brand, asset.model].filter(Boolean).join(" ") || "—"}</dd></div>
        <div><dt>{tx("Condition")}</dt><dd>{tx(CONDITION_LABEL[asset.condition])}</dd></div>
        <div><dt>{tx("Acquired")}</dt><dd>{formatAppDate(asset.acquisitionDateUtc)} · {tx(ACQUISITION_LABEL[asset.acquisitionMethod])}</dd></div>
        <div><dt>{tx("In service since")}</dt><dd>{asset.inServiceDateUtc ? formatAppDate(asset.inServiceDateUtc) : "—"}</dd></div>
        <div><dt>{tx("Method")}</dt><dd>{tx(METHOD_LABEL[asset.depreciationMethod])} · {tx("{months} months", { months: asset.usefulLifeMonths })}</dd></div>
        <div><dt>{tx("Residual value")}</dt><dd>{money(asset.residualValue)}</dd></div>
        <div><dt>{tx("Warranty until")}</dt><dd>{asset.warrantyExpiryDateUtc ? formatAppDate(asset.warrantyExpiryDateUtc) : "—"}</dd></div>
        <div><dt>{tx("Last inspection")}</dt><dd>{asset.lastInspectionAtUtc ? formatAppDate(asset.lastInspectionAtUtc) : "—"}</dd></div>
        <div><dt>{tx("Next inspection")}</dt><dd>{asset.nextInspectionDueUtc ? formatAppDate(asset.nextInspectionDueUtc) : "—"}</dd></div>
        <div><dt>{tx("Cost centre")}</dt><dd>{asset.costCenterCode || "—"}</dd></div>
      </dl>
      {asset.description ? <p>{asset.description}</p> : null}
      {asset.notes ? <p className="fa-muted">{asset.notes}</p> : null}
    </section>
  );
}

function ScheduleView({ asset, schedule }: { asset: FixedAssetDetail; schedule: DepreciationSchedule | null }) {
  const { tx } = useI18n();
  if (!schedule) return <StateMessage tone="loading">{tx("Loading...")}</StateMessage>;
  const posted = schedule.rows.filter((r) => r.posted).length;
  return (
    <section className="fa-section">
      <p className="fa-muted">
        {tx(METHOD_LABEL[schedule.method])}
        {schedule.firstPeriod ? ` · ${tx("from {from} to {to}", { from: schedule.firstPeriod, to: schedule.endPeriod ?? "—" })}` : ""}
        {` · ${tx("{posted} month(s) posted", { posted })}`}
      </p>
      {schedule.note ? <p className="fa-note">{tx(schedule.note)}</p> : null}
      {schedule.rows.length ? (
        <div className="fa-table-wrap fa-table-wrap--short">
          <table className="ui-table fa-table">
            <thead><tr><th>{tx("Month")}</th><th className="fa-num">{tx("Opening")}</th><th className="fa-num">{tx("Depreciation")}</th><th className="fa-num">{tx("Closing")}</th><th>{tx("Status")}</th></tr></thead>
            <tbody>
              {schedule.rows.map((r) => (
                <tr key={r.period} className={r.posted ? "" : "is-projected"}>
                  <td>{r.period}</td>
                  <td className="fa-num">{money(r.openingBookValue)}</td>
                  <td className="fa-num">{money(r.amount)}</td>
                  <td className="fa-num">{money(r.closingBookValue)}</td>
                  <td>{tx(r.posted ? "Posted" : "Projected")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : asset.status !== "draft" ? <p className="fa-muted">{tx("Nothing to show.")}</p> : null}
    </section>
  );
}

function ActivationChecklist({ asset }: { asset: FixedAssetDetail }) {
  const { tx } = useI18n();
  const items = [
    { ok: !!asset.assetTagNumber, text: "Asset tag" },
    { ok: !!asset.currentBranchId, text: "Branch" },
    { ok: !!asset.currentLocationId || !!asset.physicalLocation, text: "Location or exact place" },
    { ok: !!asset.custodianEmployeeId || !!asset.departmentId, text: "Custodian or department" },
  ];
  return (
    <div className="fa-checklist" aria-label={tx("Before activation")}>
      <strong>{tx("Before activation")}</strong>
      <ul>
        {items.map((x) => (
          <li key={x.text} className={x.ok ? "is-ok" : ""}>
            {x.ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />} {tx(x.text)}
          </li>
        ))}
      </ul>
      <small className="fa-muted">{tx("Your category may also require a serial number. Edit the draft to fill anything missing.")}</small>
    </div>
  );
}

// ── Action dialogs ───────────────────────────────────────────────────────────

type ActionProps = { companyId: string; asset: FixedAssetDetail; onClose: () => void; onDone: (asset: FixedAssetDetail | null, message: string) => void };

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try { await work(); } catch (err) { setError(apiError(err, fallback)); } finally { setBusy(false); }
  };
  return { busy, error, run };
}

function ActivateDialog({ companyId, asset, onClose, onDone }: ActionProps) {
  const { tx } = useI18n();
  const { busy, error, run } = useAction();
  return (
    <FaDialog open title={`${tx("Activate")} ${asset.assetNo}`} busy={busy} error={error} confirmText={tx("Activate")}
      description={tx("The asset goes into service now: its first custody record is created and depreciation starts this month.")}
      onClose={onClose}
      onConfirm={() => void run(async () => onDone(await fixedAssetsApi.activate(companyId, asset.id), tx("{asset} is active.", { asset: asset.assetNo })), tx("The asset could not be activated."))} />
  );
}

function DeleteDialog({ companyId, asset, onClose, onDone }: ActionProps) {
  const { tx } = useI18n();
  const { busy, error, run } = useAction();
  return (
    <FaDialog open danger title={`${tx("Delete draft")} ${asset.assetNo}`} busy={busy} error={error} confirmText={tx("Delete")}
      description={tx("Use this only for a draft registered by mistake. It cannot be undone.")}
      onClose={onClose}
      onConfirm={() => void run(async () => { await fixedAssetsApi.deleteDraft(companyId, asset.id); onDone(null, tx("Draft {asset} deleted.", { asset: asset.assetNo })); }, tx("The draft could not be deleted."))} />
  );
}

function AssignDialog({ companyId, asset, onClose, onDone }: ActionProps) {
  const { tx } = useI18n();
  const { busy, error, run } = useAction();
  const [type, setType] = useState<AssignmentType>("custody");
  const [branchId, setBranchId] = useState(asset.currentBranchId ?? "");
  const [locationId, setLocationId] = useState(asset.currentLocationId ?? "");
  const [departmentId, setDepartmentId] = useState(asset.departmentId ?? "");
  const [employeeId, setEmployeeId] = useState(asset.custodianEmployeeId ?? "");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [reason, setReason] = useState("");
  const [lookups, setLookups] = useState<FixedAssetLookups>(emptyLookups);

  useEffect(() => {
    let alive = true;
    fixedAssetsApi.lookups(companyId, branchId || null).then((x) => { if (alive) setLookups(x); }).catch(() => undefined);
    return () => { alive = false; };
  }, [companyId, branchId]);

  const unchanged = branchId === (asset.currentBranchId ?? "") && locationId === (asset.currentLocationId ?? "") &&
    departmentId === (asset.departmentId ?? "") && employeeId === (asset.custodianEmployeeId ?? "");
  const problem = !branchId ? "Choose the branch."
    : !locationId && !departmentId && !employeeId ? "Choose a location, a department or an employee."
    : unchanged ? "Nothing changes: pick a different branch, location, department or custodian."
    : type === "temporaryCheckout" && !expectedReturn ? "Enter when the asset is expected back."
    : !reason.trim() ? "Give the reason for the move."
    : null;

  return (
    <FaDialog open title={`${tx("Assign / transfer")} ${asset.assetNo}`} busy={busy} error={error} confirmText={tx("Save assignment")}
      confirmDisabled={!!problem} onClose={onClose}
      onConfirm={() => void run(async () => onDone(await fixedAssetsApi.assign(companyId, asset.id, {
        assignmentType: type,
        toBranchId: branchId,
        toLocationId: locationId || null,
        toDepartmentId: departmentId || null,
        toEmployeeId: employeeId || null,
        expectedReturnAtUtc: fromDateInput(expectedReturn),
        businessReason: reason.trim(),
      }), tx("{asset} reassigned.", { asset: asset.assetNo })), tx("The assignment could not be saved."))}>
      <div className="fa-grid">
        <Field label={tx("Type")}>
          <Select value={type} onChange={(e) => setType(e.target.value as AssignmentType)}>
            {ASSIGNMENT_TYPES.map((t) => <option key={t} value={t}>{tx(ASSIGNMENT_LABEL[t])}</option>)}
          </Select>
        </Field>
        <Field label={tx("Branch")}>
          <Select value={branchId} onChange={(e) => { setBranchId(e.target.value); setLocationId(""); setDepartmentId(""); }}>
            <option value="">{tx("Choose...")}</option>
            {lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label={tx("Stock location")}>
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">{tx("None")}</option>
            {lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <Field label={tx("Department")}>
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">{tx("None")}</option>
            {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label={tx("Custodian")}>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{tx("None")}</option>
            {lookups.employees.map((m) => <option key={m.id} value={m.id}>{m.name}{m.code ? ` · ${m.code}` : ""}</option>)}
          </Select>
        </Field>
        {type === "temporaryCheckout" ? (
          <Field label={tx("Expected back")}><Input type="date" min={todayInput()} value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} /></Field>
        ) : null}
      </div>
      <Field label={tx("Reason")} wide><Textarea rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field>
      <p className="fa-muted">{tx("The person who made the current assignment cannot make the next one (segregation of duties).")}</p>
      {problem ? <p className="fa-muted">{tx(problem)}</p> : null}
    </FaDialog>
  );
}

function EventDialog({ companyId, asset, type, onClose, onDone }: ActionProps & { type: FixedAssetEventType }) {
  const { tx } = useI18n();
  const { busy, error, run } = useAction();
  const [date, setDate] = useState(todayInput());
  const [condition, setCondition] = useState<FixedAssetCondition | "">(type === "inspection" ? asset.condition : "");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const label = EVENT_ACTIONS.find((x) => x.type === type)?.label ?? EVENT_LABEL[type];
  const needsNotes = type === "reportedMissing" || type === "reportedStolen";
  const showsCost = type === "maintenanceCompleted" || type === "maintenanceStarted";
  const problem = !date ? "Enter the date." : needsNotes && !notes.trim() ? "Describe when and where the asset was last seen." : amount !== "" && !(Number(amount) >= 0) ? "The amount cannot be negative." : null;

  return (
    <FaDialog open title={`${tx(label)} · ${asset.assetNo}`} busy={busy} error={error} confirmText={tx("Save")}
      confirmDisabled={!!problem} onClose={onClose}
      onConfirm={() => void run(async () => onDone(await fixedAssetsApi.recordEvent(companyId, asset.id, {
        type,
        occurredAtUtc: fromDateInput(date),
        condition: condition || null,
        notes: notes.trim() || null,
        reference: reference.trim() || null,
        amount: amount === "" ? null : Number(amount),
      }), tx("{event} recorded for {asset}.", { event: tx(EVENT_LABEL[type]), asset: asset.assetNo })), tx("The event could not be recorded."))}>
      <div className="fa-grid">
        <Field label={tx("Date")}><Input type="date" max={todayInput()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={tx("Condition")}>
          <Select value={condition} onChange={(e) => setCondition(e.target.value as FixedAssetCondition | "")}>
            <option value="">{tx("Unchanged")}</option>
            {CONDITIONS.map((c) => <option key={c} value={c}>{tx(CONDITION_LABEL[c])}</option>)}
          </Select>
        </Field>
        <Field label={tx("Reference")}><Input value={reference} maxLength={120} placeholder={tx(type === "reportedStolen" ? "Police report no." : "Work order / report no.")} onChange={(e) => setReference(e.target.value)} /></Field>
        {showsCost ? <Field label={tx("Cost")}><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field> : null}
      </div>
      <Field label={tx(needsNotes ? "When and where was it last seen?" : "Notes")} wide><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {type === "inspection" ? <p className="fa-muted">{tx("The next inspection date is set from the category's inspection interval.")}</p> : null}
      {problem ? <p className="fa-muted">{tx(problem)}</p> : null}
    </FaDialog>
  );
}

function RetireDialog({ companyId, asset, onClose, onDone }: ActionProps) {
  const { tx } = useI18n();
  const { busy, error, run } = useAction();
  const [date, setDate] = useState(todayInput());
  const [reason, setReason] = useState("");
  return (
    <FaDialog open title={`${tx("Retire")} ${asset.assetNo}`} busy={busy} error={error} confirmText={tx("Retire asset")}
      description={tx("A retired asset stops depreciating and leaves service but stays on the books at {value} until it is disposed.", { value: money(asset.netBookValue) })}
      confirmDisabled={!date || !reason.trim()} onClose={onClose}
      onConfirm={() => void run(async () => onDone(await fixedAssetsApi.retire(companyId, asset.id, { retiredAtUtc: fromDateInput(date), reason: reason.trim() }),
        tx("{asset} retired.", { asset: asset.assetNo })), tx("The asset could not be retired."))}>
      <Field label={tx("Date")}><Input type="date" max={todayInput()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label={tx("Reason")} wide><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </FaDialog>
  );
}

function DisposeDialog({ companyId, asset, onClose, onDone }: ActionProps) {
  const { tx } = useI18n();
  const { busy, error, run } = useAction();
  const [date, setDate] = useState(todayInput());
  const [method, setMethod] = useState<DisposalMethod>("sale");
  const [proceeds, setProceeds] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const isSale = method === "sale" || method === "tradeIn";
  const amount = proceeds === "" ? 0 : Number(proceeds);
  const result = useMemo(() => amount - asset.netBookValue, [amount, asset.netBookValue]);
  const problem = !date ? "Enter the date."
    : !(amount >= 0) ? "Proceeds cannot be negative."
    : isSale && amount <= 0 ? "Enter the sale or trade-in amount."
    : isSale && !reference.trim() ? "Enter the receipt or invoice reference of the sale."
    : !reason.trim() ? "Give a reason for the disposal."
    : null;

  return (
    <FaDialog open danger title={`${tx("Dispose")} ${asset.assetNo}`} busy={busy} error={error} confirmText={tx("Dispose asset")}
      description={tx("The asset leaves the register for good. Post depreciation up to last month first so the book value is right.")}
      confirmDisabled={!!problem} onClose={onClose}
      onConfirm={() => void run(async () => onDone(await fixedAssetsApi.dispose(companyId, asset.id, {
        disposedAtUtc: fromDateInput(date), method, proceeds: amount, reference: reference.trim() || null, reason: reason.trim(),
      }), tx("{asset} disposed.", { asset: asset.assetNo })), tx("The asset could not be disposed."))}>
      <div className="fa-grid">
        <Field label={tx("Date")}><Input type="date" max={todayInput()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={tx("Method")}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as DisposalMethod)}>
            {DISPOSAL_METHODS.map((m) => <option key={m} value={m}>{tx(DISPOSAL_LABEL[m])}</option>)}
          </Select>
        </Field>
        <Field label={tx("Proceeds")}><Input type="number" min={0} step="0.01" value={proceeds} placeholder="0.00" onChange={(e) => setProceeds(e.target.value)} /></Field>
        <Field label={tx(isSale ? "Receipt / invoice no." : "Reference")}><Input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} /></Field>
      </div>
      <dl className="fa-facts fa-facts--tight">
        <div><dt>{tx("Net book value")}</dt><dd>{money(asset.netBookValue)}</dd></div>
        <div><dt>{tx(result >= 0 ? "Gain on disposal" : "Loss on disposal")}</dt><dd className={result >= 0 ? "fa-gain" : "fa-loss"}>{money(Math.abs(result))}</dd></div>
      </dl>
      <Field label={tx("Reason")} wide><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      {problem ? <p className="fa-muted">{tx(problem)}</p> : null}
    </FaDialog>
  );
}
