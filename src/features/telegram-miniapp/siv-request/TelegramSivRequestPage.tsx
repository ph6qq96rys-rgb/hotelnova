// src/features/telegram-miniapp/siv-request/TelegramMiniAppSivRequestPage.tsx

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  closeTelegramMiniApp,
  getTelegramInitData,
  getTelegramRuntimeState,
  getTelegramTheme,
  getTelegramWebApp,
  notifyTelegram,
  waitForTelegramMiniApp,
  type TelegramRuntimeState,
} from "../telegramWebApp";

type ApiEnvelope = { message?: string; error?: string };

type SivContextDto = {
  companyId: string;
  branchId?: string | null;
  userId: string;
  employeeId?: string | null;
  employeeName?: string | null;
  fromLocations: SivLocationDto[];
  toLocations: SivLocationDto[];
  defaultFromLocationId?: string | null;
  defaultToLocationId?: string | null;
};

type SivLocationDto = {
  id: string;
  name: string;
  code?: string | null;
  branchId: string;
  locationType?: string | number;
  userIsDefault?: boolean;
  isMainWarehouse?: boolean;
  canReceiveGrn?: boolean;
  isProductionCenter?: boolean;
  isConsumptionLocation?: boolean;
  isDefaultIssueSource?: boolean;
  isDefaultReceivingTarget?: boolean;
  isDefaultConsumptionLocation?: boolean;
};

type CategoryDto = {
  categoryId: string;
  categoryName: string;
};

type AvailableItemDto = {
  itemId: string;
  itemCode?: string | null;
  itemName: string;
  barcode?: string | null;
  categoryId?: string | null;
  requestUomCode?: string | null;
  availableBaseQty: number;
  availableQty: number;
};

