// src/features/eventmanagment/screens/EventStock.tsx
//
// Event-scoped lifecycle, stock and profitability screens. Quantities and costs shown here come
// from the server (inventory ledger, issued invoice); the forms only send what a person decides:
// what to reserve or issue, what came back, what was wasted and why, which variances are accepted.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { orgApi } from "../../org/api/orgApi";
import type { CateringEventDto } from "../api/cateringManagementApi";
import {
  eventStockApi,
  type ClosureReadiness,
  type EventReturn,
  type EventWaste,
  type Profitability,
  type ProfitabilityInput,
  type Reconciliation,
  type Requirements,
  type Reservation,
  type WasteType,
} from "../api/eventStockApi";
import { useDialogFocus } from "../components/useDialogFocus";
import { humanize } from "../sales/options";
import { formatDateTime, formatDay, readApiError } from "../sales/ui";

const qty = (value: number) => Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/* ---------- shared bits ---------- */

function useAction(onDone: () => void) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const run = useCallback(
    async (call: () => Promise<unknown>, success: string) => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      setError("");
      setMessage("");
      try {
        await call();
        setMessage(success);
        onDone();
        return true;
      } catch (e) {
        setError(readApiError(e));
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [onDone],
  );
  return { busy, error, message, run, setError };
}

