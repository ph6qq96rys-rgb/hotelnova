// src/features/telegram-miniapp/siv-request/TelegramSivRequestPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useI18n } from "../../../i18n";
import type { TelegramMiniAppAuthResult } from "../telegramMiniApp.types";
import { describeError, miniAppRequest, newClientRequestId } from "../telegramMiniAppClient";
import { notifyTelegram } from "../telegramWebApp";
import { TgCardHeader, TgField, fmtDate, fmtQty } from "../TelegramUi";

type SivLocationDto = {
  id: string;
  name: string;
  code?: string | null;
  branchId: string;
  isMainWarehouse?: boolean;
  isProductionCenter?: boolean;
  isConsumptionLocation?: boolean;
};

type SivContextDto = {
  companyId: string;
  branchId?: string | null;
  userId: string;
  employeeName?: string | null;
  fromLocations: SivLocationDto[];
  toLocations: SivLocationDto[];
  defaultFromLocationId?: string | null;
  defaultToLocationId?: string | null;
};

type CategoryDto = { categoryId: string; categoryName: string };

type AvailableItemDto = {
  itemId: string;
  itemCode?: string | null;
  itemName: string;
  barcode?: string | null;
  requestUomCode?: string | null;
  availableQty: number;
};

type FifoLotDto = {
  fifoLayerId: string;
  batchNo?: string | null;
  expiryDate?: string | null;
  uomCode?: string | null;
  availableQty: number;
  isExpired?: boolean;
};

type SivLine = {
  itemId: string;
  itemCode?: string | null;
  itemName: string;
  requestUomCode?: string | null;
  quantity: number;
  availableQty: number;
  fifoLayerId?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
};

type SubmitResponse = { success: boolean; message: string; sivId: string; requestNo?: string | null };

type Notice = { tone: "info" | "success" | "warning" | "error"; text: string } | null;

const BASE = "/telegram/miniapp/siv";
const MIN_QTY = 0.001;
const MAX_QTY = 999_999;
const MAX_LINES = 100;

type Props = {
  auth: TelegramMiniAppAuthResult;
  onSubmitted?: () => void;
};