type FifoLotDto = {
  fifoLayerId: string;
  itemId: string;
  batchNo?: string | null;
  expiryDate?: string | null;
  uomCode?: string | null;
  availableBaseQty: number;
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

type MessageState = {
  type: "info" | "success" | "error" | "warn";
  text: string;
};

type SubmitResponse = {
  success: boolean;
  message: string;
  sivId: string;
  requestNo?: string | null;
};

const API = {
  context: "/api/telegram/miniapp/siv/context",
  categories: "/api/telegram/miniapp/siv/categories",
  availableItems: "/api/telegram/miniapp/siv/available-items",
  fifoLots: "/api/telegram/miniapp/siv/fifo-lots",
  requests: "/api/telegram/miniapp/siv/requests",
} as const;

const MIN_QTY = 0.001;
const MAX_QTY = 999_999;
const MAX_LINES = 100;
const CLOSE_DELAY_MS = 1400;

export default function TelegramMiniAppSivRequestPage() {
  const telegram = getTelegramWebApp();
  const initData = getTelegramInitData();
  const runtimeTheme = getTelegramTheme();
  const styles = useMemo(() => createStyles(runtimeTheme), [runtimeTheme]);
  const telegramUserName = telegram?.initDataUnsafe?.user?.first_name;

  const [booting, setBooting] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingFifoLots, setLoadingFifoLots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [hasInitData, setHasInitData] = useState(false);
  const [tenantKey, setTenantKey] = useState("");

  const [context, setContext] = useState<SivContextDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [items, setItems] = useState<AvailableItemDto[]>([]);
  const [fifoLots, setFifoLots] = useState<FifoLotDto[]>([]);

  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedFifoLayerId, setSelectedFifoLayerId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<SivLine[]>([]);
  const [message, setMessage] = useState<MessageState | null>(null);

  const headers = useMemo(
    () => buildHeaders(initData, tenantKey),
    [initData, tenantKey]
  );

  const fromLocation = useMemo(
    () => context?.fromLocations.find((x) => x.id === fromLocationId) ?? null,
    [context?.fromLocations, fromLocationId]
  );

  const toLocation = useMemo(
    () => context?.toLocations.find((x) => x.id === toLocationId) ?? null,
    [context?.toLocations, toLocationId]
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.itemId === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const selectedFifoLot = useMemo(
    () => fifoLots.find((lot) => lot.fifoLayerId === selectedFifoLayerId) ?? null,
    [fifoLots, selectedFifoLayerId]
  );

  const effectiveAvailableQty = selectedFifoLot?.availableQty ?? selectedItem?.availableQty ?? 0;

  const totalQty = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  );

  const canLoadItems = Boolean(fromLocationId && toLocationId && fromLocationId !== toLocationId);
  const canAddLine = Boolean(selectedItem && quantity >= MIN_QTY && quantity <= MAX_QTY);
  const canSubmit = Boolean(
    fromLocationId &&
      toLocationId &&
      fromLocationId !== toLocationId &&
      lines.length > 0 &&
      !submitting
  );

  useEffect(() => {
    return waitForTelegramMiniApp((state: TelegramRuntimeState) => {
      setIsTelegram(state.webAppLoaded);
      setHasInitData(state.hasInitData);
    });
  }, []);

  useEffect(() => {
    const abort = new AbortController();

    async function boot() {
      const runtime = getTelegramRuntimeState();
      const resolvedTenantKey = runtime.startParam?.trim() ?? "";

      const runtimeError = validateRuntime(runtime, resolvedTenantKey);
      if (runtimeError) {
        setBooting(false);
        setMessage(runtimeError);
        return;
      }

      try {
        setBooting(true);
        setMessage(null);
        setTenantKey(resolvedTenantKey);

        const requestHeaders = buildHeaders(initData, resolvedTenantKey);
        const [contextRes, categoriesRes] = await Promise.all([
          axios.get<SivContextDto>(API.context, {
            headers: requestHeaders,
            signal: abort.signal,
          }),
          axios.get<CategoryDto[]>(API.categories, {
            headers: requestHeaders,
            signal: abort.signal,
          }),
        ]);

        const ctx = contextRes.data;
        setContext(ctx);
        setCategories(categoriesRes.data ?? []);
        setFromLocationId(ctx.defaultFromLocationId ?? ctx.fromLocations[0]?.id ?? "");
        setToLocationId(ctx.defaultToLocationId ?? ctx.toLocations[0]?.id ?? "");

        if (!ctx.branchId) {
          setMessage({ type: "error", text: "Your Telegram profile is not assigned to a branch." });
        } else if (!ctx.fromLocations.length || !ctx.toLocations.length) {
          setMessage({
            type: "warn",
            text: "No valid SIV From/To locations are assigned to your profile. Ask an ERP administrator to configure stock-location access.",
          });
        }
      } catch (error) {
        if (abort.signal.aborted) return;
        setMessage({
          type: "error",
          text: getApiErrorMessage(error, "Unable to open Mini App SIV request."),
        });
      } finally {
        if (!abort.signal.aborted) setBooting(false);
      }
    }

    void boot();

    return () => abort.abort();
  }, [initData, isTelegram, hasInitData]);

  useEffect(() => {
    const abort = new AbortController();

    async function loadItems() {
      setItems([]);
      setSelectedItemId("");
      setFifoLots([]);
      setSelectedFifoLayerId("");

      if (!canLoadItems) return;

      try {
        setLoadingItems(true);
        const response = await axios.get<AvailableItemDto[]>(API.availableItems, {
          headers,
          signal: abort.signal,
          params: {
            fromLocationId,
            toLocationId,
            categoryId: categoryId || undefined,
          },
        });
        setItems(response.data ?? []);
      } catch (error) {
        if (abort.signal.aborted) return;
        setMessage({ type: "error", text: getApiErrorMessage(error, "Unable to load available items.") });
      } finally {
        if (!abort.signal.aborted) setLoadingItems(false);
      }
    }

    void loadItems();

    return () => abort.abort();
  }, [headers, canLoadItems, fromLocationId, toLocationId, categoryId]);


  useEffect(() => {
    const abort = new AbortController();

    async function loadFifoLots() {
      setFifoLots([]);
      setSelectedFifoLayerId("");

      if (!fromLocationId || !selectedItemId) return;

      try {
        setLoadingFifoLots(true);
        const response = await axios.get<FifoLotDto[]>(API.fifoLots, {
          headers,
          signal: abort.signal,
          params: { fromLocationId, itemId: selectedItemId },
        });

        const lots = response.data ?? [];
        setFifoLots(lots);

        const firstUsable = lots.find((lot) => !lot.isExpired && lot.availableQty > 0) ?? lots[0];
        if (firstUsable) setSelectedFifoLayerId(firstUsable.fifoLayerId);
      } catch (error) {
        if (abort.signal.aborted) return;
        setMessage({ type: "error", text: getApiErrorMessage(error, "Unable to load FIFO lots.") });
      } finally {
        if (!abort.signal.aborted) setLoadingFifoLots(false);
      }
    }

    void loadFifoLots();

    return () => abort.abort();
  }, [headers, fromLocationId, selectedItemId]);

  const resetDocument = useCallback(() => {
    setLines([]);
    setSelectedItemId("");
    setQuantity(1);
    setRemarks("");
    setMessage(null);
  }, []);

  const handleFromChange = useCallback((id: string) => {
    setFromLocationId(id);
    setSelectedItemId("");
    setLines([]);
    setMessage(null);
  }, []);

  const handleToChange = useCallback((id: string) => {
    setToLocationId(id);
    setSelectedItemId("");
    setLines([]);
    setMessage(null);
  }, []);

  const addLine = useCallback(() => {
    if (!selectedItem) {
      setMessage({ type: "info", text: "Select an available item first." });
      return;
    }

    const safeQty = roundQty(quantity);
    if (!Number.isFinite(safeQty) || safeQty < MIN_QTY) {
      setMessage({ type: "error", text: "Quantity must be greater than zero." });
      return;
    }

    if (fifoLots.length > 0 && !selectedFifoLot) {
      setMessage({ type: "error", text: "Select a FIFO lot first." });
      return;
    }

    if (safeQty > effectiveAvailableQty) {
      setMessage({
        type: "error",
        text: `Requested quantity exceeds available stock. Available: ${fmtQty(effectiveAvailableQty)} ${selectedItem.requestUomCode ?? ""}`.trim(),
      });
      return;
    }

    setLines((prev) => {
      const existing = prev.find((line) =>
        line.itemId === selectedItem.itemId &&
        (line.fifoLayerId ?? "") === (selectedFifoLot?.fifoLayerId ?? "")
      );
      const existingQty = existing?.quantity ?? 0;
      const nextQty = roundQty(existingQty + safeQty);

      if (nextQty > effectiveAvailableQty) {
        setMessage({
          type: "error",
          text: `Total requested quantity exceeds available stock. Available: ${fmtQty(effectiveAvailableQty)} ${selectedItem.requestUomCode ?? ""}`.trim(),
        });
        return prev;
      }

      if (existing) {
        return prev.map((line) =>
          line.itemId === selectedItem.itemId
            ? { ...line, quantity: nextQty }
            : line
        );
      }

      if (prev.length >= MAX_LINES) {
        setMessage({ type: "error", text: `Maximum ${MAX_LINES} lines are allowed.` });
        return prev;
      }

      return [
        ...prev,
        {
          itemId: selectedItem.itemId,
          itemCode: selectedItem.itemCode,
          itemName: selectedItem.itemName,
          requestUomCode: selectedItem.requestUomCode,
          quantity: safeQty,
          availableQty: effectiveAvailableQty,
          fifoLayerId: selectedFifoLot?.fifoLayerId ?? null,
          batchNo: selectedFifoLot?.batchNo ?? null,
          expiryDate: selectedFifoLot?.expiryDate ?? null,
        },
      ];
    });

    setSelectedItemId("");
    setQuantity(1);
    setMessage(null);
  }, [effectiveAvailableQty, fifoLots.length, quantity, selectedFifoLot, selectedItem]);

  const removeLine = useCallback((itemId: string, fifoLayerId?: string | null) => {
    setLines((prev) => prev.filter((line) =>
      !(line.itemId === itemId && (line.fifoLayerId ?? "") === (fifoLayerId ?? ""))
    ));
  }, []);

  const submit = useCallback(async () => {
    if (!fromLocationId || !toLocationId) {
      setMessage({ type: "info", text: "Select both From and To locations." });
      return;
    }

    if (fromLocationId === toLocationId) {
      setMessage({ type: "error", text: "From and To locations cannot be the same." });
      return;
    }

    if (!lines.length) {
      setMessage({ type: "info", text: "Add at least one item." });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);

      const response = await axios.post<SubmitResponse>(
        API.requests,
        {
          fromLocationId,
          toLocationId,
          issueDate: new Date().toISOString(),
          remarks: remarks.trim() || null,
          lines: lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            remarks: "Requested from Telegram Mini App",
          })),
        },
        { headers }
      );

      notifyTelegram("success");
      setMessage({
        type: "success",
        text: response.data?.message || "SIV request submitted. Approver has been notified.",
      });
      resetDocument();
      closeTelegramMiniApp(CLOSE_DELAY_MS);
    } catch (error) {
      notifyTelegram("error");
      setMessage({ type: "error", text: getApiErrorMessage(error, "Unable to submit SIV request.") });
    } finally {
      setSubmitting(false);
    }
  }, [fromLocationId, headers, lines, remarks, resetDocument, toLocationId]);

  if (booting) {
    return (
      <section style={styles.page}>
        <LoadingState styles={styles} />
      </section>
    );
  }

  return (
    <section style={styles.page}>
      <header style={styles.headerCard}>
        <div>
          <div style={styles.eyebrow}>Inventory · SIV</div>
          <h2 style={styles.title}>New Store Issue Request</h2>
          <p style={styles.subtitle}>
            {context?.employeeName || telegramUserName
              ? `Requester: ${context?.employeeName || telegramUserName}`
              : "Create a stock issue request for approval."}
          </p>
        </div>
        <div style={styles.headerIcon}>🧾</div>
      </header>

      {message && <Notice message={message} styles={styles} />}

      <section style={styles.workflowCard}>
        <WorkflowStep active done={Boolean(fromLocationId && toLocationId)} label="Select locations" />
        <WorkflowStep active={Boolean(canLoadItems)} done={lines.length > 0} label="Add available items" />
        <WorkflowStep active={lines.length > 0} done={false} label="Submit for approval" />
      </section>

      <section style={styles.card}>
        <SectionTitle title="Document" hint="From warehouse to requesting location" />

        <Field label="From Location" required>
          <select
            value={fromLocationId}
            onChange={(event) => handleFromChange(event.target.value)}
            style={styles.input}
          >
            <option value="">Select issue source</option>
            {context?.fromLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabel(location, "from")}
              </option>
            ))}
          </select>
        </Field>

        <Field label="To Location" required>
          <select
            value={toLocationId}
            onChange={(event) => handleToChange(event.target.value)}
            style={styles.input}
          >
            <option value="">Select requesting location</option>
            {context?.toLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabel(location, "to")}
              </option>
            ))}
          </select>
        </Field>

        {fromLocation && toLocation && fromLocation.id === toLocation.id && (
          <div style={styles.inlineError}>From and To locations cannot be the same.</div>
        )}

        <div style={styles.routeBox}>
          <span>{fromLocation ? locationLabel(fromLocation, "from") : "From"}</span>
          <strong>→</strong>
          <span>{toLocation ? locationLabel(toLocation, "to") : "To"}</span>
        </div>

        <Field label="Remarks">
          <textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Optional notes for approver"
            style={{ ...styles.input, minHeight: 76, resize: "vertical" }}
          />
        </Field>
      </section>

      <section style={styles.card}>
        <SectionTitle title="Available Items" hint="Only items with available stock are listed" />

        <Field label="Category">
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            style={styles.input}
            disabled={!canLoadItems}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.categoryId} value={category.categoryId}>
                {category.categoryName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Item" required>
          <select
            value={selectedItemId}
            onChange={(event) => setSelectedItemId(event.target.value)}
            style={styles.input}
            disabled={!canLoadItems || loadingItems}
          >
            <option value="">
              {!canLoadItems
                ? "Select From and To locations first"
                : loadingItems
                ? "Loading available items..."
                : items.length
                ? "Select item"
                : "No available items"}
            </option>
            {items.map((item) => (
              <option key={item.itemId} value={item.itemId}>
                {itemOptionLabel(item)}
              </option>
            ))}
          </select>
        </Field>

        {selectedItem && (
          <div style={styles.availabilityBox}>
            <div>
              <span style={styles.metaLabel}>Available</span>
              <strong>
                {fmtQty(selectedItem.availableQty)} {selectedItem.requestUomCode ?? ""}
              </strong>
            </div>
            <div>
              <span style={styles.metaLabel}>Code</span>
              <strong>{selectedItem.itemCode || selectedItem.barcode || "—"}</strong>
            </div>
          </div>
        )}



        {selectedItem && (
          <Field label="FIFO Lot" required={fifoLots.length > 0}>
            <select
              value={selectedFifoLayerId}
              onChange={(event) => setSelectedFifoLayerId(event.target.value)}
              style={styles.input}
              disabled={loadingFifoLots || fifoLots.length === 0}
            >
              <option value="">
                {loadingFifoLots
                  ? "Loading FIFO lots..."
                  : fifoLots.length
                  ? "Select FIFO lot"
                  : "No FIFO lot detail found"}
              </option>
              {fifoLots.map((lot) => (
                <option key={lot.fifoLayerId} value={lot.fifoLayerId}>
                  {fifoLotLabel(lot)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={selectedItem?.requestUomCode ? `Quantity (${selectedItem.requestUomCode})` : "Quantity"} required>
          <input
            type="number"
            min={MIN_QTY}
            max={effectiveAvailableQty || selectedItem?.availableQty || MAX_QTY}
            step="0.001"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            style={styles.input}
            disabled={!selectedItem}
          />
        </Field>

        <button
          type="button"
          onClick={addLine}
          disabled={!canAddLine}
          style={{ ...styles.primaryButton, ...(!canAddLine ? styles.buttonDisabled : null) }}
        >
          ➕ Add Item
        </button>
      </section>

      <section style={styles.card}>
        <SectionTitle title="Request Lines" hint={`${lines.length} line${lines.length === 1 ? "" : "s"}`} />

        {lines.length === 0 ? (
          <div style={styles.emptyState}>No items added yet.</div>
        ) : (
          <div style={styles.lineList}>
            {lines.map((line, index) => (
              <div key={`${line.itemId}:${line.fifoLayerId ?? ""}`} style={styles.lineCard}>
                <div style={styles.lineNo}>{String(index + 1).padStart(2, "0")}</div>
                <div style={styles.lineBody}>
                  <strong style={styles.lineTitle}>{line.itemName}</strong>
                  <span style={styles.lineMeta}>
                    {line.itemCode || "No code"} · Qty {fmtQty(line.quantity)} {line.requestUomCode ?? ""}
                    {line.batchNo ? ` · Batch ${line.batchNo}` : ""}
                    {line.expiryDate ? ` · Exp ${fmtDate(line.expiryDate)}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.itemId, line.fifoLayerId)}
                  style={styles.removeButton}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <div style={styles.totalBox}>
            <span>Total requested quantity</span>
            <strong>{fmtQty(totalQty)}</strong>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        style={{ ...styles.submitButton, ...(!canSubmit ? styles.buttonDisabled : null) }}
      >
        {submitting ? "Submitting..." : "✅ Submit for Approval"}
      </button>
    </section>
  );
}

function buildHeaders(initData: string, tenantKey: string): Record<string, string> {
  const headers: Record<string, string> = { "X-Telegram-InitData": initData };
  if (tenantKey.trim()) headers["X-Tenant-Id"] = tenantKey.trim();
  return headers;
}

function validateRuntime(runtime: ReturnType<typeof getTelegramRuntimeState>, tenantKey: string): MessageState | null {
  if (!runtime.webAppLoaded) {
    return { type: "error", text: "Please open this page from the Telegram bot Mini App button." };
  }

  if (!runtime.hasInitData) {
    return { type: "error", text: "Telegram auth data is missing. Reopen the Mini App from Telegram." };
  }

  if (!tenantKey) {
    return { type: "error", text: "Tenant context is missing. Reopen the Mini App from the tenant link." };
  }

  return null;
}

function Field({ label, required, children }: { label: string; required?: boolean; children?: React.ReactNode }) {
  return (
    <label style={baseStyles.field}>
      <span style={baseStyles.label}>
        {label} {required && <span style={baseStyles.required}>*</span>}
      </span>
      {children}
    </label>
  );
}

const SectionTitle = memo(function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={baseStyles.sectionHeader}>
      <div>
        <h3 style={baseStyles.sectionTitle}>{title}</h3>
        {hint && <p style={baseStyles.sectionHint}>{hint}</p>}
      </div>
    </div>
  );
});

const WorkflowStep = memo(function WorkflowStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div style={{ ...baseStyles.workflowStep, opacity: active || done ? 1 : 0.45 }}>
      <span style={baseStyles.workflowDot}>{done ? "✓" : "•"}</span>
      <span>{label}</span>
    </div>
  );
});

const Notice = memo(function Notice({ message, styles }: { message: MessageState; styles: ReturnType<typeof createStyles> }) {
  return (
    <div
      style={{
        ...styles.notice,
        ...(message.type === "success" ? styles.noticeSuccess : null),
        ...(message.type === "error" ? styles.noticeError : null),
        ...(message.type === "warn" ? styles.noticeWarn : null),
      }}
      role="alert"
    >
      {message.text}
    </div>
  );
});

const LoadingState = memo(function LoadingState({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <section style={styles.loadingCard}>
      <div style={styles.loadingIcon}>⏳</div>
      <strong style={styles.loadingTitle}>Opening SIV Mini App...</strong>
      <span style={styles.loadingText}>Verifying Telegram session and loading ERP stock context.</span>
    </section>
  );
});

function locationLabel(location: SivLocationDto, mode: "from" | "to"): string {
  const prefix = mode === "from"
    ? location.isMainWarehouse
      ? "🏬"
      : "📦"
    : location.isProductionCenter
    ? "🍳"
    : location.isConsumptionLocation
    ? "🥘"
    : "📍";

  const code = location.code ? ` (${location.code})` : "";
  return `${prefix} ${location.name}${code}`;
}


function fifoLotLabel(lot: FifoLotDto): string {
  const batch = lot.batchNo?.trim() || "No batch";
  const expiry = lot.expiryDate ? ` · Exp ${fmtDate(lot.expiryDate)}` : "";
  const expired = lot.isExpired ? " · expired" : "";
  return `${batch}${expiry} · ${fmtQty(lot.availableQty)} ${lot.uomCode ?? ""}${expired}`.trim();
}

function fmtDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function itemOptionLabel(item: AvailableItemDto): string {
  const code = item.itemCode || item.barcode;
  const uom = item.requestUomCode ? ` ${item.requestUomCode}` : "";
  const available = `${fmtQty(item.availableQty)}${uom}`;
  return `${code ? `${code} · ` : ""}${item.itemName} — Available ${available}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  const axiosError = error as { response?: { status?: number; data?: ApiEnvelope | string } };
  const data = axiosError.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data === "object" && data?.message?.trim()) return data.message;
  if (typeof data === "object" && data?.error?.trim()) return data.error;

  if (axiosError.response?.status === 401) return "Telegram authentication failed. Reopen the Mini App from Telegram.";
  if (axiosError.response?.status === 403) return "You are not authorized for the selected SIV operation.";

  return fallback;
}

function fmtQty(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const baseStyles = {
  field: {
    display: "block",
    marginBottom: 12,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 900,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  required: {
    color: "#dc2626",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: "inherit",
  },
  sectionHint: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "inherit",
    opacity: 0.68,
    lineHeight: 1.35,
  },
  workflowStep: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  workflowDot: {
    width: 20,
    height: 20,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.18)",
  },
} satisfies Record<string, React.CSSProperties>;

function createStyles(theme: Record<string, string>) {
  const bg = theme.bg_color ?? "#f6f7fb";
  const cardBg = theme.secondary_bg_color ?? "#ffffff";
  const text = theme.text_color ?? "#111827";
  const hint = theme.hint_color ?? "#6b7280";
  const border = theme.hint_color ? `${theme.hint_color}55` : "#e5e7eb";
  const button = theme.button_color ?? "#2481cc";
  const buttonText = theme.button_text_color ?? "#ffffff";

  return {
    page: {
      display: "grid",
      gap: 14,
      padding: "0 0 92px",
      minHeight: "100%",
      background: bg,
      color: text,
      boxSizing: "border-box",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    },
    headerCard: {
      padding: 18,
      borderRadius: 24,
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #334155 100%)",
      color: "#ffffff",
      boxShadow: "0 14px 34px rgba(15, 23, 42, 0.22)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      display: "grid",
      placeItems: "center",
      background: "rgba(255,255,255,0.12)",
      fontSize: 28,
      flexShrink: 0,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.72)",
    },
    title: {
      margin: "6px 0 0",
      fontSize: 22,
      lineHeight: 1.15,
      fontWeight: 900,
    },
    subtitle: {
      margin: "8px 0 0",
      fontSize: 13,
      lineHeight: 1.35,
      color: "rgba(255,255,255,0.8)",
    },
    workflowCard: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 8,
      padding: 12,
      borderRadius: 20,
      color: "#ffffff",
      background: "linear-gradient(135deg, #334155, #475569)",
      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
    },
    card: {
      padding: 14,
      borderRadius: 22,
      border: `1px solid ${border}`,
      background: cardBg,
      boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)",
    },
    input: {
      width: "100%",
      minHeight: 46,
      padding: "11px 12px",
      borderRadius: 14,
      border: `1px solid ${border}`,
      background: cardBg,
      color: text,
      boxSizing: "border-box",
      fontSize: 15,
      outline: "none",
    },
    routeBox: {
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      gap: 10,
      alignItems: "center",
      padding: 12,
      margin: "0 0 12px",
      borderRadius: 16,
      background: "#f8fafc",
      border: "1px dashed #cbd5e1",
      color: "#334155",
      fontSize: 12,
      fontWeight: 800,
      textAlign: "center",
    },
    inlineError: {
      margin: "-4px 0 12px",
      padding: 10,
      borderRadius: 12,
      background: "#fef2f2",
      color: "#991b1b",
      fontSize: 12,
      fontWeight: 800,
    },
    availabilityBox: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      padding: 12,
      marginBottom: 12,
      borderRadius: 16,
      background: "#ecfdf5",
      border: "1px solid #bbf7d0",
      color: "#166534",
    },
    metaLabel: {
      display: "block",
      marginBottom: 3,
      fontSize: 10,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      opacity: 0.68,
    },
    primaryButton: {
      width: "100%",
      minHeight: 48,
      padding: "12px 14px",
      borderRadius: 16,
      border: "none",
      background: button,
      color: buttonText,
      fontWeight: 900,
      fontSize: 15,
      cursor: "pointer",
    },
    submitButton: {
      position: "sticky",
      bottom: 76,
      zIndex: 5,
      width: "100%",
      minHeight: 52,
      padding: "14px 16px",
      borderRadius: 18,
      border: "none",
      background: button,
      color: buttonText,
      fontWeight: 900,
      fontSize: 16,
      cursor: "pointer",
      boxShadow: "0 14px 28px rgba(37, 99, 235, 0.28)",
    },
    buttonDisabled: {
      opacity: 0.55,
      cursor: "not-allowed",
      boxShadow: "none",
    },
    notice: {
      padding: 13,
      borderRadius: 18,
      border: "1px solid #bfdbfe",
      background: "#eff6ff",
      color: "#1d4ed8",
      fontSize: 13,
      fontWeight: 800,
      lineHeight: 1.4,
    },
    noticeSuccess: {
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    },
    noticeError: {
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#991b1b",
    },
    noticeWarn: {
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#92400e",
    },
    emptyState: {
      padding: 18,
      borderRadius: 16,
      background: "#f9fafb",
      color: hint,
      fontSize: 14,
      fontWeight: 700,
      textAlign: "center",
    },
    lineList: {
      display: "grid",
      gap: 10,
    },
    lineCard: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${border}`,
      background: cardBg,
    },
    lineNo: {
      width: 30,
      height: 30,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      background: "#f1f5f9",
      color: "#475569",
      fontSize: 11,
      fontWeight: 900,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      flexShrink: 0,
    },
    lineBody: {
      flex: 1,
      minWidth: 0,
      display: "grid",
      gap: 4,
    },
    lineTitle: {
      fontSize: 14,
      fontWeight: 900,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    lineMeta: {
      fontSize: 12,
      color: hint,
      fontWeight: 700,
    },
    removeButton: {
      padding: "8px 10px",
      borderRadius: 12,
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#991b1b",
      fontWeight: 900,
      fontSize: 12,
      cursor: "pointer",
    },
    totalBox: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 12,
      paddingTop: 12,
      borderTop: `1px solid ${border}`,
      fontSize: 13,
      fontWeight: 900,
    },
    loadingCard: {
      minHeight: 280,
      display: "grid",
      placeItems: "center",
      alignContent: "center",
      gap: 8,
      padding: 24,
      borderRadius: 24,
      background: cardBg,
      border: `1px solid ${border}`,
      textAlign: "center",
    },
    loadingIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      display: "grid",
      placeItems: "center",
      background: "#f3f4f6",
      fontSize: 28,
      marginBottom: 6,
    },
    loadingTitle: {
      fontSize: 17,
      fontWeight: 900,
    },
    loadingText: {
      fontSize: 13,
      lineHeight: 1.4,
      color: hint,
    },
  } satisfies Record<string, React.CSSProperties>;
}