function Dialog({
  title,
  busy,
  error,
  submitLabel,
  disabled,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  busy: boolean;
  error?: string;
  submitLabel: string;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  useDialogFocus(true, busy, onClose);
  return (
    <div className="co-modal-backdrop">
      <section role="dialog" aria-modal="true" aria-label={title} className="co-modal">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <header className="co-toolbar">
            <h2>{title}</h2>
            <button type="button" disabled={busy} onClick={onClose}>
              Close
            </button>
          </header>
          <fieldset disabled={busy}>{children}</fieldset>
          {error && (
            <p className="co-notice" role="alert">
              {error}
            </p>
          )}
          <footer className="co-toolbar">
            <span />
            <button className="co-primary" disabled={busy || disabled}>
              {busy ? "Saving..." : submitLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Notices({ error, message }: { error: string; message: string }) {
  return (
    <>
      {error && (
        <p className="co-notice" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="co-notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}

function ReasonField({
  value,
  onChange,
  label = "Reason",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <label>
      {label}
      <textarea required maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/* ---------- lifecycle ---------- */

export function EventLifecycleCard({ event, onChanged }: { event: CateringEventDto; onChanged: () => void }) {
  const { hasPermission } = useAuth();
  const [readiness, setReadiness] = useState<ClosureReadiness | null>(null);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<"start" | "complete" | "reopen" | null>(null);
  const [reason, setReason] = useState("");
  const done = useCallback(() => {
    setDialog(null);
    setRevision((v) => v + 1);
    onChanged();
  }, [onChanged]);
  const action = useAction(done);
  const status = String(event.status);

  useEffect(() => {
    const c = new AbortController();
    eventStockApi
      .closureReadiness(event.companyId, event.id, c.signal)
      .then((r) => !c.signal.aborted && setReadiness(r))
      .catch(() => !c.signal.aborted && setReadiness(null));
    return () => c.abort();
  }, [event.companyId, event.id, event.status, revision]);

  const canRun = hasPermission("catering.events.manage");
  const canStart = canRun && (status === "confirmed" || status === "inPlanning");
  const canComplete = canRun && ["confirmed", "inPlanning", "inExecution"].includes(status);
  const canReopen = hasPermission("catering.approve") && status === "completed";
  const open = readiness?.checks.filter((c) => !c.isMet) ?? [];

  return (
    <section className="co-card">
      <header className="co-toolbar">
        <h2>Event lifecycle</h2>
        <span className="co-pill">{humanize(status)}</span>
        <div className="co-actions">
          {canStart && (
            <button disabled={action.busy} onClick={() => setDialog("start")}>
              Start event
            </button>
          )}
          {canComplete && (
            <button
              className="co-primary"
              disabled={action.busy || !readiness?.canComplete}
              title={readiness?.canComplete ? undefined : "Every closing check must be met first"}
              onClick={() => setDialog("complete")}
            >
              Complete event
            </button>
          )}
          {canReopen && (
            <button
              disabled={action.busy}
              onClick={() => {
                setReason("");
                setDialog("reopen");
              }}
            >
              Reopen
            </button>
          )}
        </div>
      </header>
      <Notices error={action.error} message={action.message} />
      {readiness && status !== "cancelled" && (
        <ul className="co-checklist" aria-label="Closing checks">
          {readiness.checks.map((check) => (
            <li key={check.key} className={check.isMet ? "is-met" : undefined}>
              <span>
                {check.label}
                {check.detail && <small> · {check.detail}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {dialog === "start" && (
        <Dialog
          title="Start event"
          busy={action.busy}
          error={action.error}
          submitLabel="Start event"
          onClose={() => setDialog(null)}
          onSubmit={() => void action.run(() => eventStockApi.start(event.companyId, event.id), "Event started.")}
        >
          <p>Marks {event.eventNo} as in execution. Posting the first stock issue also starts the event.</p>
        </Dialog>
      )}
      {dialog === "complete" && (
        <Dialog
          title="Complete event"
          busy={action.busy}
          error={action.error}
          submitLabel="Complete event"
          disabled={!readiness?.canComplete}
          onClose={() => setDialog(null)}
          onSubmit={() => void action.run(() => eventStockApi.complete(event.companyId, event.id), "Event completed.")}
        >
          <p>
            Completing locks {event.eventNo}: no more issues, returns or waste. Only a user with catering approval can
            reopen it.
          </p>
          {open.length > 0 && <p className="co-notice">Open: {open.map((c) => c.label).join(", ")}</p>}
        </Dialog>
      )}
      {dialog === "reopen" && (
        <Dialog
          title="Reopen event"
          busy={action.busy}
          error={action.error}
          submitLabel="Reopen event"
          disabled={!reason.trim()}
          onClose={() => setDialog(null)}
          onSubmit={() =>
            void action.run(() => eventStockApi.reopen(event.companyId, event.id, reason.trim()), "Event reopened.")
          }
        >
          <ReasonField value={reason} onChange={setReason} label="Why is the event being reopened?" />
        </Dialog>
      )}
    </section>
  );
}

/* ---------- stock ---------- */

type StockTab = "requirements" | "reservations" | "returns" | "waste" | "reconciliation";
type StockData = {
  requirements: Requirements | null;
  reservations: Reservation[];
  returns: EventReturn[];
  waste: EventWaste[];
  reconciliations: Reconciliation[];
};
type ItemPosition = {
  itemId: string;
  itemName: string;
  uom: string;
  issued: number;
  returned: number;
  wasted: number;
  atEvent: number;
};

const wasteTypes: WasteType[] = [
  "ingredient",
  "preparedFood",
  "spoilage",
  "transportationDamage",
  "customerRelated",
  "other",
];

function positions(data: StockData): ItemPosition[] {
  const map = new Map<string, ItemPosition>();
  for (const line of data.requirements?.ingredients ?? []) {
    const row = map.get(line.itemId) ?? {
      itemId: line.itemId,
      itemName: line.itemName,
      uom: line.baseUomCode,
      issued: 0,
      returned: 0,
      wasted: 0,
      atEvent: 0,
    };
    row.issued += line.issuedBaseQty ?? 0;
    map.set(line.itemId, row);
  }
  for (const r of data.returns.filter((x) => x.status !== "cancelled"))
    for (const l of r.lines)
      if (l.inventoryItemId && map.has(l.inventoryItemId)) map.get(l.inventoryItemId)!.returned += l.quantityReturned;
  for (const w of data.waste.filter((x) => x.status !== "cancelled"))
    for (const l of w.lines)
      if (l.inventoryItemId && map.has(l.inventoryItemId)) map.get(l.inventoryItemId)!.wasted += l.quantity;
  return [...map.values()]
    .map((row) => ({ ...row, atEvent: round6(Math.max(0, row.issued - row.returned)) }))
    .filter((row) => row.issued > 0)
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
}

export function EventStockWorkspace({ event, onChanged }: { event: CateringEventDto; onChanged: () => void }) {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<StockTab>("requirements");
  const [data, setData] = useState<StockData>({
    requirements: null,
    reservations: [],
    returns: [],
    waste: [],
    reconciliations: [],
  });
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<
    | { kind: "reserve" | "siv" | "requisition" | "demand"; notes: string; submit?: boolean }
    | { kind: "release"; id: string; reason: string }
    | { kind: "return"; notes: string; locationId: string; quantities: Record<string, number | ""> }
    | { kind: "waste"; notes: string; rows: Record<string, { quantity: number | ""; type: WasteType; reason: string }> }
    | { kind: "cancel-return" | "cancel-waste" | "cancel-reconciliation"; id: string; reason: string }
    | { kind: "approve-waste" | "approve-reconciliation"; id: string }
    | {
        kind: "reconcile";
        tolerance: number;
        notes: string;
        reviews: Record<string, { qty: number | ""; note: string }>;
      }
    | null
  >(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const done = useCallback(() => {
    setDialog(null);
    setRevision((v) => v + 1);
    onChanged();
  }, [onChanged]);
  const action = useAction(done);
  const c = event.companyId,
    e = event.id;
  const closed = ["completed", "cancelled"].includes(String(event.status));

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setLoadError("");
    void Promise.allSettled([
      eventStockApi.requirements(c, e, ctl.signal),
      eventStockApi.reservations(c, e, ctl.signal),
      eventStockApi.returns(c, e, ctl.signal),
      eventStockApi.waste(c, e, ctl.signal),
      eventStockApi.reconciliations(c, e, ctl.signal),
    ]).then(([req, res, ret, wst, rec]) => {
      if (ctl.signal.aborted) return;
      const failed = [req, res, ret, wst, rec].find((x) => x.status === "rejected") as
        PromiseRejectedResult | undefined;
      setLoadError(failed ? readApiError(failed.reason) : "");
      setData({
        requirements: req.status === "fulfilled" ? req.value : null,
        reservations: res.status === "fulfilled" ? res.value : [],
        returns: ret.status === "fulfilled" ? ret.value : [],
        waste: wst.status === "fulfilled" ? wst.value : [],
        reconciliations: rec.status === "fulfilled" ? rec.value : [],
      });
      setLoading(false);
    });
    return () => ctl.abort();
  }, [c, e, revision]);

  useEffect(() => {
    let live = true;
    orgApi
      .listStores(c, event.branchId, { page: 1, pageSize: 200 })
      .then((r) => live && setLocations((r.data.items ?? []).map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => live && setLocations([]));
    return () => {
      live = false;
    };
  }, [c, event.branchId]);

  const items = useMemo(() => positions(data), [data]);
  const ingredients = data.requirements?.ingredients ?? [];
  const toIssue = ingredients.some((x) => x.outstandingBaseQty > 0);
  const activeReservation = data.reservations.some((r) => r.status === "active");
  const latestRecon = data.reconciliations.find((r) => r.status !== "cancelled") ?? null;
  const pendingWaste = data.waste.filter((w) => w.status === "recorded");

  const tabs: [StockTab, string][] = [
    ["requirements", "Requirements & issues"],
    ["reservations", `Reservations (${data.reservations.length})`],
    ["returns", `Returns (${data.returns.length})`],
    ["waste", `Waste (${data.waste.length})`],
    ["reconciliation", "Reconciliation"],
  ];

  return (
    <section className="co-card">
      <header className="co-toolbar">
        <div className="co-view co-stock-tabs">
          {tabs.map(([key, label]) => (
            <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        <button disabled={loading} onClick={() => setRevision((v) => v + 1)}>
          Refresh
        </button>
      </header>
      {closed && (
        <p className="co-notice">
          This event is {humanize(String(event.status)).toLowerCase()}; stock can no longer move.
        </p>
      )}
      {loadError && (
        <p className="co-notice" role="alert">
          {loadError}
        </p>
      )}
      <Notices error={dialog ? "" : action.error} message={action.message} />

      {tab === "requirements" && (
        <>
          <div className="co-toolbar">
            <span>
              {data.requirements?.hasMissingRecipes ? "Some menu items have no active recipe. " : ""}
              {data.requirements?.hasShortages ? "Stock is short for some ingredients." : ""}
            </span>
            <div className="co-actions">
              <button
                disabled={closed || action.busy || !hasPermission("catering.reservations.manage") || !toIssue}
                onClick={() => setDialog({ kind: "reserve", notes: "" })}
              >
                Reserve stock
              </button>
              <button
                className="co-primary"
                disabled={closed || action.busy || !hasPermission("catering.siv.manage") || !toIssue}
                onClick={() => setDialog({ kind: "siv", notes: "", submit: true })}
              >
                Create issue voucher
              </button>
              <button
                disabled={
                  closed || action.busy || !hasPermission("purchasing.create") || !data.requirements?.hasShortages
                }
                onClick={() => setDialog({ kind: "requisition", notes: "" })}
              >
                Requisition shortages
              </button>
              <button
                disabled={closed || action.busy || !hasPermission("butchery.demand.manage")}
                onClick={() => setDialog({ kind: "demand", notes: "" })}
              >
                Butchery demand
              </button>
            </div>
          </div>
          <div className="co-table-wrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Location</th>
                  <th>Required</th>
                  <th>Issued</th>
                  <th>On open SIVs</th>
                  <th>Still to issue</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Short</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((x) => (
                  <tr key={x.itemId + (x.consumptionLocationId ?? "")}>
                    <td>{x.itemName}</td>
                    <td>{x.consumptionLocationName ?? "—"}</td>
                    <td>
                      {qty(x.requiredBaseQty)} {x.baseUomCode}
                    </td>
                    <td>{qty(x.issuedBaseQty)}</td>
                    <td>{qty(x.pendingIssueBaseQty)}</td>
                    <td>{qty(x.outstandingBaseQty)}</td>
                    <td>{qty(x.eventReservedBaseQty)}</td>
                    <td>{qty(x.availableBaseQty)}</td>
                    <td>{x.isShort ? <strong>{qty(x.shortageBaseQty)}</strong> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ingredients.length && (
              <p className="co-empty">
                {loading ? "Loading..." : "No ingredient requirements. Check the package recipes."}
              </p>
            )}
          </div>
          <p className="co-empty" style={{ padding: "14px 20px", textAlign: "left" }}>
            Issue vouchers are approved and posted in Inventory › Stock issues. Posting moves the stock out of the
            kitchen at FIFO cost and consumes this event's reservation.
          </p>
        </>
      )}

      {tab === "reservations" && (
        <div className="co-table-wrap">
          <table className="co-table">
            <thead>
              <tr>
                <th>Reservation</th>
                <th>Status</th>
                <th>Reserved</th>
                <th>Lines</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.reservations.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.reservationNo}
                    <small>{r.releaseReason ?? r.notes}</small>
                  </td>
                  <td>{humanize(r.status)}</td>
                  <td>{formatDateTime(r.reservedAtUtc)}</td>
                  <td>
                    {r.lines.map((l) => (
                      <small key={l.id}>
                        {l.itemName}: {qty(l.reservedBaseQty - l.releasedBaseQty)} {l.baseUomCode} @{" "}
                        {l.stockLocationName}
                      </small>
                    ))}
                  </td>
                  <td>
                    {r.status === "active" && (
                      <button
                        disabled={action.busy || !hasPermission("catering.reservations.manage")}
                        onClick={() => setDialog({ kind: "release", id: r.id, reason: "" })}
                      >
                        Release
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.reservations.length && <p className="co-empty">No reservations for this event.</p>}
          {activeReservation && <p className="co-empty">Posting an issue consumes the reservation automatically.</p>}
        </div>
      )}

      {tab === "returns" && (
        <>
          <div className="co-toolbar">
            <span>Returns go back into stock at the event's issue cost.</span>
            <button
              className="co-primary"
              disabled={
                closed || action.busy || !hasPermission("catering.returns.manage") || !items.some((i) => i.atEvent > 0)
              }
              onClick={() => setDialog({ kind: "return", notes: "", locationId: "", quantities: {} })}
            >
              Record return
            </button>
          </div>
          <div className="co-table-wrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>Return</th>
                  <th>Status</th>
                  <th>Returned</th>
                  <th>Items</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.returns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.returnNo}
                      <small>{r.cancellationReason ?? r.notes}</small>
                    </td>
                    <td>{humanize(r.status)}</td>
                    <td>{formatDateTime(r.returnedAtUtc)}</td>
                    <td>
                      {r.lines.map((l) => (
                        <small key={l.id}>
                          {l.inventoryItemName ?? l.description}: {qty(l.quantityReturned)} {l.uomCode}
                        </small>
                      ))}
                    </td>
                    <td>{formatCurrency(r.totalReturnedCost)}</td>
                    <td>
                      {r.status === "recorded" && (
                        <button
                          disabled={closed || action.busy || !hasPermission("catering.returns.manage")}
                          onClick={() => setDialog({ kind: "cancel-return", id: r.id, reason: "" })}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.returns.length && <p className="co-empty">No returns recorded.</p>}
          </div>
        </>
      )}

      {tab === "waste" && (
        <>
          <div className="co-toolbar">
            <span>Waste is valued at issue cost and counts against food cost only once approved.</span>
            <button
              className="co-primary"
              disabled={
                closed || action.busy || !hasPermission("catering.waste.manage") || !items.some((i) => i.atEvent > 0)
              }
              onClick={() => setDialog({ kind: "waste", notes: "", rows: {} })}
            >
              Record waste
            </button>
          </div>
          <div className="co-table-wrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>Waste</th>
                  <th>Status</th>
                  <th>Recorded</th>
                  <th>Items</th>
                  <th>Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.waste.map((w) => (
                  <tr key={w.id}>
                    <td>
                      {w.wasteNo}
                      <small>{w.cancellationReason ?? w.notes}</small>
                    </td>
                    <td>{humanize(w.status)}</td>
                    <td>{formatDateTime(w.recordedAtUtc)}</td>
                    <td>
                      {w.lines.map((l) => (
                        <small key={l.id}>
                          {l.inventoryItemName ?? l.description}: {qty(l.quantity)} {l.uomCode} ·{" "}
                          {humanize(l.wasteType)}
                          {l.reason ? ` · ${l.reason}` : ""}
                        </small>
                      ))}
                    </td>
                    <td>{formatCurrency(w.totalEstimatedCost)}</td>
                    <td>
                      <div className="co-actions">
                        {w.status === "recorded" && (
                          <button
                            disabled={closed || action.busy || !hasPermission("catering.waste.approve")}
                            title="You cannot approve waste you recorded unless your company allows it."
                            onClick={() => setDialog({ kind: "approve-waste", id: w.id })}
                          >
                            Approve
                          </button>
                        )}
                        {w.status !== "cancelled" && (
                          <button
                            disabled={closed || action.busy || !hasPermission("catering.waste.manage")}
                            onClick={() => setDialog({ kind: "cancel-waste", id: w.id, reason: "" })}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.waste.length && <p className="co-empty">No waste recorded.</p>}
          </div>
        </>
      )}

      {tab === "reconciliation" && (
        <>
          <div className="co-toolbar">
            <span>
              {pendingWaste.length
                ? `${pendingWaste.length} waste record(s) still need approval before reconciling.`
                : "Issued, returned, standard and waste quantities are computed on the server."}
            </span>
            <button
              className="co-primary"
              disabled={
                closed ||
                action.busy ||
                !hasPermission("catering.reconciliation.manage") ||
                !!latestRecon ||
                pendingWaste.length > 0 ||
                !items.length
              }
              title={latestRecon ? "Cancel the current reconciliation to run a new one." : undefined}
              onClick={() => setDialog({ kind: "reconcile", tolerance: 0, notes: "", reviews: {} })}
            >
              Reconcile consumption
            </button>
          </div>
          {latestRecon ? (
            <>
              <div className="co-toolbar">
                <h2>{latestRecon.reconciliationNo}</h2>
                <span className="co-pill">{humanize(latestRecon.status)}</span>
                <div className="co-actions">
                  {(latestRecon.status === "draft" || latestRecon.status === "requiresReview") && (
                    <button
                      disabled={closed || action.busy || !hasPermission("catering.reconciliation.approve")}
                      title="You cannot approve a reconciliation you prepared unless your company allows it."
                      onClick={() => setDialog({ kind: "approve-reconciliation", id: latestRecon.id })}
                    >
                      Approve
                    </button>
                  )}
                  {latestRecon.status !== "closed" && (
                    <button
                      disabled={closed || action.busy || !hasPermission("catering.reconciliation.manage")}
                      onClick={() => setDialog({ kind: "cancel-reconciliation", id: latestRecon.id, reason: "" })}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <dl className="co-summary">
                <div>
                  <dt>Issued cost</dt>
                  <dd>{formatCurrency(latestRecon.totalIssuedCost)}</dd>
                </div>
                <div>
                  <dt>Returned cost</dt>
                  <dd>{formatCurrency(latestRecon.totalReturnedCost)}</dd>
                </div>
                <div>
                  <dt>Approved waste</dt>
                  <dd>{formatCurrency(latestRecon.totalWasteCost)}</dd>
                </div>
                <div>
                  <dt>Unexplained</dt>
                  <dd>{formatCurrency(latestRecon.totalUnexplainedCost)}</dd>
                </div>
              </dl>
              <div className="co-table-wrap">
                <table className="co-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Issued</th>
                      <th>Returned</th>
                      <th>Used</th>
                      <th>Standard</th>
                      <th>Waste</th>
                      <th>Accepted variance</th>
                      <th>Unexplained</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestRecon.lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.description}
                          <small>{l.reviewNote}</small>
                        </td>
                        <td>
                          {qty(l.quantityIssued)} {l.uomCode}
                        </td>
                        <td>{qty(l.quantityReturned)}</td>
                        <td>{qty(l.grossConsumptionQty)}</td>
                        <td>{qty(l.actualFoodConsumptionQty)}</td>
                        <td>{qty(l.recordedWasteQty)}</td>
                        <td>{qty(l.approvedVarianceQty)}</td>
                        <td>{l.unexplainedVarianceQty ? <strong>{qty(l.unexplainedVarianceQty)}</strong> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="co-empty">Not reconciled yet.</p>
          )}
        </>
      )}

      {dialog && renderDialog()}
    </section>
  );

  function renderDialog() {
    if (!dialog) return null;
    const close = () => setDialog(null);
    const common = { busy: action.busy, error: action.error, onClose: close };
    switch (dialog.kind) {
      case "reserve":
      case "siv":
      case "requisition":
      case "demand": {
        const meta = {
          reserve: ["Reserve stock", "Holds what is still to issue so other documents cannot take it.", "Reserved."],
          siv: [
            "Create issue voucher",
            "Creates a consumption SIV for what is still to issue. It is approved and posted in Inventory.",
            "Issue voucher created.",
          ],
          requisition: [
            "Requisition shortages",
            "Raises a purchase requisition for the short quantities.",
            "Requisition raised.",
          ],
          demand: ["Butchery demand", "Raises cut demand for this event from the menu.", "Butchery demand raised."],
        }[dialog.kind];
        const notes = dialog.notes.trim() || null;
        const call =
          dialog.kind === "reserve"
            ? () => eventStockApi.reserve(c, e, notes)
            : dialog.kind === "siv"
              ? () => eventStockApi.createSiv(c, e, { submit: !!dialog.submit, notes })
              : dialog.kind === "requisition"
                ? () => eventStockApi.requisition(c, e, notes)
                : () => eventStockApi.butcheryDemand(c, e, notes);
        return (
          <Dialog {...common} title={meta[0]} submitLabel={meta[0]} onSubmit={() => void action.run(call, meta[2])}>
            <p>{meta[1]}</p>
            {dialog.kind === "siv" && (
              <label className="co-check">
                <input
                  type="checkbox"
                  checked={!!dialog.submit}
                  onChange={(ev) => setDialog({ ...dialog, submit: ev.target.checked })}
                />
                Submit for approval now
              </label>
            )}
            <label>
              Notes
              <textarea
                maxLength={1000}
                value={dialog.notes}
                onChange={(ev) => setDialog({ ...dialog, notes: ev.target.value })}
              />
            </label>
          </Dialog>
        );
      }
      case "release":
      case "cancel-return":
      case "cancel-waste":
      case "cancel-reconciliation": {
        const meta = {
          release: [
            "Release reservation",
            "The held quantities become available to other documents.",
            "Reservation released.",
          ],
          "cancel-return": [
            "Cancel return",
            "Reverses the stock that came back. Refused if it has since been used.",
            "Return cancelled.",
          ],
          "cancel-waste": ["Cancel waste", "Removes this waste from the event's reconciliation.", "Waste cancelled."],
          "cancel-reconciliation": [
            "Cancel reconciliation",
            "A new reconciliation can then be run.",
            "Reconciliation cancelled.",
          ],
        }[dialog.kind];
        const reason = dialog.reason.trim();
        const call =
          dialog.kind === "release"
            ? () => eventStockApi.releaseReservation(c, e, dialog.id, reason)
            : dialog.kind === "cancel-return"
              ? () => eventStockApi.cancelReturn(c, e, dialog.id, reason)
              : dialog.kind === "cancel-waste"
                ? () => eventStockApi.cancelWaste(c, e, dialog.id, reason)
                : () => eventStockApi.cancelReconciliation(c, e, dialog.id, reason);
        return (
          <Dialog
            {...common}
            title={meta[0]}
            submitLabel={meta[0]}
            disabled={!reason}
            onSubmit={() => void action.run(call, meta[2])}
          >
            <p>{meta[1]}</p>
            <ReasonField value={dialog.reason} onChange={(v) => setDialog({ ...dialog, reason: v })} />
          </Dialog>
        );
      }
      case "approve-waste":
        return (
          <Dialog
            {...common}
            title="Approve waste"
            submitLabel="Approve waste"
            onSubmit={() => void action.run(() => eventStockApi.approveWaste(c, e, dialog.id), "Waste approved.")}
          >
            <p>Approved waste is charged to the event at issue cost and reported separately from food cost.</p>
          </Dialog>
        );
      case "approve-reconciliation":
        return (
          <Dialog
            {...common}
            title="Approve reconciliation"
            submitLabel="Approve"
            onSubmit={() =>
              void action.run(() => eventStockApi.approveReconciliation(c, e, dialog.id), "Reconciliation approved.")
            }
          >
            <p>Approving accepts the variances shown. Unexplained variance stays on record for review.</p>
          </Dialog>
        );
      case "return": {
        const lines = items
          .map((i) => ({ item: i, value: dialog.quantities[i.itemId] }))
          .filter((x) => typeof x.value === "number" && x.value > 0);
        const over = lines.find((x) => (x.value as number) > x.item.atEvent);
        return (
          <Dialog
            {...common}
            title="Record return"
            submitLabel="Post return"
            disabled={!lines.length || !!over}
            onSubmit={() =>
              void action.run(
                () =>
                  eventStockApi.createReturn(c, e, {
                    notes: dialog.notes.trim() || null,
                    returnLocationId: dialog.locationId || null,
                    lines: lines.map((x) => ({
                      inventoryItemId: x.item.itemId,
                      description: x.item.itemName,
                      quantityIssued: x.item.issued,
                      quantityReturned: x.value as number,
                      uomCode: x.item.uom,
                    })),
                  }),
                "Return posted to stock.",
              )
            }
          >
            <label>
              Return to location
              <select
                value={dialog.locationId}
                onChange={(ev) => setDialog({ ...dialog, locationId: ev.target.value })}
              >
                <option value="">Where it was issued from</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <table className="co-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>At event</th>
                  <th>Returned now</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.itemId}>
                    <td>{i.itemName}</td>
                    <td>
                      {qty(i.atEvent)} {i.uom}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={i.atEvent}
                        step="0.001"
                        aria-label={"Returned " + i.itemName}
                        disabled={i.atEvent <= 0}
                        value={dialog.quantities[i.itemId] ?? ""}
                        onChange={(ev) =>
                          setDialog({
                            ...dialog,
                            quantities: {
                              ...dialog.quantities,
                              [i.itemId]: ev.target.value === "" ? "" : Number(ev.target.value),
                            },
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {over && <p className="co-notice">More {over.item.itemName} than is out at the event.</p>}
            <label>
              Notes
              <textarea
                maxLength={1000}
                value={dialog.notes}
                onChange={(ev) => setDialog({ ...dialog, notes: ev.target.value })}
              />
            </label>
          </Dialog>
        );
      }
      case "waste": {
        const lines = items
          .map((i) => ({ item: i, row: dialog.rows[i.itemId] }))
          .filter((x) => x.row && typeof x.row.quantity === "number" && x.row.quantity > 0);
        const over = lines.find((x) => (x.row!.quantity as number) > round6(x.item.atEvent - x.item.wasted));
        const missingReason = lines.some((x) => !x.row!.reason.trim());
        return (
          <Dialog
            {...common}
            title="Record waste"
            submitLabel="Record waste"
            disabled={!lines.length || !!over || missingReason}
            onSubmit={() =>
              void action.run(
                () =>
                  eventStockApi.createWaste(c, e, {
                    notes: dialog.notes.trim() || null,
                    lines: lines.map((x) => ({
                      inventoryItemId: x.item.itemId,
                      description: x.item.itemName,
                      quantity: x.row!.quantity as number,
                      uomCode: x.item.uom,
                      wasteType: x.row!.type,
                      reason: x.row!.reason.trim() || null,
                    })),
                  }),
                "Waste recorded. It needs approval before reconciliation.",
              )
            }
          >
            <table className="co-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Can be wasted</th>
                  <th>Quantity</th>
                  <th>Type</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const row = dialog.rows[i.itemId] ?? {
                    quantity: "" as const,
                    type: "ingredient" as WasteType,
                    reason: "",
                  };
                  const set = (patch: Partial<typeof row>) =>
                    setDialog({ ...dialog, rows: { ...dialog.rows, [i.itemId]: { ...row, ...patch } } });
                  const limit = round6(Math.max(0, i.atEvent - i.wasted));
                  return (
                    <tr key={i.itemId}>
                      <td>{i.itemName}</td>
                      <td>
                        {qty(limit)} {i.uom}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={limit}
                          step="0.001"
                          aria-label={"Wasted " + i.itemName}
                          disabled={limit <= 0}
                          value={row.quantity}
                          onChange={(ev) => set({ quantity: ev.target.value === "" ? "" : Number(ev.target.value) })}
                        />
                      </td>
                      <td>
                        <select
                          aria-label={"Waste type " + i.itemName}
                          value={row.type}
                          onChange={(ev) => set({ type: ev.target.value as WasteType })}
                        >
                          {wasteTypes.map((t) => (
                            <option key={t} value={t}>
                              {humanize(t)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={"Waste reason " + i.itemName}
                          maxLength={300}
                          value={row.reason}
                          onChange={(ev) => set({ reason: ev.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {over && <p className="co-notice">More {over.item.itemName} than is left at the event.</p>}
            {missingReason && <p className="co-notice">Give a reason for every wasted item.</p>}
            <label>
              Notes
              <textarea
                maxLength={1000}
                value={dialog.notes}
                onChange={(ev) => setDialog({ ...dialog, notes: ev.target.value })}
              />
            </label>
          </Dialog>
        );
      }
      case "reconcile": {
        const reviews = items
          .map((i) => ({ item: i, review: dialog.reviews[i.itemId] }))
          .filter((x) => x.review && typeof x.review.qty === "number" && x.review.qty !== 0);
        const noNote = reviews.some((x) => !x.review!.note.trim());
        return (
          <Dialog
            {...common}
            title="Reconcile consumption"
            submitLabel="Reconcile"
            disabled={noNote || dialog.tolerance < 0}
            onSubmit={() =>
              void action.run(
                () =>
                  eventStockApi.reconcile(c, e, {
                    varianceToleranceQty: dialog.tolerance,
                    notes: dialog.notes.trim() || null,
                    reviews: reviews.map((x) => ({
                      inventoryItemId: x.item.itemId,
                      description: x.item.itemName,
                      approvedVarianceQty: x.review!.qty as number,
                      reviewNote: x.review!.note.trim() || null,
                    })),
                  }),
                "Reconciliation saved.",
              )
            }
          >
            <p>
              The server compares what was issued, returned and wasted with the recipe standard. Enter an accepted
              variance only where you know the reason.
            </p>
            <label>
              Variance tolerance (base units)
              <input
                type="number"
                min={0}
                step="0.001"
                value={dialog.tolerance}
                onChange={(ev) => setDialog({ ...dialog, tolerance: Number(ev.target.value) || 0 })}
              />
            </label>
            <table className="co-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Issued</th>
                  <th>Returned</th>
                  <th>Accepted variance</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const review = dialog.reviews[i.itemId] ?? { qty: "" as const, note: "" };
                  const set = (patch: Partial<typeof review>) =>
                    setDialog({ ...dialog, reviews: { ...dialog.reviews, [i.itemId]: { ...review, ...patch } } });
                  return (
                    <tr key={i.itemId}>
                      <td>{i.itemName}</td>
                      <td>
                        {qty(i.issued)} {i.uom}
                      </td>
                      <td>{qty(i.returned)}</td>
                      <td>
                        <input
                          type="number"
                          step="0.001"
                          aria-label={"Accepted variance " + i.itemName}
                          value={review.qty}
                          onChange={(ev) => set({ qty: ev.target.value === "" ? "" : Number(ev.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={"Variance note " + i.itemName}
                          maxLength={300}
                          value={review.note}
                          onChange={(ev) => set({ note: ev.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {noNote && <p className="co-notice">Explain every accepted variance.</p>}
            <label>
              Notes
              <textarea
                maxLength={1000}
                value={dialog.notes}
                onChange={(ev) => setDialog({ ...dialog, notes: ev.target.value })}
              />
            </label>
          </Dialog>
        );
      }
    }
  }
}

/* ---------- profitability ---------- */

const emptyCosts: ProfitabilityInput = {
  laborCostAmount: 0,
  transportationCostAmount: 0,
  equipmentCostAmount: 0,
  otherDirectCostAmount: 0,
  notes: "",
};

export function EventProfitabilityCard({ event }: { event: CateringEventDto }) {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<Profitability[]>([]);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<ProfitabilityInput | null>(null);
  const [preview, setPreview] = useState<Profitability | null>(null);
  const [dialog, setDialog] = useState<{ kind: "approve" | "cancel"; id: string; reason: string } | null>(null);
  const done = useCallback(() => {
    setForm(null);
    setPreview(null);
    setDialog(null);
    setRevision((v) => v + 1);
  }, []);
  const action = useAction(done);
  const c = event.companyId,
    e = event.id;

  useEffect(() => {
    if (!hasPermission("catering.profitability.view")) return;
    const ctl = new AbortController();
    eventStockApi
      .profitability(c, e, ctl.signal)
      .then((r) => {
        if (!ctl.signal.aborted) {
          setRows(r);
          setLoadError("");
        }
      })
      .catch((err) => !ctl.signal.aborted && setLoadError(readApiError(err)));
    return () => ctl.abort();
  }, [c, e, revision, hasPermission]);

  if (!hasPermission("catering.profitability.view")) return null;

  const costs = (p: Profitability): [string, number][] => [
    ["Revenue (ex. tax)", p.revenueAmount],
    ["Food cost", p.foodCostAmount],
    ["Approved waste", p.wasteCostAmount],
    ["Labour", p.laborCostAmount],
    ["Transport", p.transportationCostAmount],
    ["Equipment", p.equipmentCostAmount],
    ["Other direct", p.otherDirectCostAmount],
    ["Contribution margin", p.contributionMarginAmount],
  ];

  return (
    <section className="co-card">
      <header className="co-toolbar">
        <h2>Profitability</h2>
        <button
          className="co-primary"
          disabled={
            action.busy || !hasPermission("catering.profitability.manage") || String(event.status) === "cancelled"
          }
          onClick={() => {
            setPreview(null);
            setForm({ ...emptyCosts });
          }}
        >
          Calculate
        </button>
      </header>
      <Notices error={form || dialog ? "" : action.error || loadError} message={action.message} />
      <div className="co-table-wrap">
        <table className="co-table">
          <thead>
            <tr>
              <th>Analysis</th>
              <th>Status</th>
              <th>Calculated</th>
              <th>Revenue</th>
              <th>Direct cost</th>
              <th>Margin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.analysisNo}
                  <small>{p.finalBillNo ? `Invoice basis ${p.finalBillNo}` : "Contract basis"}</small>
                </td>
                <td>{humanize(p.status)}</td>
                <td>{formatDay(p.calculatedAtUtc)}</td>
                <td>{formatCurrency(p.revenueAmount)}</td>
                <td>{formatCurrency(p.totalDirectCostAmount)}</td>
                <td>
                  {formatCurrency(p.contributionMarginAmount)}{" "}
                  <small>{Number(p.contributionMarginPercent).toFixed(1)}%</small>
                </td>
                <td>
                  <div className="co-actions">
                    {p.status === "draft" && (
                      <button
                        disabled={action.busy || !hasPermission("catering.profitability.approve")}
                        onClick={() => setDialog({ kind: "approve", id: p.id, reason: "" })}
                      >
                        Approve
                      </button>
                    )}
                    {p.status !== "cancelled" && (
                      <button
                        disabled={action.busy || !hasPermission("catering.profitability.manage")}
                        onClick={() => setDialog({ kind: "cancel", id: p.id, reason: "" })}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="co-empty">No profitability analysis yet.</p>}
      </div>
      {form && (
        <Dialog
          busy={action.busy}
          error={action.error}
          title="Calculate profitability"
          submitLabel={preview ? "Save analysis" : "Preview"}
          onClose={() => setForm(null)}
          onSubmit={() => {
            if (!preview) {
              void (async () => {
                try {
                  action.setError("");
                  setPreview(await eventStockApi.previewProfitability(c, e, form));
                } catch (err) {
                  action.setError(readApiError(err));
                }
              })();
              return;
            }
            void action.run(() => eventStockApi.createProfitability(c, e, form), "Profitability saved.");
          }}
        >
          <p>
            Revenue comes from the issued invoice (or the contract without tax); food and waste cost come from the stock
            ledger.
          </p>
          <div className="co-form-grid">
            {(
              [
                ["laborCostAmount", "Labour cost"],
                ["transportationCostAmount", "Transport cost"],
                ["equipmentCostAmount", "Equipment cost"],
                ["otherDirectCostAmount", "Other direct cost"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form[key]}
                  onChange={(ev) => {
                    setPreview(null);
                    setForm({ ...form, [key]: Math.max(0, Number(ev.target.value) || 0) });
                  }}
                />
              </label>
            ))}
          </div>
          <label>
            Notes
            <textarea
              maxLength={1000}
              value={form.notes ?? ""}
              onChange={(ev) => setForm({ ...form, notes: ev.target.value })}
            />
          </label>
          {preview && (
            <dl className="co-summary">
              {costs(preview).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{formatCurrency(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Dialog>
      )}
      {dialog && (
        <Dialog
          busy={action.busy}
          error={action.error}
          title={dialog.kind === "approve" ? "Approve analysis" : "Cancel analysis"}
          submitLabel={dialog.kind === "approve" ? "Approve" : "Cancel analysis"}
          disabled={dialog.kind === "cancel" && !dialog.reason.trim()}
          onClose={() => setDialog(null)}
          onSubmit={() =>
            void action.run(
              () =>
                dialog.kind === "approve"
                  ? eventStockApi.approveProfitability(c, e, dialog.id)
                  : eventStockApi.cancelProfitability(c, e, dialog.id, dialog.reason.trim()),
              dialog.kind === "approve" ? "Analysis approved." : "Analysis cancelled.",
            )
          }
        >
          {dialog.kind === "approve" ? (
            <p>You cannot approve an analysis you prepared unless your company allows it.</p>
          ) : (
            <ReasonField value={dialog.reason} onChange={(v) => setDialog({ ...dialog, reason: v })} />
          )}
        </Dialog>
      )}
    </section>
  );
}
