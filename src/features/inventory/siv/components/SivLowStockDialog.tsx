import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Checkbox } from "../../../../components/ui/checkbox";
import { StateMessage, EmptyState } from "../../../../components/ui/Feedback";
import { useDialogFocus } from "../../../../components/ui/useDialogFocus";
import { useI18n } from "../../../../i18n";
import {
  FIFO_SOURCE_ID,
  sivApi,
  type SivLowStockGenerateResult,
  type SivLowStockLineDto,
  type SivLowStockResultDto,
  type SivSourceAllocation,
  type SivSourceOption,
  type LocationOption,
} from "../api/sivApi";
import { fmtDate, fmtQty, getApiError } from "../types/sivTypes";
import "./sivLowStock.css";

type Props = {
  open: boolean;
  companyId: string;
  branchId: string;
  onClose: () => void;
  /** Opens a created draft. */
  onCreated: (sivId: string) => void;
  /** Opens the replenishment rules page. */
  onManageRules?: () => void;
};

type Row = { key: string; toLocationId: string; line: SivLowStockLineDto; selected: boolean; qty: string };

const HISTORY_OPTIONS = [14, 30, 60, 90];

/** Source select value for FIFO sourcing (each line from the store whose stock should leave first). */
const FIFO = "fifo";

/** How much of the line's unit a store can supply: whole packs for a pack unit, else two decimals (as the server). */
function capacity(freeBase: number, factor: number) {
  if (freeBase <= 0) return 0;
  const f = factor > 0 ? factor : 1;
  const units = Math.round((freeBase / f) * 1e6) / 1e6;
  return f > 1 ? Math.floor(units) : Math.floor(units * 100) / 100;
}

/** Same split as the server: fill stores in FIFO order; what no store holds goes to the first store. */
function splitAcrossStores(qty: number, factor: number, options: SivSourceOption[]): SivSourceAllocation[] {
  if (!(qty > 0) || options.length === 0) return [];
  const parts: SivSourceAllocation[] = [];
  let remaining = qty;
  for (const option of options) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, capacity(option.freeBaseQty, factor));
    if (take <= 0) continue;
    parts.push({ locationId: option.locationId, locationName: option.locationName, qty: take, baseQty: take * factor });
    remaining = Math.round((remaining - take) * 1e6) / 1e6;
  }
  if (remaining > 0) {
    if (parts.length === 0) {
      parts.push({ locationId: options[0].locationId, locationName: options[0].locationName, qty: remaining, baseQty: remaining * factor, short: true });
    } else {
      parts[0] = { ...parts[0], qty: parts[0].qty + remaining, baseQty: (parts[0].qty + remaining) * factor, short: true };
    }
  }
  return parts;
}

type RawLocation = Partial<LocationOption> & Record<string, unknown>;

