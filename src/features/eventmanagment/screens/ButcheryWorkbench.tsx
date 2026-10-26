import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Select } from "../../../components/ui/select";
import { useUnsavedChanges } from "../components/useUnsavedChanges";
import { RemovePlannedBatch } from "../../../components/RemovePlannedBatch";
import { useDialogFocus } from "../components/useDialogFocus";
import { useAuth } from "../../../auth/AuthProvider";
import { useEffect, useRef, useState } from "react";
import "./event-workspace.css";
import { ButcheryJourneyPanel } from "./ButcheryJourneyPanel";
import { useSearchParams } from "react-router-dom";
import { http } from "../../../api/http";
import {
  butcheryManagementApi as api,
  type ButcheryProcessingBatchDto as Batch,
  type ButcheryOperationDto,
  type MeatCutTemplateDto,
  type ButcheryBatchTraceDto as Trace,
  type ButcherySourceLotDto,
} from "../api/butcheryManagementApi";
import { grnApi } from "../../inventory/grn/api/grnApi";
import type { GrnListDto, GrnDetailDto } from "../../inventory/grn/types/grn.types";
import { formatDay, readApiError } from "../sales/ui";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { humanize } from "../sales/options";

const states = ["", "draft", "submitted", "approved", "inProcessing", "completed", "posted", "cancelled", "reversed"];
const state = (v: string | number) =>
  typeof v === "number" ? (states[v] ?? String(v)) : v.charAt(0).toLowerCase() + v.slice(1);