/** New stock issue request (SIV): pick the route, add available items, submit for approval. */
export default function TelegramSivRequestPage({ auth, onSubmitted }: Props) {
  const { tx } = useI18n();

  const [booting, setBooting] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmitResponse | null>(null);

  const [context, setContext] = useState<SivContextDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [items, setItems] = useState<AvailableItemDto[]>([]);
  const [lots, setLots] = useState<FifoLotDto[]>([]);

  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedLotId, setSelectedLotId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<SivLine[]>([]);
  const [notice, setNotice] = useState<Notice>(null);

  // One id per document: a retried submission (lost response, double tap) returns the same SIV.
  const clientRequestId = useRef(newClientRequestId());

  const fromLocation = context?.fromLocations.find((x) => x.id === fromLocationId) ?? null;
  const toLocation = context?.toLocations.find((x) => x.id === toLocationId) ?? null;
  const selectedItem = items.find((item) => item.itemId === selectedItemId) ?? null;
  const selectedLot = lots.find((lot) => lot.fifoLayerId === selectedLotId) ?? null;
  const availableQty = selectedLot?.availableQty ?? selectedItem?.availableQty ?? 0;
  const qty = roundQty(Number(quantity));

  const totalQty = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const routeValid = Boolean(fromLocationId && toLocationId && fromLocationId !== toLocationId);
  const canAddLine = Boolean(selectedItem && Number.isFinite(qty) && qty >= MIN_QTY && qty <= MAX_QTY);
  const canSubmit = routeValid && lines.length > 0 && !submitting;

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const [ctx, cats] = await Promise.all([
          miniAppRequest<SivContextDto>(`${BASE}/context`, { signal: abort.signal }),
          miniAppRequest<CategoryDto[]>(`${BASE}/categories`, { signal: abort.signal }),
        ]);
        setContext(ctx);
        setCategories(cats ?? []);
        setFromLocationId(ctx.defaultFromLocationId ?? ctx.fromLocations[0]?.id ?? "");
        setToLocationId(ctx.defaultToLocationId ?? ctx.toLocations[0]?.id ?? "");

        if (!ctx.branchId) {
          setNotice({ tone: "error", text: tx("Your employee profile is not assigned to a branch.") });
        } else if (!ctx.fromLocations.length || !ctx.toLocations.length) {
          setNotice({
            tone: "warning",
            text: tx("No store locations are assigned to you. Ask an administrator to give you stock-location access."),
          });
        }
      } catch (error) {
        if (!abort.signal.aborted) setNotice({ tone: "error", text: describeError(error, tx("Unable to open the stock request.")) });
      } finally {
        if (!abort.signal.aborted) setBooting(false);
      }
    })();
    return () => abort.abort();
  }, [tx]);

  useEffect(() => {
    setItems([]);
    setSelectedItemId("");
    if (!routeValid) return;

    const abort = new AbortController();
    setLoadingItems(true);
    miniAppRequest<AvailableItemDto[]>(`${BASE}/available-items`, {
      query: { fromLocationId, toLocationId, categoryId: categoryId || undefined },
      signal: abort.signal,
    })
      .then((rows) => setItems(rows ?? []))
      .catch((error) => {
        if (!abort.signal.aborted) setNotice({ tone: "error", text: describeError(error, tx("Unable to load available items.")) });
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoadingItems(false);
      });
    return () => abort.abort();
  }, [routeValid, fromLocationId, toLocationId, categoryId, tx]);

  useEffect(() => {
    setLots([]);
    setSelectedLotId("");
    if (!fromLocationId || !selectedItemId) return;

    const abort = new AbortController();
    setLoadingLots(true);
    miniAppRequest<FifoLotDto[]>(`${BASE}/fifo-lots`, {
      query: { fromLocationId, itemId: selectedItemId },
      signal: abort.signal,
    })
      .then((rows) => {
        const list = rows ?? [];
        setLots(list);
        const firstUsable = list.find((lot) => !lot.isExpired && lot.availableQty > 0);
        if (firstUsable) setSelectedLotId(firstUsable.fifoLayerId);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setNotice({ tone: "error", text: describeError(error, tx("Unable to load batches.")) });
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoadingLots(false);
      });
    return () => abort.abort();
  }, [fromLocationId, selectedItemId, tx]);

  const changeRoute = useCallback((which: "from" | "to", id: string) => {
    if (which === "from") setFromLocationId(id);
    else setToLocationId(id);
    setLines([]);
    setNotice(null);
  }, []);

  const addLine = useCallback(() => {
    if (!selectedItem) return setNotice({ tone: "info", text: tx("Select an available item first.") });
    if (!Number.isFinite(qty) || qty < MIN_QTY) return setNotice({ tone: "error", text: tx("Quantity must be greater than zero.") });
    if (lots.length > 0 && !selectedLot) return setNotice({ tone: "error", text: tx("Select a batch first.") });
    if (selectedLot?.isExpired) return setNotice({ tone: "error", text: tx("This batch has expired. Choose another batch.") });

    const lotId = selectedLot?.fifoLayerId ?? null;
    const sameLine = (line: SivLine) => line.itemId === selectedItem.itemId && (line.fifoLayerId ?? null) === lotId;
    const existing = lines.find(sameLine);
    const nextQty = roundQty((existing?.quantity ?? 0) + qty);
    const unit = selectedItem.requestUomCode ?? "";

    if (nextQty > availableQty) {
      return setNotice({
        tone: "error",
        text: tx("Only {qty} {unit} is available.", { qty: fmtQty(availableQty), unit }),
      });
    }
    if (!existing && lines.length >= MAX_LINES) {
      return setNotice({ tone: "error", text: tx("A request can have at most {n} lines.", { n: MAX_LINES }) });
    }

    setLines((prev) =>
      existing
        ? prev.map((line) => (sameLine(line) ? { ...line, quantity: nextQty } : line))
        : [
            ...prev,
            {
              itemId: selectedItem.itemId,
              itemCode: selectedItem.itemCode,
              itemName: selectedItem.itemName,
              requestUomCode: selectedItem.requestUomCode,
              quantity: qty,
              availableQty,
              fifoLayerId: lotId,
              batchNo: selectedLot?.batchNo ?? null,
              expiryDate: selectedLot?.expiryDate ?? null,
            },
          ],
    );
    setSelectedItemId("");
    setQuantity("1");
    setNotice(null);
  }, [availableQty, lines, lots.length, qty, selectedItem, selectedLot, tx]);

  const removeLine = useCallback((target: SivLine) => {
    setLines((prev) =>
      prev.filter((line) => !(line.itemId === target.itemId && (line.fifoLayerId ?? null) === (target.fifoLayerId ?? null))),
    );
  }, []);

  const submit = useCallback(async () => {
    if (!routeValid) return setNotice({ tone: "error", text: tx("Choose different From and To locations.") });
    if (!lines.length) return setNotice({ tone: "info", text: tx("Add at least one item.") });

    setSubmitting(true);
    setNotice(null);
    try {
      const response = await miniAppRequest<SubmitResponse>(`${BASE}/requests`, {
        body: {
          clientRequestId: clientRequestId.current,
          fromLocationId,
          toLocationId,
          remarks: remarks.trim() || null,
          lines: lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            fifoLayerId: line.fifoLayerId ?? null,
          })),
        },
      });
      notifyTelegram("success");
      setSubmitted(response);
      setLines([]);
      setRemarks("");
      setSelectedItemId("");
      setQuantity("1");
      clientRequestId.current = newClientRequestId();
    } catch (error) {
      // Keep the same id so trying again cannot create a second request.
      notifyTelegram("error");
      setNotice({ tone: "error", text: describeError(error, tx("Unable to submit the stock request.")) });
    } finally {
      setSubmitting(false);
    }
  }, [fromLocationId, lines, remarks, routeValid, toLocationId, tx]);

  if (!auth.userId) {
    return (
      <section className="tg-card">
        <EmptyState
          title={tx("Stock requests are unavailable")}
          detail={tx("Your employee profile has no ERP user. Ask an administrator to link one.")}
        />
      </section>
    );
  }

  if (booting) return <StateMessage tone="loading">{tx("Loading your store locations...")}</StateMessage>;

  if (submitted) {
    return (
      <section className="tg-card tg-result">
        <div className="tg-result__head">
          <div className="tg-result__icon" aria-hidden="true">
            <CheckCircle2 size={22} />
          </div>
          <TgCardHeader
            title={submitted.requestNo ? tx("{no} submitted", { no: submitted.requestNo }) : tx("Request submitted")}
            hint={submitted.message || tx("Your approver has been notified.")}
          />
        </div>
        <div className="tg-actions tg-actions--row">
          <Button type="button" variant="outline" onClick={() => setSubmitted(null)}>
            {tx("New request")}
          </Button>
          <Button type="button" onClick={onSubmitted}>
            {tx("My requests")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="tg-mini-page">
      {notice ? <StateMessage tone={notice.tone}>{notice.text}</StateMessage> : null}

      <div className="tg-steps" aria-label={tx("Progress")}>
        <Step done={routeValid} active label={tx("Locations")} />
        <Step done={lines.length > 0} active={routeValid} label={tx("Items")} />
        <Step done={false} active={lines.length > 0} label={tx("Submit")} />
      </div>

      <section className="tg-card">
        <TgCardHeader
          title={tx("Route")}
          hint={context?.employeeName ? tx("Requester: {name}", { name: context.employeeName }) : undefined}
        />

        <TgField label={tx("From (store)")} required>
          <Select value={fromLocationId} onChange={(e) => changeRoute("from", e.target.value)}>
            <option value="">{tx("Select issue source")}</option>
            {context?.fromLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabel(location)}
              </option>
            ))}
          </Select>
        </TgField>

        <TgField label={tx("To (your location)")} required>
          <Select value={toLocationId} onChange={(e) => changeRoute("to", e.target.value)}>
            <option value="">{tx("Select requesting location")}</option>
            {context?.toLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabel(location)}
              </option>
            ))}
          </Select>
        </TgField>

        {fromLocation && toLocation ? (
          fromLocation.id === toLocation.id ? (
            <StateMessage tone="error">{tx("From and To locations cannot be the same.")}</StateMessage>
          ) : (
            <div className="tg-route">
              <span>{fromLocation.name}</span>
              <ArrowRight size={16} aria-hidden="true" />
              <span>{toLocation.name}</span>
            </div>
          )
        ) : null}
      </section>

      <section className="tg-card">
        <TgCardHeader title={tx("Add items")} hint={tx("Only items with stock at the store are listed.")} />

        <TgField label={tx("Category")}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!routeValid}>
            <option value="">{tx("All categories")}</option>
            {categories.map((category) => (
              <option key={category.categoryId} value={category.categoryId}>
                {category.categoryName}
              </option>
            ))}
          </Select>
        </TgField>

        <TgField label={tx("Item")} required>
          <Select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} disabled={!routeValid || loadingItems}>
            <option value="">
              {!routeValid
                ? tx("Select From and To locations first")
                : loadingItems
                  ? tx("Loading available items...")
                  : items.length
                    ? tx("Select item")
                    : tx("No available items")}
            </option>
            {items.map((item) => (
              <option key={item.itemId} value={item.itemId}>
                {item.itemCode ? `${item.itemCode} - ` : ""}
                {item.itemName} ({fmtQty(item.availableQty)} {item.requestUomCode ?? ""})
              </option>
            ))}
          </Select>
        </TgField>

        {selectedItem && (lots.length > 0 || loadingLots) ? (
          <TgField label={tx("Batch")} required help={tx("The oldest usable batch is selected first.")}>
            <Select value={selectedLotId} onChange={(e) => setSelectedLotId(e.target.value)} disabled={loadingLots}>
              <option value="">{loadingLots ? tx("Loading batches...") : tx("Select batch")}</option>
              {lots.map((lot) => (
                <option key={lot.fifoLayerId} value={lot.fifoLayerId} disabled={lot.isExpired}>
                  {lotLabel(lot, tx)}
                </option>
              ))}
            </Select>
          </TgField>
        ) : null}

        {selectedItem ? (
          <div className="tg-meta">
            <div>
              <span>{tx("Available")}</span>
              <strong>
                {fmtQty(availableQty)} {selectedItem.requestUomCode ?? ""}
              </strong>
            </div>
            <div>
              <span>{tx("Code")}</span>
              <strong>{selectedItem.itemCode || selectedItem.barcode || "-"}</strong>
            </div>
          </div>
        ) : null}

        <TgField
          label={selectedItem?.requestUomCode ? tx("Quantity ({unit})", { unit: selectedItem.requestUomCode }) : tx("Quantity")}
          required
        >
          <Input
            type="number"
            inputMode="decimal"
            min={MIN_QTY}
            max={availableQty || MAX_QTY}
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={!selectedItem}
          />
        </TgField>

        <Button type="button" variant="outline" className="tg-block" onClick={addLine} disabled={!canAddLine}>
          {tx("Add Item")}
        </Button>
      </section>

      <section className="tg-card">
        <TgCardHeader title={tx("Request Lines")} hint={tx("{count} line(s)", { count: lines.length })} />

        {lines.length === 0 ? (
          <p className="tg-muted">{tx("No items added yet.")}</p>
        ) : (
          <div className="tg-list">
            {lines.map((line) => (
              <div key={`${line.itemId}:${line.fifoLayerId ?? ""}`} className="tg-row">
                <div className="tg-row__body">
                  <strong>{line.itemName}</strong>
                  <small>
                    {fmtQty(line.quantity)} {line.requestUomCode ?? ""}
                    {line.batchNo ? ` | ${tx("Batch")} ${line.batchNo}` : ""}
                    {line.expiryDate ? ` | ${tx("Expires")} ${fmtDate(line.expiryDate)}` : ""}
                  </small>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line)} aria-label={tx("Remove {item}", { item: line.itemName })}>
                  <Trash2 size={18} aria-hidden="true" />
                </Button>
              </div>
            ))}
            <div className="tg-total">
              <span>{tx("Total requested quantity")}</span>
              <strong>{fmtQty(totalQty)}</strong>
            </div>
          </div>
        )}

        <TgField label={tx("Remarks")}>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={tx("Optional notes for approver")}
            maxLength={500}
          />
        </TgField>
      </section>

      <Button type="button" size="lg" className="tg-block" onClick={() => void submit()} disabled={!canSubmit}>
        {submitting ? tx("Submitting...") : tx("Submit for Approval")}
      </Button>
    </section>
  );
}

function Step({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span className={`tg-step${done ? " tg-step--done" : active ? " tg-step--active" : ""}`}>
      {done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
      {label}
    </span>
  );
}

function locationLabel(location: SivLocationDto): string {
  return location.code ? `${location.name} (${location.code})` : location.name;
}

function lotLabel(lot: FifoLotDto, tx: (text: string, params?: Record<string, string | number>) => string): string {
  const batch = lot.batchNo?.trim() || tx("No batch");
  const expiry = lot.expiryDate ? ` | ${tx("Expires")} ${fmtDate(lot.expiryDate)}` : "";
  const expired = lot.isExpired ? ` | ${tx("expired")}` : "";
  return `${batch}${expiry} | ${fmtQty(lot.availableQty)} ${lot.uomCode ?? ""}${expired}`.trim();
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}