/** Same normalisation as the SIV editor: the lookup returns id/name or locationId/locationName. */
function toLocations(rows: unknown[]): LocationOption[] {
  const seen = new Set<string>();
  return (rows as RawLocation[])
    .map((x) => ({
      id: String(x.id ?? x.locationId ?? ""),
      name: String(x.name ?? x.locationName ?? x.code ?? ""),
      code: x.code == null ? null : String(x.code),
      locationType: x.locationType == null ? null : String(x.locationType),
    }))
    .filter((x) => {
      if (!x.id || !x.name || seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
}

function isWarehouse(location: LocationOption) {
  return /warehouse/i.test(location.locationType ?? "") || /warehouse/i.test(location.name);
}

/** Idempotency key for one reviewed proposal; reused when the same request is retried. */
function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Finds items running out at one or more branch stock locations (e.g. kitchen and
 * bar) and turns the reviewed lists into SIV drafts, one per location, in a single
 * retry-safe request. The usual submit / approve / issue / post flow follows;
 * nothing is reserved or posted here.
 */
export function SivLowStockDialog({ open, companyId, branchId, onClose, onCreated, onManageRules }: Props) {
  const { tx } = useI18n();
  const titleId = useId();

  const [destinations, setDestinations] = useState<LocationOption[]>([]);
  const [sources, setSources] = useState<LocationOption[]>([]);
  const [selectedTo, setSelectedTo] = useState<string[]>([]);
  const [fromLocationId, setFromLocationId] = useState(FIFO);
  const [coverageDays, setCoverageDays] = useState("7");
  const [lookbackDays, setLookbackDays] = useState(30);

  const [loadingLocations, setLoadingLocations] = useState(false);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SivLowStockResultDto[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [requestId, setRequestId] = useState("");
  const [generated, setGenerated] = useState<SivLowStockGenerateResult | null>(null);

  const busy = checking || creating;
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  useDialogFocus(open, busy, close);

  function resetResults() {
    setResults([]);
    setRows([]);
    setGenerated(null);
    setRequestId("");
  }

  // Same branch lookups as the SIV editor: issuing locations and receiving locations.
  useEffect(() => {
    if (!open || !companyId || !branchId) return;
    let cancelled = false;
    setLoadingLocations(true);
    setError("");
    resetResults();

    Promise.all([
      sivApi.getConsumptionLocations(companyId, branchId),
      sivApi.getIssueLocations(companyId, branchId),
    ])
      .then(([toRows, fromRows]) => {
        if (cancelled) return;
        const to = toLocations(toRows);
        const from = toLocations(fromRows);
        setDestinations(to);
        setSources(from);
        // Default: every receiving location that is not a warehouse (kitchen, bar, ...).
        const consuming = to.filter((x) => !isWarehouse(x)).map((x) => x.id);
        const toIds = to.length === 1 ? [to[0].id] : consuming;
        setSelectedTo(toIds);
        // FIFO sourcing by default: each line comes from the store whose stock should leave first.
        setFromLocationId(FIFO);
      })
      .catch((e) => {
        if (!cancelled) setError(getApiError(e, tx("Unable to load stock locations.")));
      })
      .finally(() => {
        if (!cancelled) setLoadingLocations(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId, branchId]);

  const sourceOptions = useMemo(() => sources.filter((x) => !selectedTo.includes(x.id)), [sources, selectedTo]);
  const nameOf = useCallback(
    (id: string) => destinations.find((x) => x.id === id)?.name ?? results.find((r) => r.toLocationId === id)?.toLocationName ?? "",
    [destinations, results],
  );

  const coverage = Number(coverageDays);
  const coverageValid = Number.isInteger(coverage) && coverage >= 1 && coverage <= 60;
  const fifo = fromLocationId === FIFO;
  const canCheck =
    selectedTo.length > 0 && !!fromLocationId && (fifo || !selectedTo.includes(fromLocationId)) && coverageValid && !busy;

  function toggleDestination(id: string, checked: boolean) {
    setSelectedTo((current) => (checked ? [...current, id] : current.filter((x) => x !== id)));
    if (checked && id === fromLocationId) setFromLocationId(FIFO);
    resetResults();
  }

  async function check() {
    if (!canCheck) return;
    setChecking(true);
    setError("");
    setGenerated(null);
    try {
      const data = await Promise.all(
        selectedTo.map((toLocationId) =>
          sivApi.getLowStock(companyId, branchId, {
            fromLocationId: fifo ? undefined : fromLocationId,
            toLocationId,
            lookbackDays,
            coverageDays: coverage,
          }),
        ),
      );
      setResults(data);
      setRows(
        data.flatMap((result) =>
          result.lines.map((line) => ({
            key: `${result.toLocationId}|${line.itemId}`,
            toLocationId: result.toLocationId,
            line,
            selected: line.suggestedQty > 0 && !line.warnings.includes("SourceOutOfStock"),
            qty: line.suggestedQty > 0 ? String(line.suggestedQty) : "",
          })),
        ),
      );
      // A new review gets a new request id; retries of the same review reuse it.
      setRequestId(newRequestId());
    } catch (e) {
      resetResults();
      setError(getApiError(e, tx("Unable to check low stock.")));
    } finally {
      setChecking(false);
    }
  }

  const selectedRows = rows.filter((r) => r.selected);
  const invalidQty = selectedRows.some((r) => !(Number(r.qty) > 0));
  const selectedDestinations = [...new Set(selectedRows.map((r) => r.toLocationId))];
  const allocationsOf = (row: Row) =>
    fifo ? splitAcrossStores(Number(row.qty), row.line.toBaseFactor, row.line.sourceOptions ?? []) : [];
  const draftCount = fifo
    ? new Set(selectedRows.flatMap((r) => allocationsOf(r).map((a) => `${r.toLocationId}|${a.locationId}`))).size
    : selectedDestinations.length;
  const createdCount = generated?.drafts.filter((d) => d.sivId).length ?? 0;
  const failedDrafts = generated?.drafts.filter((d) => !d.sivId) ?? [];
  const locked = !!generated; // once a request is sent, its lines are fixed so a retry repeats it exactly

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function create() {
    if (results.length === 0 || selectedRows.length === 0 || invalidQty || busy || !requestId) return;
    setCreating(true);
    setError("");
    try {
      const response = await sivApi.generateFromLowStock(companyId, branchId, {
        clientRequestId: requestId,
        fromLocationId: fifo ? FIFO_SOURCE_ID : fromLocationId,
        lookbackDays,
        coverageDays: coverage,
        destinations: selectedDestinations.map((toLocationId) => ({
          toLocationId,
          lines: selectedRows
            .filter((r) => r.toLocationId === toLocationId)
            .map((r) => ({ itemId: r.line.itemId, qty: Number(r.qty) })),
        })),
      });
      setGenerated(response);
      const created = response.drafts.filter((d) => d.sivId);
      if (response.status === "Completed" && created.length === 1) onCreated(created[0].sivId!);
    } catch (e) {
      // The request id is kept: pressing the button again safely retries the same request.
      setError(getApiError(e, tx("Failed to create SIV draft.")));
    } finally {
      setCreating(false);
    }
  }

  function linkText(kind: string | null | undefined) {
    switch (kind) {
      case "Ingredient":
        return tx("Recipe ingredient");
      case "SemiFinished":
        return tx("Semi-finished");
      case "NestedIngredient":
        return tx("For semi-finished made here");
      default:
        return null;
    }
  }

  function ruleTitle(line: SivLowStockLineDto) {
    const sources = Object.entries(line.ruleSources ?? {});
    if (sources.length === 0) return tx("No rule applies; request defaults are used.");
    return sources.map(([field, scope]) => `${field}: ${scope}`).join("\n");
  }

  function warningText(code: string) {
    switch (code) {
      case "SourceOutOfStock":
        return tx("Source has no free stock");
      case "SourceShort":
        return tx("Source has less than suggested");
      case "NoRecentUsage":
        return tx("No recent usage; below reorder level");
      case "LimitedHistory":
        return tx("Few days with stock to measure usage; estimate held to a 7-day minimum");
      case "CappedByMax":
        return tx("Capped at the maximum stock rule");
      case "NoDemandData":
        return tx("No usage or reorder level; enter a quantity");
      case "SplitAcrossSources":
        return tx("Requested from more than one store (FIFO)");
      case "OlderStockElsewhere":
        return tx("Another store holds older or sooner-expiring stock; use FIFO sourcing");
      case "StockExpiringSoon":
        return tx("Some stock here expires within the days to cover");
      default:
        return code;
    }
  }

  /** Tooltip: every store that holds the item, in FIFO order, with its free stock and dates. */
  function sourceTitle(line: SivLowStockLineDto) {
    const options = line.sourceOptions ?? [];
    if (options.length === 0) return tx("No store holds free stock of this item.");
    return options
      .map((o, i) =>
        [
          `${i + 1}. ${o.locationName}: ${fmtQty(o.freeBaseQty)} ${line.baseUomCode}`,
          o.earliestExpiry ? `${tx("expires")} ${fmtDate(o.earliestExpiry)}` : null,
          o.oldestReceivedAtUtc ? `${tx("oldest received")} ${fmtDate(o.oldestReceivedAtUtc)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      )
      .join("\n");
  }

  if (!open) return null;

  return (
    <div className="ui-dialog-backdrop">
      <div className="ui-dialog siv-lowstock" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ui-dialog-header">
          <h3 id={titleId}>{tx("Generate SIV from low stock")}</h3>
          <p className="siv-lowstock__intro">
            {tx("Finds items running out at your kitchen, bar and other locations and proposes what to request. With FIFO sourcing each item is requested from the store whose stock should leave first (earliest expiry, then oldest receipt), split across stores when needed. You review the lists before drafts are created, one per store and location.")}
            {onManageRules && (
              <>
                {" "}
                <Button type="button" variant="link" size="sm" onClick={onManageRules} disabled={busy}>
                  {tx("Replenishment rules")}
                </Button>
              </>
            )}
          </p>
        </div>

        <div className="ui-dialog-body siv-lowstock__body">
          <fieldset className="siv-lowstock__destinations" disabled={loadingLocations || busy}>
            <legend>{tx("Locations running low")}</legend>
            {destinations.map((x) => (
              <label key={x.id} className="siv-lowstock__chip">
                <Checkbox
                  checked={selectedTo.includes(x.id)}
                  onChange={(e) => toggleDestination(x.id, e.target.checked)}
                />
                <span>{x.name}</span>
              </label>
            ))}
          </fieldset>

          <div className="siv-lowstock__controls">
            <label className="ui-field">
              <span>{tx("Request from")}</span>
              <Select
                value={fromLocationId}
                disabled={loadingLocations || busy}
                onChange={(e) => {
                  setFromLocationId(e.target.value);
                  resetResults();
                }}
              >
                <option value={FIFO}>{tx("FIFO across stores (recommended)")}</option>
                {sourceOptions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="ui-field">
              <span>{tx("Days to cover")}</span>
              <Input
                type="number"
                min={1}
                max={60}
                step={1}
                inputMode="numeric"
                value={coverageDays}
                disabled={busy}
                onChange={(e) => {
                  setCoverageDays(e.target.value);
                  resetResults();
                }}
                aria-invalid={!coverageValid || undefined}
              />
            </label>

            <label className="ui-field">
              <span>{tx("Usage history")}</span>
              <Select
                value={String(lookbackDays)}
                disabled={busy}
                onChange={(e) => {
                  setLookbackDays(Number(e.target.value));
                  resetResults();
                }}
              >
                {HISTORY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} {tx("days")}
                  </option>
                ))}
              </Select>
            </label>

            <div className="siv-lowstock__check">
              <Button type="button" onClick={check} disabled={!canCheck}>
                {checking ? tx("Checking...") : tx("Check stock")}
              </Button>
            </div>
          </div>

          {!coverageValid && (
            <StateMessage tone="warning">{tx("Days to cover must be a whole number from 1 to 60.")}</StateMessage>
          )}
          {loadingLocations && <StateMessage tone="loading">{tx("Loading locations...")}</StateMessage>}
          {!loadingLocations && destinations.length === 0 && !error && (
            <StateMessage tone="warning">{tx("You have no stock location in this branch that can receive stock.")}</StateMessage>
          )}
          {error && <StateMessage tone="error">{error}</StateMessage>}

          {generated && (
            <div className="siv-lowstock__generated">
              <StateMessage tone={failedDrafts.length === 0 ? "success" : "warning"}>
                {generated.replayed ? tx("These drafts were already created for this request:") : tx("Drafts created:")}{" "}
                {createdCount} / {generated.drafts.length} · {generated.number}
              </StateMessage>
              <ul>
                {generated.drafts.map((d) => (
                  <li key={`${d.toLocationId}|${d.fromLocationId ?? ""}`}>
                    <strong>{d.toLocationName}</strong>
                    {d.fromLocationName ? <> ← {d.fromLocationName}</> : null}
                    {d.sivId ? (
                      <>
                        {" "}
                        {d.sivNo} · {d.lineCount} {tx("items")}{" "}
                        <Button type="button" size="sm" variant="outline" onClick={() => onCreated(d.sivId!)}>
                          {tx("Open draft")}
                        </Button>
                      </>
                    ) : (
                      <span className="siv-lowstock__warn"> {d.error ?? tx("Not created")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.map((result) => {
            const destinationRows = rows.filter((r) => r.toLocationId === result.toLocationId);
            const allSelected = destinationRows.length > 0 && destinationRows.every((r) => r.selected);
            return (
              <section key={result.toLocationId} className="siv-lowstock__destination">
                <h4>{result.toLocationName || nameOf(result.toLocationId)}</h4>
                  <p className="siv-lowstock__meta">
                    {tx("Usage")} {fmtDate(result.windowStartUtc)} – {fmtDate(result.windowEndUtc)} · {result.itemsEvaluated}{" "}
                    {tx("items checked")}
                    {(result.closedDays ?? 0) > 0 && (
                      <>
                        {" "}
                        · {result.closedDays} {tx("days without sales left out")}
                      </>
                    )}
                    {(result.menuItemsConsidered ?? 0) > 0 && (
                      <>
                        {" "}
                        · {result.menuItemsConsidered} {tx("menu items' recipes included")}
                      </>
                    )}
                    {(result.itemsProducedHere ?? 0) > 0 && (
                      <>
                        {" "}
                        · {result.itemsProducedHere} {tx("semi-finished items made here (ingredients requested instead)")}
                      </>
                    )}
                    {(result.rulesConsidered ?? 0) > 0 && (
                      <>
                        {" "}
                        · {result.rulesConsidered} {tx("replenishment rules active")}
                      </>
                    )}
                    {(result.itemsExcludedByRule ?? 0) > 0 && (
                      <>
                        {" "}
                        · {result.itemsExcludedByRule} {tx("excluded by rule")}
                      </>
                    )}
                    {" "}· {result.itemsCovered ?? 0} {tx("covered")}
                    {(result.itemsWithoutDemand ?? 0) > 0 && (
                      <>
                        {" "}
                        · {result.itemsWithoutDemand} {tx("in stock with no usage or reorder level")}
                      </>
                    )}
                    {result.openSivCount > 0 && (
                      <>
                        {" "}
                        · {result.openSivCount} {tx("open SIVs to this location are already counted as on the way")}
                      </>
                    )}
                  </p>

                  {(result.issues?.length ?? 0) > 0 && (
                    <details className="siv-lowstock__issues">
                      <summary>
                        {result.issues!.length} {tx("recipe problems affect these suggestions")}
                      </summary>
                      <ul>
                        {result.issues!.map((issue, index) => (
                          <li key={`${issue.code}-${index}`}>{issue.message}</li>
                        ))}
                      </ul>
                    </details>
                  )}


                {destinationRows.length === 0 ? (
                  <EmptyState
                    title={tx("Nothing is running low")}
                    detail={
                      (result.itemsWithoutDemand ?? 0) > 0 && (result.itemsCovered ?? 0) === 0
                        ? tx("No item here has usage in the selected history or a reorder level, so nothing can be sized. Set reorder levels on the items or choose a longer usage history.")
                        : tx("Every item at this location covers the selected days, counting open SIVs.")
                    }
                  />
                ) : (
                  <div className="siv-lowstock__table-wrap">
                    <table className="siv-lowstock__table">
                      <thead>
                        <tr>
                          <th>
                            <Checkbox
                              aria-label={tx("Select all")}
                              checked={allSelected}
                              disabled={busy || locked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setRows((current) =>
                                  current.map((r) => (r.toLocationId === result.toLocationId ? { ...r, selected: checked } : r)),
                                );
                              }}
                            />
                          </th>
                          <th>{tx("Item")}</th>
                          <th className="num">{tx("On hand")}</th>
                          <th className="num">{tx("On the way")}</th>
                          <th className="num">{tx("Daily use")}</th>
                          <th className="num">{tx("Days left")}</th>
                          <th className="num">{tx("Target")}</th>
                          <th>{fifo ? tx("From (FIFO)") : tx("Free at source")}</th>
                          <th>{tx("Request")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {destinationRows.map((row) => {
                          const { line, selected, qty } = row;
                          const unit = line.baseUomCode;
                          const qtyInvalid = selected && !(Number(qty) > 0);
                          return (
                            <tr key={row.key} className={selected ? undefined : "is-off"}>
                                <td>
                                  <Checkbox
                                    aria-label={`${tx("Include")} ${line.itemName}`}
                                    checked={selected}
                                    disabled={busy || locked}
                                    onChange={(e) => update(row.key, { selected: e.target.checked })}
                                  />
                                </td>
                                <td>
                                  <div className="siv-lowstock__item">
                                    <strong>{line.itemName}</strong>
                                    <span>
                                      {line.itemCode || "-"}
                                      <span
                                        className={
                                          "siv-lowstock__status " +
                                          (line.status === "OutOfStock" ? "is-out" : "is-low")
                                        }
                                      >
                                        {line.status === "OutOfStock" ? tx("Out of stock") : tx("Low")}
                                      </span>
                                    </span>
                                    {linkText(line.linkKind) && (
                                      <small className="siv-lowstock__link" title={(line.linkedVia ?? []).join("\n")}>
                                        {linkText(line.linkKind)}
                                        {(line.linkedVia?.length ?? 0) > 0 && <> · {line.linkedVia!.join(", ")}</>}
                                      </small>
                                    )}
                                    <small className="siv-lowstock__params" title={ruleTitle(line)}>
                                      {tx("Cover")} {line.coverageDays ?? result.coverageDays} {tx("d")}
                                      {(line.leadTimeDays ?? 0) > 0 && <> + {tx("lead")} {line.leadTimeDays} {tx("d")}</>}
                                      {(line.safetyStockBaseQty ?? 0) > 0 && <> · {tx("safety")} {fmtQty(line.safetyStockBaseQty)} {line.baseUomCode}</>}
                                      {(line.reservedBaseQty ?? 0) > 0 && <> · {tx("reserved")} {fmtQty(line.reservedBaseQty)} {line.baseUomCode}</>}
                                      {Object.keys(line.ruleSources ?? {}).length > 0 && <> · {tx("rule")}</>}
                                    </small>
                                    {line.warnings.length > 0 && (
                                      <small className="siv-lowstock__warn">
                                        {line.warnings.map(warningText).join(" · ")}
                                      </small>
                                    )}
                                  </div>
                                </td>
                                <td className="num">{fmtQty(line.onHandBaseQty)} {unit}</td>
                                <td className="num">{line.inboundBaseQty > 0 ? `${fmtQty(line.inboundBaseQty)} ${unit}` : "-"}</td>
                                <td
                                  className="num"
                                  title={[
                                    `${tx("recorded usage")}: ${fmtQty(line.ledgerUsageBaseQty)} ${unit}`,
                                    `${tx("Estimated from menu sales × recipes")}: ${fmtQty(line.recipeEstimateBaseQty)} ${unit}`,
                                    `${tx("Days open")}: ${line.openDays ?? "-"} · ${tx("days out of stock")}: ${line.stockoutDays ?? 0} · ${tx("days measured")}: ${line.observedDays ?? "-"}`,
                                  ].join("\n")}
                                >
                                  {line.dailyUsageBaseQty > 0 ? `${fmtQty(line.dailyUsageBaseQty)} ${unit}` : "-"}
                                  {line.usageBasis === "Recipe" && <span className="siv-lowstock__basis">{tx("recipe")}</span>}
                                </td>
                                <td className="num">{line.daysOfCover == null ? "-" : fmtQty(line.daysOfCover)}</td>
                                <td className="num">{fmtQty(line.targetBaseQty)} {unit}</td>
                                <td className={fifo ? undefined : "num"} title={sourceTitle(line)}>
                                  {fifo ? (
                                    allocationsOf(row).length === 0 ? (
                                      <span className="siv-lowstock__warn">{tx("No store holds it")}</span>
                                    ) : (
                                      <span className="siv-lowstock__sources">
                                        {allocationsOf(row).map((a) => (
                                          <span key={a.locationId} className={a.short ? "siv-lowstock__warn" : undefined}>
                                            {a.locationName} {fmtQty(a.qty)} {line.uomCode}
                                          </span>
                                        ))}
                                      </span>
                                    )
                                  ) : (
                                    <>{fmtQty(line.sourceFreeBaseQty)} {unit}</>
                                  )}
                                </td>
                                <td>
                                  <div className="siv-lowstock__qty">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="any"
                                      inputMode="decimal"
                                      value={qty}
                                      disabled={!selected || busy || locked}
                                      aria-label={`${tx("Request quantity for")} ${line.itemName}`}
                                      aria-invalid={qtyInvalid || undefined}
                                      onChange={(e) => update(row.key, { qty: e.target.value })}
                                    />
                                    <span>{line.uomCode}</span>
                                  </div>
                                </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {result.truncated && (
                  <StateMessage tone="info">{tx("Showing the most urgent 300 items. Create this draft, then check again for the rest.")}</StateMessage>
                )}
              </section>
            );
          })}

          {invalidQty && <StateMessage tone="warning">{tx("Enter a quantity above zero for every selected item.")}</StateMessage>}
        </div>

        <div className="ui-dialog-actions">
          {rows.length > 0 && (
            <span className="siv-lowstock__count">
              {selectedRows.length} / {rows.length} {tx("items selected")} · {draftCount}{" "}
              {tx("drafts")}
            </span>
          )}
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            {generated && failedDrafts.length === 0 ? tx("Close") : tx("Cancel")}
          </Button>
          {!(generated && failedDrafts.length === 0) && (
            <Button
              type="button"
              onClick={create}
              disabled={results.length === 0 || selectedRows.length === 0 || invalidQty || busy}
            >
              {creating
                ? tx("Creating...")
                : generated || error
                  ? tx("Retry")
                  : draftCount > 1
                    ? tx("Create SIV drafts")
                    : tx("Create SIV draft")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