const isWaste = (v: string | number) => v === 4 || String(v).toLowerCase() === "waste";
const fixed = (n: number | null | undefined) => (n ?? 0).toFixed(2);
function printLabel(trace: Trace, output: Trace["outputs"][number]) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  const style = doc.createElement("style");
  style.textContent =
    "@page{size:100mm 70mm;margin:5mm}body{font:14px system-ui;color:#111}h1{font-size:22px;margin:8px 0}p{margin:7px 0}small{font-size:10px}";
  doc.head.append(style);
  const title = doc.createElement("h1");
  title.textContent = output.outputItemName;
  doc.body.append(title);
  const ledger = trace.ledgerLines.find((l) => l.id === output.ledgerLineId);
  for (const text of [
    "Lot: " + output.producedBatchNo,
    "Batch: " + trace.batch.batchNo,
    "Net output: " + fixed(output.actualWeightBase) + " kg",
    "Source lot: " + (trace.sourceLot.batchNo ?? "Unspecified"),
    "Produced: " + (trace.postedAtUtc ? formatDay(trace.postedAtUtc) : "Unspecified"),
    "Expiry: " + (ledger?.expiryDate ?? "Not recorded"),
  ]) {
    const p = doc.createElement("p");
    p.textContent = text;
    doc.body.append(p);
  }
  const ref = doc.createElement("small");
  ref.textContent = "Trace ID: " + output.producedFifoLotId;
  doc.body.append(ref);
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60000);
}
export function ButcheryWorkbench({ companyId, branchId }: { companyId: string; branchId: string }) {
  const { hasPermission } = useAuth();
  const canProcess = hasPermission("butchery.process"),
    canApprove = hasPermission("butchery.approve"),
    canPost = hasPermission("butchery.post");
  const [processingDate, setProcessingDate] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [openCount, setOpenCount] = useState(0);
  const [params, setParams] = useSearchParams();
  const initialBatch = useRef(params.get("batch"));
  const view = params.get("view") ?? "batches";
  const [batches, setBatches] = useState<Batch[]>([]),
    [selected, setSelected] = useState(params.get("batch") ?? "");
  const [operations, setOperations] = useState<ButcheryOperationDto[]>([]),
    [templates, setTemplates] = useState<MeatCutTemplateDto[]>([]);
  const [sourceMode, setSourceMode] = useState<"grn" | "lot">("grn");
  const [sourceLots, setSourceLots] = useState<ButcherySourceLotDto[]>([]);
  const [lotKey, setLotKey] = useState("");
  const [lotWeight, setLotWeight] = useState("");
  const sourceLot = sourceLots.find(l => `${l.id}:${l.operationId}` === lotKey);
  const [receipts, setReceipts] = useState<GrnListDto[]>([]),
    [receipt, setReceipt] = useState<GrnDetailDto | null>(null);
  const [grnId, setGrnId] = useState(params.get("grnId") ?? ""),
    [lineId, setLineId] = useState(""),
    [operationId, setOperationId] = useState(""),
    [templateId, setTemplateId] = useState("");
  const [creating, setCreating] = useState(params.get("source") === "grn" || params.get("new") === "1"),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const lock = useRef(false);
  const [cuts, setCuts] = useState<Batch["outputs"]>([]),
    [traces, setTraces] = useState<Trace[]>([]),
    [traceLoading, setTraceLoading] = useState(false);
  const [varianceReason, setVarianceReason] = useState(""),
    [confirm, setConfirm] = useState<"variance" | "post" | "completePost" | "cancel" | "reverse" | null>(null);
  // The server query waits for a pause in typing; the visible list filters instantly.
  const [serverSearch, setServerSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setServerSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useDialogFocus(creating, busy, () => {
    if (guard.confirmDiscard()) setCreating(false);
  });
  const batch = batches.find((b) => b.id === selected) ?? null;
  const status = batch ? state(batch.status) : "";
  const line = receipt?.lines.find((l) => l.id === lineId);
  const matching = templates.filter((t) => t.isActive && t.sourceItemId === (sourceMode === "lot" ? sourceLot?.itemId : line?.itemId));
  const editable = canProcess && ["draft", "inProcessing"].includes(status);
  const dirty =
    JSON.stringify(cuts) !== JSON.stringify(batch?.outputs ?? []) ||
    (creating && !!(grnId || lineId || operationId || templateId || lotKey));
  const guard = useUnsavedChanges(dirty);

  useEffect(() => {
    let alive = true;
    setSourceLots([]); setLotKey(""); setLotWeight("");
    if (creating && sourceMode === "lot" && companyId && branchId && canProcess) {
      api.listSourceLots(companyId, branchId).then(lots => { if (alive) setSourceLots(lots); })
        .catch(e => { if (alive) setError(readApiError(e, "Unable to load available stock lots.")); });
    }
    return () => { alive = false; };
  }, [companyId, branchId, creating, sourceMode, revision, canProcess]);

  useEffect(() => {
    let alive = true;
    setOperations([]);
    setTemplates([]);
    if (!companyId) return;
    Promise.all([api.listOperations(companyId, branchId), api.listCutTemplates(companyId)])
      .then(([o, t]) => {
        if (alive) {
          setOperations(o.filter((x) => x.isEnabled));
          setTemplates(t);
        }
      })
      .catch((e) => {
        if (alive) setError(readApiError(e, "Unable to load butchery setup."));
      });
    return () => {
      alive = false;
    };
  }, [companyId, branchId, revision]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setMessage("");
    setBatches([]);
    if (!companyId) {
      setLoading(false);
      return;
    }
    Promise.all([api.searchBatches(companyId, { branchId, q: serverSearch, page })])
      .then(async ([b]) => {
        const linked = initialBatch.current;
        initialBatch.current = null;
        if (linked && !b.items.some((x) => x.id === linked)) {
          const item = await api.getBatch(companyId, linked);
          if (!branchId || item.branchId === branchId) b.items.unshift(item);
        }
        if (alive) {
          setBatches(b.items);
          setTotal(b.total);
          setOpenCount(b.openCount);
          setSelected((id) => (b.items.some((x) => x.id === id) ? id : (b.items[0]?.id ?? "")));
        }
      })
      .catch((e) => {
        if (alive) setError(readApiError(e, "Unable to load butchery."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [companyId, branchId, revision, serverSearch, page]);
  useEffect(() => {
    setCuts(batch?.outputs ?? []);
    setConfirm(null);
    setVarianceReason("");
  }, [batch]);
  // Traces are fetched again only when the set of batches to trace (or the open batch's status) changes,
  // not after every save on the page.
  const traceIds =
    view === "stock"
      ? batches.filter((b) => state(b.status) === "posted").map((b) => b.id)
      : selected
        ? [selected]
        : [];
  const traceKey = traceIds.join(",") + "|" + status;
  useEffect(() => {
    let alive = true;
    setTraces([]);
    setTraceLoading(true);
    const ids = traceKey.split("|")[0].split(",").filter(Boolean);
    (async () => {
      const all: Trace[] = [];
      for (let i = 0; i < ids.length; i += 8) {
        if (!alive) return;
        all.push(...(await Promise.all(ids.slice(i, i + 8).map((id) => api.trace(companyId, id)))));
      }
      if (alive) setTraces(all);
    })()
      .catch((e) => {
        if (alive) setError(readApiError(e, "Unable to load lot traceability."));
      })
      .finally(() => {
        if (alive) setTraceLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [companyId, traceKey]);
  useEffect(() => {
    let alive = true;
    setReceipts([]);
    if (creating && companyId && sourceMode === "grn")
      grnApi
        .list({ companyId, branchId }, { status: "POSTED" })
        .then((r) => {
          if (alive) setReceipts(r);
        })
        .catch((e) => {
          if (alive) setError(readApiError(e));
        });
    return () => {
      alive = false;
    };
  }, [creating, companyId, branchId, sourceMode]);
  useEffect(() => {
    let alive = true;
    setReceipt(null);
    setLineId("");
    setTemplateId("");
    if (grnId && companyId && sourceMode === "grn")
      grnApi
        .getById({ companyId, branchId }, grnId)
        .then((r) => {
          if (alive) {
            setReceipt(r);
            if (r.lines.length === 1) setLineId(r.lines[0].id);
          }
        })
        .catch((e) => {
          if (alive) setError(readApiError(e));
        });
    return () => {
      alive = false;
    };
  }, [grnId, companyId, branchId, sourceMode]);
  useEffect(() => {
    setTemplateId("");
  }, [lineId]);
  async function run(call: () => Promise<Batch>, success: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await call();
      setOpenCount(
        (n) =>
          n +
          (batch ? 0 : 1) -
          (["posted", "cancelled", "reversed"].includes(state(result.status)) &&
          !["posted", "cancelled", "reversed"].includes(status)
            ? 1
            : 0),
      );
      if (!batch) setTotal((n) => n + 1);
      setBatches((rows) => [result, ...rows.filter((r) => r.id !== result.id)]);
      setSelected(result.id);
      setCuts(result.outputs);
      guard.markSaved();
      setMessage(success);
      setConfirm(null);
      return result;
    } catch (e) {
      setError(readApiError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (sourceMode === "lot") {
      const weight = Number(lotWeight);
      if (!sourceLot || !matching.some(t => t.id === templateId) || !Number.isFinite(weight) || weight <= 0 || weight > sourceLot.availableWeightBase) return;
      const result = await run(() => api.createBatchFromLot(companyId, sourceLot, templateId, weight, new Date(processingDate).toISOString()), "Cutting order created.");
      if (result) { setCreating(false); setParams({ view: "yield", batch: result.id }); }
      return;
    }
    if (!receipt || !line || !templateId || !operationId) return;
    const result = await run(
      () =>
        api.createBatchFromGrn(companyId, grnId, {
          branchId: receipt.branchId,
          grnLineId: line.id,
          butcheryOperationId: operationId,
          meatCutTemplateId: templateId,
          startingWeightBase: null,
          processingDateUtc: new Date(processingDate).toISOString(),
        }),
      "Cutting order created.",
    );
    if (result) {
      setCreating(false);
      setParams({ view: "yield", batch: result.id });
    }
  }
  const save = () => {
    if (!batch) return;
    if (cuts.some((c) => !Number.isFinite(c.actualWeightBase) || c.actualWeightBase < 0)) {
      setError("Enter a valid non-negative weight for every cut.");
      return;
    }
    if (cuts.some((c) => isWaste(c.classification) && c.actualWeightBase > 0 && !c.wasteReason?.trim())) {
      setError("Enter a reason for every waste output.");
      return;
    }
    void run(
      () =>
        api.updateOutputs(companyId, batch.id, {
          outputs: cuts.map((c) => ({
            meatCutTemplateLineId: c.meatCutTemplateLineId,
            actualWeightBase: c.actualWeightBase,
            wasteReason: c.wasteReason,
            notes: c.notes,
          })),
        }),
      "Output weights saved.",
    );
  };
  const transition = (action: "submit" | "start" | "complete") => {
    if (batch && !dirty) void run(() => api[action](companyId, batch.id), humanize(action) + " saved.");
  };
  /** Why the next step is unavailable, said once under the buttons instead of leaving them silently greyed. */
  const nextStepHint = !batch
    ? ""
    : dirty
      ? "Save or discard the weight changes first."
      : status === "draft"
        ? canProcess
          ? ""
          : "Submitting needs the butchery.process permission."
        : status === "submitted"
          ? canApprove
            ? "Approval must come from someone other than the person who created the batch."
            : "Waiting for a user with butchery.approve (not the batch's creator)."
          : status === "approved"
            ? canProcess
              ? ""
              : "Starting the breakdown needs the butchery.process permission."
            : status === "inProcessing"
              ? !batch.isVarianceWithinTolerance
                ? "The unexplained weight is above tolerance: correct the weights or have the variance approved (by someone other than the weigher)."
                : canProcess
                  ? ""
                  : "Completing needs the butchery.process permission."
              : status === "completed"
                ? canPost
                  ? "Posting must come from someone other than the person who created the batch."
                  : "Posting needs the butchery.post permission."
                : "";
  const accounted = cuts.reduce((s, c) => s + c.actualWeightBase, 0);
  const waste = cuts.filter((c) => isWaste(c.classification)).reduce((s, c) => s + c.actualWeightBase, 0);
  const changeView = (next: string) => {
    const p = new URLSearchParams(params);
    p.set("view", next);
    setParams(p);
  };
  const trace = traces.find((t) => t.batch.id === selected);
  const stock = traces
    .filter((t) => !t.hasReversal)
    .flatMap((t) => t.outputs.filter((o) => o.producedFifoLotId).map((o) => ({ trace: t, output: o })));
  const title =
    (
      {
        batches: "Cutting orders",
        yield: "Yield & carcass",
        stock: "Stock by cut",
        labels: "Labels & tracing",
        waste: "Waste & shrinkage",
      } as Record<string, string>
    )[view] ?? "Cutting orders";
  return (
    <section className="co-workspace">
      <header className="co-heading">
        <div>
          <span className="co-eyebrow">Butchery / Production</span>
          <h1>{title}</h1>
          <p>Receive, weigh, review and post with full lot traceability.</p>
        </div>
        <div className="co-actions">
          <Button variant="outline" disabled={busy || loading || dirty} onClick={() => setRevision((r) => r + 1)}>
            Refresh
          </Button>
          <Button
            className="co-primary"
            disabled={!branchId || busy || dirty || !canProcess}
            onClick={() => setCreating(true)}
          >
            + Cutting order
          </Button>
        </div>
      </header>
      {error && (
        <p role="alert" className="co-notice">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="co-notice">
          {message}
        </p>
      )}
      {!canProcess && (
        <p className="co-notice">Creating orders and editing weights requires butchery.process permission.</p>
      )}
      {status === "submitted" && !canApprove && (
        <p className="co-notice">Batch approval requires butchery.approve permission.</p>
      )}
      {status === "completed" && !canPost && <p className="co-notice">Posting requires butchery.post permission.</p>}
      <div className="co-metrics">
        <article>
          <span>Open batches</span>
          <strong>{loading ? "—" : openCount}</strong>
          <small>In this branch</small>
        </article>
        <article>
          <span>Input weight</span>
          <strong>{fixed(batch?.startingWeightBase)} kg</strong>
          <small>{batch?.batchNo ?? "Select a batch"}</small>
        </article>
        <article>
          <span>Recorded waste</span>
          <strong>{fixed(waste)} kg</strong>
          <small>Selected batch outputs</small>
        </article>
        <article>
          <span>Unaccounted weight</span>
          <strong>
            {fixed((batch?.startingWeightBase ?? 0) - accounted - (batch?.approvedVarianceWeightBase ?? 0))} kg
          </strong>
          <small>{dirty ? "Unsaved weights" : "After approved variance"}</small>
        </article>
      </div>
      {batch ? (
        <section className="co-card" aria-label={`Workflow for ${batch.batchNo}`}>
          <ButcheryJourneyPanel companyId={companyId} batchId={batch.id} revision={`${revision}|${batch.status}`} />
        </section>
      ) : null}
      <section className="co-card">
        <div className="co-toolbar">
          <div className="co-view">
            {["batches", "yield", "stock", "labels", "waste"].map((v) => (
              <Button variant="outline" key={v} disabled={busy} aria-pressed={view === v} onClick={() => changeView(v)}>
                {
                  (
                    { batches: "Orders", yield: "Yield", stock: "Stock", labels: "Labels", waste: "Waste" } as Record<
                      string,
                      string
                    >
                  )[v]
                }
              </Button>
            ))}
          </div>
          <Input
            aria-label="Search batches or cuts"
            placeholder="Search batches or cuts..."
            disabled={dirty || busy}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {loading ? (
          <p className="co-empty" role="status">
            Loading cutting orders...
          </p>
        ) : view === "stock" ? (
          <>
            <p className="co-caption">
              Remaining produced lots from posted butchery batches in this branch. Other inventory receipts are
              excluded.
            </p>
            {traceLoading ? (
              <p className="co-empty">Loading produced lots...</p>
            ) : (
              <div className="co-table-wrap">
                <table className="co-table">
                  <thead>
                    <tr>
                      <th>Cut</th>
                      <th>Produced lot</th>
                      <th>Batch</th>
                      <th>Remaining kg</th>
                      <th>Label</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock
                      .filter((s) =>
                        (s.output.outputItemName + " " + s.output.producedBatchNo)
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map(({ trace: t, output: o }) => (
                        <tr key={o.producedFifoLotId}>
                          <td>{o.outputItemName}</td>
                          <td>{o.producedBatchNo ?? "Not recorded"}</td>
                          <td>{t.batch.batchNo}</td>
                          <td>{fixed(o.producedQtyRemainingBase)}</td>
                          <td>
                            <Button variant="outline" onClick={() => printLabel(t, o)}>Print label</Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!stock.length && <p className="co-empty">No posted cut lots available.</p>}
              </div>
            )}
          </>
        ) : (
          <div className="co-butchery-grid">
            <aside>
              <h2>Batch queue</h2>
              {batches
                .filter((b) => (b.batchNo + " " + b.sourceItemName).toLowerCase().includes(search.toLowerCase()))
                .map((b) => (
                  <Button variant="outline"
                    key={b.id}
                    disabled={busy || dirty}
                    className={selected === b.id ? "is-active" : ""}
                    onClick={() => {
                      setSelected(b.id);
                      setMessage("");
                      setError("");
                      const p = new URLSearchParams(params);
                      p.set("batch", b.id);
                      setParams(p);
                    }}
                  >
                    <strong>{b.batchNo}</strong>
                    <span>{b.sourceItemName}</span>
                    <small>
                      {humanize(state(b.status))} · {fixed(b.startingWeightBase)} kg
                    </small>
                  </Button>
                ))}
              <div className="co-actions">
                <Button variant="outline" disabled={busy || dirty || page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" disabled={busy || dirty || page * 25 >= total} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
              <small>
                {total} batches · Page {page}
              </small>
            </aside>
            <div className="co-batch-detail">
              {!batch ? (
                <div className="co-empty">
                  <h3>No cutting orders yet</h3>
                  <p>Create one from a posted goods receipt.</p>
                </div>
              ) : (
                <>
                  <header className="co-toolbar">
                    <div>
                      <h2>{batch.batchNo}</h2>
                      <p>
                        {batch.sourceItemName} · {batch.sourceStockLocationName}
                      </p>
                    </div>
                    <span className="co-pill">{humanize(status)}</span>
                  </header>
                  {view === "labels" ? (
                    <>
                      <p className="co-caption">
                        Source lot: {trace?.sourceLot.batchNo ?? batch.fifoLotBatchNo ?? "Not recorded"} · Template:{" "}
                        {batch.meatCutTemplateName}
                      </p>
                      {traceLoading ? (
                        <p>Loading trace...</p>
                      ) : (
                        trace?.outputs
                          .filter((o) => o.producedFifoLotId)
                          .map((o) => (
                            <div className="co-toolbar" key={o.outputId}>
                              <div>
                                <strong>{o.outputItemName}</strong>
                                <p>
                                  {o.producedBatchNo} · {fixed(o.actualWeightBase)} kg
                                </p>
                              </div>
                              <Button variant="outline" disabled={trace.hasReversal} onClick={() => printLabel(trace, o)}>
                                Print label
                              </Button>
                            </div>
                          ))
                      )}
                      {!traceLoading && !trace?.outputs.some((o) => o.producedFifoLotId) && (
                        <p className="co-empty">Post the completed batch to generate traceable stock labels.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="co-caption">
                        {view === "waste"
                          ? "Record waste weights and reasons below, then save."
                          : "Enter actual output weights. Save before moving to the next step."}{" "}
                        All weights use the stock item base unit (kg).
                      </p>
                      <div className="co-table-wrap">
                        <table className="co-table">
                          <thead>
                            <tr>
                              <th>Cut / classification</th>
                              <th>Expected kg</th>
                              <th>Actual kg</th>
                              {status === "posted" && <th>Allocated cost</th>}
                              <th>Reason / notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cuts
                              .filter((c) => view !== "waste" || isWaste(c.classification))
                              .map((c) => (
                                <tr key={c.meatCutTemplateLineId}>
                                  <td>
                                    <strong>{c.outputItemName}</strong>
                                    <small>
                                      {typeof c.classification === "number"
                                        ? ["", "Saleable", "Non-saleable", "By-product", "Waste"][c.classification]
                                        : humanize(c.classification)}
                                    </small>
                                  </td>
                                  <td>{fixed(c.expectedWeightBase)}</td>
                                  <td>
                                    <Input
                                      aria-label={c.outputItemName + " actual kg"}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      disabled={busy || !editable}
                                      value={c.actualWeightBase}
                                      onChange={(e) =>
                                        setCuts((rows) =>
                                          rows.map((r) =>
                                            r.meatCutTemplateLineId === c.meatCutTemplateLineId
                                              ? { ...r, actualWeightBase: Number(e.target.value) }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                  {status === "posted" && (
                                    <td>
                                      {formatCurrency(c.allocatedCost ?? 0)}
                                      <small>{formatCurrency(c.allocatedUnitCost ?? 0)} / kg</small>
                                    </td>
                                  )}
                                  <td>
                                    <Input
                                      aria-label={c.outputItemName + " reason"}
                                      disabled={busy || !editable}
                                      placeholder={isWaste(c.classification) ? "Waste reason" : "Optional notes"}
                                      value={(isWaste(c.classification) ? c.wasteReason : c.notes) ?? ""}
                                      onChange={(e) =>
                                        setCuts((rows) =>
                                          rows.map((r) =>
                                            r.meatCutTemplateLineId === c.meatCutTemplateLineId
                                              ? {
                                                  ...r,
                                                  [isWaste(c.classification) ? "wasteReason" : "notes"]: e.target.value,
                                                }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="co-toolbar">
                        <span>
                          {dirty ? "Unsaved changes" : "Weights saved"} · Accounted {fixed(accounted)} kg
                        </span>
                        <div className="co-actions">
                          <Button variant="outline" disabled={!dirty || busy} onClick={() => setCuts(batch.outputs)}>
                            Discard changes
                          </Button>
                          <Button className="co-primary" disabled={!editable || busy || !dirty} onClick={save}>
                            {busy ? "Saving..." : "Save weights"}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="co-batch-actions">
                    <h3>Next step</h3>
                    <p>Draft → Submit → Approve → Start → Complete → Post stock</p>
                    <div className="co-actions">
                      {status === "draft" && (
                        <Button variant="outline"
                          disabled={busy || dirty || !cuts.length || !canProcess}
                          onClick={() => transition("submit")}
                        >
                          Submit for approval
                        </Button>
                      )}
                      {status === "draft" && (
                        <RemovePlannedBatch
                          key={batch.id}
                          permission="butchery.remove"
                          url={`/companies/${companyId}/butchery/batches/${batch.id}/remove?branchId=${batch.branchId}`}
                          disabled={busy || dirty}
                          onBusyChange={setBusy}
                          onRemoved={() => {
                            setSelected("");
                            setRevision((n) => n + 1);
                            setMessage("Planned batch removed. Its audit history is retained.");
                          }}
                        />
                      )}
                      {status === "submitted" && (
                        <Button variant="outline"
                          disabled={busy || dirty || !canApprove}
                          onClick={() =>
                            void run(
                              async () =>
                                (
                                  await http.post<Batch>(
                                    "/companies/" + companyId + "/butchery/batches/" + batch.id + "/approve",
                                  )
                                ).data,
                              "Batch approved.",
                            )
                          }
                        >
                          Approve batch
                        </Button>
                      )}
                      {status === "submitted" && canApprove && canProcess && (
                        <Button
                          className="co-primary"
                          disabled={busy || dirty}
                          onClick={() =>
                            void run(async () => {
                              await http.post<Batch>("/companies/" + companyId + "/butchery/batches/" + batch.id + "/approve");
                              return await api.start(companyId, batch.id);
                            }, "Batch approved and breakdown started.")
                          }
                        >
                          Approve & start
                        </Button>
                      )}
                      {status === "approved" && (
                        <Button variant="outline" disabled={busy || dirty || !canProcess} onClick={() => transition("start")}>
                          Start breakdown
                        </Button>
                      )}
                      {status === "inProcessing" && (
                        <>
                          <Button variant="outline"
                            disabled={busy || dirty || !canApprove || batch.unaccountedVarianceWeightBase <= 0}
                            onClick={() => setConfirm("variance")}
                          >
                            Review variance
                          </Button>
                          <Button variant="outline"
                            disabled={busy || dirty || !canProcess || !batch.isVarianceWithinTolerance}
                            onClick={() => transition("complete")}
                          >
                            Complete batch
                          </Button>
                          {canPost && (
                            <Button
                              className="co-primary"
                              disabled={busy || dirty || !canProcess || !batch.isVarianceWithinTolerance}
                              onClick={() => setConfirm("completePost")}
                            >
                              Complete & post
                            </Button>
                          )}
                        </>
                      )}
                      {status === "completed" && (
                        <Button
                          className="co-primary"
                          disabled={busy || dirty || !canPost}
                          onClick={() => setConfirm("post")}
                        >
                          Post stock
                        </Button>
                      )}
                      {status === "posted" && (
                        <Button variant="outline" onClick={() => changeView("labels")}>Open labels & tracing</Button>
                      )}
                      {["submitted", "approved", "inProcessing", "completed"].includes(status) && (
                        <Button variant="outline"
                          disabled={busy || dirty || !hasPermission("butchery.remove")}
                          onClick={() => {
                            setVarianceReason("");
                            setConfirm("cancel");
                          }}
                        >
                          Cancel batch
                        </Button>
                      )}
                      {status === "posted" && (
                        <Button variant="outline"
                          disabled={busy || !canPost}
                          onClick={() => {
                            setVarianceReason("");
                            setConfirm("reverse");
                          }}
                        >
                          Reverse posting
                        </Button>
                      )}
                    </div>
                    {nextStepHint && (
                      <small className="ci-why" role="note">
                        {nextStepHint}
                      </small>
                    )}
                  </div>
                  {confirm && (
                    <form
                      className="co-editor-section"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (confirm === "post")
                          void run(() => api.post(companyId, batch.id), "Stock posted and trace labels generated.");
                        else if (confirm === "completePost")
                          void run(async () => {
                            const done = await api.complete(companyId, batch.id);
                            try {
                              return await api.post(companyId, batch.id);
                            } catch (e) {
                              // Completed but not posted (e.g. the poster must be someone else): show the real state.
                              setBatches((rows) => [done, ...rows.filter((r) => r.id !== done.id)]);
                              throw e;
                            }
                          }, "Batch completed, stock posted and trace labels generated.");
                        else
                          void run(
                            () =>
                              confirm === "cancel"
                                ? api.cancel(companyId, batch.id, varianceReason.trim())
                                : confirm === "reverse"
                                  ? api.reverse(companyId, batch.id, varianceReason.trim())
                                  : api.approveVariance(companyId, batch.id, { reason: varianceReason.trim() }),
                            confirm === "cancel"
                              ? "Batch cancelled and its demand reopened."
                              : confirm === "reverse"
                                ? "Posting reversed; the carcass lot is restored."
                                : "Variance approved.",
                          );
                      }}
                    >
                      <h3>
                        {confirm === "completePost"
                          ? "Complete this batch and post it to inventory?"
                          : confirm === "post"
                          ? "Post this batch to inventory?"
                          : confirm === "cancel"
                            ? "Cancel this batch?"
                            : confirm === "reverse"
                              ? "Reverse this posted batch?"
                              : "Approve unexplained weight variance"}
                      </h3>
                      <p>
                        {confirm === "post" || confirm === "completePost"
                          ? "This consumes the source lot and creates the output stock lots. Joint cost is shared by relative market value; by-products carry their fixed value."
                          : confirm === "cancel"
                            ? "The carcass lot is released for another batch. Cancelled batches stay on record."
                            : confirm === "reverse"
                              ? "Refused if any produced cut has already been used. Reverses the cuts and restores the carcass lot."
                              : fixed(batch.unaccountedVarianceWeightBase) +
                                " kg is unexplained. Approving accepts it as processing loss; you cannot approve a batch you weighed unless your company allows it."}
                      </p>
                      {confirm !== "post" && confirm !== "completePost" && (
                        <label>
                          {confirm === "variance" ? "Approval reason" : "Reason"}
                          <Textarea
                            required
                            minLength={3}
                            maxLength={500}
                            value={varianceReason}
                            onChange={(e) => setVarianceReason(e.target.value)}
                          />
                        </label>
                      )}
                      <div className="co-actions">
                        <Button disabled={busy} className="co-primary">
                          Confirm{" "}
                          {confirm === "post" || confirm === "completePost" ? "posting" : confirm === "variance" ? "variance approval" : confirm}
                        </Button>
                        <Button variant="outline" disabled={busy} type="button" onClick={() => setConfirm(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>
      {creating && (
        <div className="co-modal-backdrop">
          <section role="dialog" aria-modal="true" aria-label="New cutting order" className="co-modal">
            <form onSubmit={create}>
              <header className="co-toolbar">
                <h2>New cutting order</h2>
                <Button variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (guard.confirmDiscard()) setCreating(false);
                  }}
                >
                  Close
                </Button>
              </header>
              <fieldset disabled={busy}>
                <p>
                  Choose a posted receipt, or stock already received into this branch through a transfer.
                </p>
                <div className="co-form-grid">
                  <label>
                    Stock source
                    <Select value={sourceMode} onChange={e => { setSourceMode(e.target.value as "grn" | "lot"); setTemplateId(""); setOperationId(""); }}>
                      <option value="grn">Posted goods receipt</option>
                      <option value="lot">Available branch stock (including transfers)</option>
                    </Select>
                  </label>
                  {sourceMode === "lot" && <>
                    <label>Available stock lot
                      <Select required value={lotKey} onChange={e => {
                        setLotKey(e.target.value); setTemplateId("");
                        const lot = sourceLots.find(l => `${l.id}:${l.operationId}` === e.target.value);
                        setLotWeight(lot ? String(lot.availableWeightBase) : "");
                      }}>
                        <option value="">Select stock lot</option>
                        {sourceLots.map(l => <option key={`${l.id}:${l.operationId}`} value={`${l.id}:${l.operationId}`}>
                          {l.itemName} · {l.locationName} · {l.sourceNo || l.batchNo || l.id} · {l.availableWeightBase} {l.uomCode} · {operations.find(o => o.id === l.operationId)?.name}
                        </option>)}
                      </Select>
                    </label>
                    <label>Starting weight {sourceLot?.uomCode}
                      <Input required type="number" min="0.000001" step="any" max={sourceLot?.availableWeightBase} value={lotWeight} onChange={e => setLotWeight(e.target.value)} />
                    </label>
                    {!sourceLots.length && <p className="co-notice">No available lots in this branch's configured source locations. Complete the stock transfer and configure an enabled operation with a receiving, raw-meat, or processing location.</p>}
                  </>}
                  {sourceMode === "grn" && <>
                  <label>
                    Posted goods receipt
                    <Select required value={grnId} onChange={(e) => setGrnId(e.target.value)}>
                      <option value="">Select receipt</option>
                      {grnId && !receipts.some((r) => r.id === grnId) && (
                        <option value={grnId}>{receipt?.grnNumber ?? "Selected receipt"}</option>
                      )}
                      {receipts.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.grnNumber ?? r.grnNo} · {r.supplierName}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Source line
                    <Select required value={lineId} onChange={(e) => setLineId(e.target.value)}>
                      <option value="">Select received item</option>
                      {receipt?.lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.itemName} · {l.quantity} {l.uomCode ?? l.uomName}
                        </option>
                      ))}
                    </Select>
                  </label>
                  </>}
                  <label>
                    Processing date
                    <Input
                      required
                      type="datetime-local"
                      value={processingDate}
                      onChange={(e) => setProcessingDate(e.target.value)}
                    />
                  </label>
                  {sourceMode === "grn" && <label>
                    Operation
                    <Select required value={operationId} onChange={(e) => setOperationId(e.target.value)}>
                      <option value="">Select operation</option>
                      {operations
                        .filter((o) => !receipt?.branchId || o.branchId === receipt.branchId)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </Select>
                  </label>}
                  <label>
                    Cut template
                    <Select required value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                      <option value="">Select matching template</option>
                      {matching.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} · {t.totalExpectedYieldPercent}%
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                {sourceMode === "grn" && receipt && !operations.some(o => !receipt.branchId || o.branchId === receipt.branchId) &&
                  <p role="alert" className="co-notice">No operation matches this receipt's branch. To process at another branch, transfer the stock there first, then select Available branch stock. The original receipt remains in its receiving branch.</p>}
                {(sourceMode === "lot" ? sourceLot : line) && !matching.length && (
                  <p className="co-notice">
                    No active cut template matches this received item. Open Operations & templates in the navigation to
                    configure one before creating the order.
                  </p>
                )}
              </fieldset>
              {error && (
                <p role="alert" className="co-notice">
                  {error}
                </p>
              )}
              <footer className="co-toolbar">
                <span>One source lot per cutting order.</span>
                <Button className="co-primary" disabled={busy || !matching.some(t => t.id === templateId) || (sourceMode === "lot" ? !sourceLot || !Number.isFinite(Number(lotWeight)) || Number(lotWeight) <= 0 || Number(lotWeight) > sourceLot.availableWeightBase : !receipt || !lineId || !operations.some(o => o.id === operationId && (!receipt.branchId || o.branchId === receipt.branchId)))}>
                  {busy ? "Creating..." : "Create cutting order"}
                </Button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
