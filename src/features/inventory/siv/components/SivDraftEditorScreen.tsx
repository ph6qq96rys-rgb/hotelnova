// src/features/inventory/siv/components/SivDraftEditorScreen.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSivScreenController } from "../hooks/useSivScreenController";
import type {
  FifoIssueCandidateDto,
  InventoryItemSearchResult,
  LocationOption,
} from "../api/sivApi";
import { sivApi } from "../api/sivApi";
import "../pages/siv-draft.css";

type Props = {
  companyId: string;
  branchId: string;
  departmentId?: string | null;
  currentLocationId?: string | null;
  mode?: "create" | "edit";
  draftId?: string | null;
  initialDraft?: unknown;
};

function fmtQty(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(n)
    : "—";
}

function toIsoDate(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function makeFifoKey(opt: Partial<FifoIssueCandidateDto>): string {
  return [
    opt.fifoLayerId || opt.sourceId || "no-source",
    opt.batchNo || "no-batch",
    opt.expiryDate || "no-exp",
  ].join("|");
}

function getApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;

  if (typeof data === "string") return data;

  return (
    data?.error ??
    data?.Error ??
    data?.message ??
    data?.title ??
    err?.message ??
    fallback
  );
}

function getItemUomId(item: InventoryItemSearchResult): string {
  return String((item as any).uomId ?? item.baseUomId ?? "");
}

function getItemUomCode(item: InventoryItemSearchResult): string {
  return String((item as any).uomCode ?? item.baseUomCode ?? "");
}

export default function SivDraftEditorScreen({
  companyId,
  branchId,
  departmentId,
  currentLocationId,
  mode = "create",
  draftId,
  initialDraft,
}: Props) {
  const navigate = useNavigate();

  const ctrl = useSivScreenController({
    companyId,
    branchId,
    departmentId: departmentId ?? undefined,
    currentLocationId: currentLocationId ?? undefined,
  });

  const {
    loading,
    saving,
    error,
    success,

    fromLocations: warehouseLocations,
    selectedFromLocationId: selectedWarehouseId,
    setSelectedFromLocationId: setSelectedWarehouseId,

    issueDate,
    setIssueDate,
    notes,
    setNotes,

    lines,
    selectedLines,
    addLine,
    removeLine,
    updateLine,
    hydrateDraft,
    onPickItem,
    onChangeFifo,
    searchInventoryItems,
    canSaveDraft,
    createDraft,
    updateDraft,
  } = ctrl;

  const warehouseLocationsLoading = loading;
  const requestingLocationName = currentLocationId ?? "Your branch location";

  const [itemOptions, setItemOptions] = useState<InventoryItemSearchResult[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [clientError, setClientError] = useState("");
  const [editHydrated, setEditHydrated] = useState(false);

  const isEdit = mode === "edit" && !!draftId;
  const disableUntilHydrated = isEdit && !editHydrated;

  useEffect(() => {
    if (!isEdit || editHydrated) return;

    if (initialDraft) {
      hydrateDraft(initialDraft as any);
      setEditHydrated(true);
      return;
    }

    if (!draftId) return;

    let active = true;

    async function loadDraft() {
      try {
        const response = await sivApi.getById(companyId, draftId!);
        const data = (response as any)?.data ?? response;

        if (!active) return;

        hydrateDraft(data as any);
        setEditHydrated(true);
      } catch (e) {
        if (active) setClientError(getApiError(e, "Failed to load SIV draft."));
      }
    }

    void loadDraft();

    return () => {
      active = false;
    };
  }, [isEdit, initialDraft, draftId, companyId, editHydrated, hydrateDraft]);

  useEffect(() => {
    if (mode === "create") setEditHydrated(false);
  }, [mode]);

  useEffect(() => {
    setItemOptions([]);
  }, [selectedWarehouseId]);

  useEffect(() => {
    setClientError("");
  }, [issueDate, notes, selectedWarehouseId, lines.length]);

  const loadItemOptions = useCallback(async () => {
    if (!selectedWarehouseId || itemOptions.length > 0) return;

    setItemsLoading(true);

    try {
      const data = await searchInventoryItems("");
      setItemOptions(Array.isArray(data) ? data : []);
    } catch (e) {
      setItemOptions([]);
      setClientError(getApiError(e, "Failed to load inventory items."));
    } finally {
      setItemsLoading(false);
    }
  }, [selectedWarehouseId, itemOptions.length, searchInventoryItems]);

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();

    lines.forEach((l) => {
      if (!l.itemId) return;
      const k = `${l.itemId}|${l.uomId}|${l.batchNo}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });

    const dupes = new Set<string>();

    lines.forEach((l) => {
      if (!l.itemId) return;
      const k = `${l.itemId}|${l.uomId}|${l.batchNo}`;
      if ((counts.get(k) ?? 0) > 1) dupes.add(l.key);
    });

    return dupes;
  }, [lines]);

  const totalQty = useMemo(
    () => lines.reduce((s, l) => s + Number(l.qty || 0), 0),
    [lines]
  );

  const hasOverStock = lines.some((l) => {
    const avail = l.availableQty ?? l.availableBaseQty;
    const qty = Number(l.qty || 0);
    return qty > 0 && avail != null && qty > avail;
  });

  async function handleSave() {
    setClientError("");

    try {
      const result =
        isEdit && draftId ? await updateDraft(draftId) : await createDraft();

      const saved = (result as any)?.data ?? result;

      if (saved?.id) {
        navigate(`/companies/${companyId}/siv/${saved.id}`, { replace: true });
      }
    } catch {
      // controller/hook already sets the error
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  const displayErr = clientError || error;

  return (
    <div className="page siv-page">
      <div className="page-header">
        <div>
          <div className="page-kicker">
            Inventory · SIV · {isEdit ? "Edit" : "New"}
          </div>
          <div className="page-title">
            {isEdit ? "Edit Stock Issue Request" : "New Stock Issue Request"}
          </div>
          <div className="page-sub">
            {isEdit
              ? "Update lines or header details, then save."
              : "Select the warehouse and items you need. Your location is auto-assigned."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {hasOverStock && (
            <div className="badge badge-danger" style={{ fontSize: 11 }}>
              ⚠ Qty exceeds available stock
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!canSaveDraft || saving || disableUntilHydrated || hasOverStock}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save draft"}
          </button>

          <button className="btn" onClick={() => navigate(-1)} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>

      {displayErr && (
        <div className="alert alert-danger" style={{ marginBottom: 14 }}>
          {displayErr}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 14 }}>
          {success}
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <div className="card-title">Requisition Details</div>
          <div className="card-subtitle">
            You are requesting stock as: <strong>{requestingLocationName}</strong>
          </div>
        </div>

        <div
          className="card-body"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
          }}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">
              Request from Warehouse
              <span style={{ color: "var(--danger)", marginLeft: 3 }}>*</span>
            </label>

            <select
              className="select"
              value={selectedWarehouseId}
              disabled={disableUntilHydrated || warehouseLocationsLoading}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                setClientError("");
              }}
            >
              <option value="">
                {warehouseLocationsLoading
                  ? "Loading warehouses…"
                  : "— Select warehouse —"}
              </option>

              {warehouseLocations.map((loc: LocationOption) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.code ? ` (${loc.code})` : ""}
                </option>
              ))}
            </select>

            <div style={{ marginTop: 5, fontSize: 11, color: "var(--text-muted)" }}>
              Stock will be pulled from this warehouse.
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Deliver to Your Location</label>

            <div
              style={{
                padding: "8px 11px",
                background: "var(--surface-2)",
                border: "1px solid var(--border-soft)",
                borderRadius: "var(--r)",
                fontSize: 13,
                color: "var(--text-muted)",
                minHeight: 36,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--success)",
                  flexShrink: 0,
                }}
              />
              {requestingLocationName}
            </div>

            <div style={{ marginTop: 5, fontSize: 11, color: "var(--text-muted)" }}>
              Auto-assigned from your branch. Cannot be changed.
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Required by Date</label>
            <input
              className="input"
              type="date"
              value={issueDate}
              disabled={disableUntilHydrated}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
            <label className="field-label">Purpose / Remarks</label>
            <textarea
              className="input siv-textarea"
              value={notes}
              disabled={disableUntilHydrated}
              onChange={(e) => {
                setNotes(e.target.value);
                setClientError("");
              }}
              placeholder="Describe the purpose of this requisition."
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Requested Items</div>
            <div className="card-subtitle">
              {selectedLines.length > 0
                ? `${selectedLines.length} item${
                    selectedLines.length !== 1 ? "s" : ""
                  } · Total qty: ${fmtQty(totalQty)}`
                : "Add the items you need from the selected warehouse."}
            </div>
          </div>

          <button
            className="btn btn-sm"
            onClick={() => {
              setClientError("");
              addLine();
              void loadItemOptions();
            }}
            disabled={disableUntilHydrated || !selectedWarehouseId}
            title={!selectedWarehouseId ? "Select a warehouse first" : "Add a line"}
          >
            + Add item
          </button>
        </div>

        {!selectedWarehouseId && (
          <div
            style={{
              padding: "14px 16px",
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border-soft)",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            ℹ Select a warehouse above before adding items.
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 300 }}>Item</th>
                <th style={{ width: 240 }}>FIFO Lot</th>
                <th style={{ width: 80 }}>UOM</th>
                <th style={{ width: 110, textAlign: "right" }}>Available</th>
                <th style={{ width: 110, textAlign: "right" }}>Request Qty</th>
                <th style={{ width: 120 }}>Batch</th>
                <th style={{ width: 110 }}>Expiry</th>
                <th>Notes</th>
                <th style={{ width: 52 }} />
              </tr>
            </thead>

            <tbody>
              {!selectedWarehouseId ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: 48,
                      textAlign: "center",
                      color: "var(--text-soft)",
                      fontSize: 13,
                    }}
                  >
                    Select a warehouse above to start adding items.
                  </td>
                </tr>
              ) : (
                lines.map((line, i) => {
                  const available = line.availableQty ?? line.availableBaseQty;
                  const qty = Number(line.qty || 0);
                  const isDupe = duplicateKeys.has(line.key);
                  const overStock = qty > 0 && available != null && qty > available;
                  const isExpired =
                    !!line.expiryDate && new Date(line.expiryDate) < new Date();

                  const lineErr =
                    line.lineError ||
                    (isDupe ? "Duplicate item + batch + UOM on this request." : "") ||
                    (overStock
                      ? `Exceeds available stock (${fmtQty(available)}).`
                      : "");

                  return (
                    <tr
                      key={line.key}
                      style={{
                        verticalAlign: "top",
                        background: lineErr
                          ? "var(--danger-bg)"
                          : isExpired
                          ? "var(--warn-bg)"
                          : undefined,
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 10px",
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "var(--text-muted)",
                          paddingTop: 14,
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        <select
                          className="select"
                          style={{ fontSize: 12 }}
                          value={line.itemId}
                          disabled={
                            !selectedWarehouseId ||
                            disableUntilHydrated ||
                            itemsLoading
                          }
                          onFocus={() => void loadItemOptions()}
                          onChange={(e) => {
                            setClientError("");

                            const item = itemOptions.find(
                              (x) => x.id === e.target.value
                            );

                            void onPickItem(
                              line.key,
                              item
                                ? {
                                    itemId: item.id,
                                    itemName: item.name,
                                    uomId: getItemUomId(item),
                                    uomCode: getItemUomCode(item),
                                  }
                                : {
                                    itemId: "",
                                    itemName: "",
                                    uomId: "",
                                    uomCode: "",
                                  }
                            );
                          }}
                        >
                          <option value="">
                            {itemsLoading ? "Loading items…" : "— Select item —"}
                          </option>

                          {itemOptions.map((item) => {
                            const uomCode = getItemUomCode(item);

                            return (
                              <option key={item.id} value={item.id}>
                                {item.name}
                                {item.sku ? ` · ${item.sku}` : ""}
                                {uomCode ? ` · ${uomCode}` : ""}
                              </option>
                            );
                          })}
                        </select>

                        {line.itemName && (
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text-muted)",
                              marginTop: 3,
                              fontFamily: "var(--mono)",
                            }}
                          >
                            {line.itemName}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        {line.loadingFifo ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              padding: "8px 0",
                            }}
                          >
                            Loading lots…
                          </div>
                        ) : line.fifoOptions.length > 0 ? (
                          <select
                            className="select"
                            style={{ fontSize: 12, minWidth: 200 }}
                            value={line.selectedFifoKey}
                            disabled={disableUntilHydrated}
                            onChange={(e) => {
                              setClientError("");
                              onChangeFifo(line.key, e.target.value);
                            }}
                          >
                            <option value="">— Select lot —</option>

                            {line.fifoOptions.map((opt) => {
                              const k = makeFifoKey(opt);

                              return (
                                <option key={k} value={k}>
                                  {opt.sourceNumber || "FIFO"} ·{" "}
                                  {fmtQty(opt.availableQty)}
                                  {opt.batchNo ? ` · ${opt.batchNo}` : ""}
                                </option>
                              );
                            })}
                          </select>
                        ) : line.itemId ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--danger)",
                              padding: "8px 0",
                            }}
                          >
                            No stock available at this warehouse.
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-soft)",
                              padding: "8px 0",
                            }}
                          >
                            —
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        <input
                          className="input"
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                          value={line.uomCode || "—"}
                          readOnly
                          disabled
                        />
                      </td>

                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        <input
                          className="input"
                          style={{
                            fontSize: 12,
                            textAlign: "right",
                            fontFamily: "var(--mono)",
                            color:
                              available != null && available === 0
                                ? "var(--danger)"
                                : "var(--text-muted)",
                          }}
                          value={line.loadingAvailability ? "…" : fmtQty(available)}
                          readOnly
                          disabled
                        />
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.001"
                          style={{
                            fontSize: 12,
                            textAlign: "right",
                            fontFamily: "var(--mono)",
                            borderColor: overStock ? "var(--danger)" : undefined,
                          }}
                          value={line.qty}
                          disabled={disableUntilHydrated}
                          onChange={(e) => {
                            setClientError("");

                            const raw = e.target.value;

                            updateLine(
                              line.key,
                              "qty",
                              raw === "" ? "" : Math.max(0, Number(raw))
                            );
                          }}
                          placeholder="0.000"
                        />
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        <input
                          className="input"
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                          value={line.batchNo || "—"}
                          readOnly
                          disabled
                        />
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        <input
                          className="input"
                          style={{
                            fontSize: 12,
                            color: isExpired
                              ? "var(--danger)"
                              : "var(--text-muted)",
                            borderColor: isExpired ? "var(--danger)" : undefined,
                          }}
                          value={toIsoDate(line.expiryDate) || "—"}
                          readOnly
                          disabled
                          title={isExpired ? "This lot has expired" : undefined}
                        />
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        <textarea
                          className="input"
                          style={{
                            minHeight: 60,
                            fontSize: 12,
                            resize: "vertical",
                          }}
                          value={line.remarks}
                          placeholder="Optional"
                          disabled={disableUntilHydrated}
                          onChange={(e) => {
                            setClientError("");
                            updateLine(line.key, "remarks", e.target.value);
                          }}
                        />

                        {lineErr && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--danger)",
                              marginTop: 3,
                            }}
                          >
                            ⚠ {lineErr}
                          </div>
                        )}

                        {isExpired && !lineErr && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--warn)",
                              marginTop: 3,
                            }}
                          >
                            ⚠ Selected lot has expired.
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <button
                          className="btn btn-sm"
                          style={{
                            padding: "4px 8px",
                            color: "var(--danger)",
                            borderColor: "var(--danger-border)",
                          }}
                          onClick={() => {
                            setClientError("");
                            removeLine(line.key);
                          }}
                          disabled={lines.length === 1 || disableUntilHydrated}
                          title="Remove this line"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {selectedLines.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--surface-2)", fontWeight: 600 }}>
                  <td
                    colSpan={5}
                    style={{
                      padding: "8px 10px",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text-muted)",
                    }}
                  >
                    Total requested
                  </td>

                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      fontFamily: "var(--mono)",
                      fontSize: 14,
                    }}
                  >
                    {fmtQty(totalQty)}
                  </td>

                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div
          style={{
            padding: "9px 16px",
            fontSize: 11,
            color: "var(--text-soft)",
            borderTop: "1px solid var(--border-soft)",
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span>ℹ Requested qty cannot exceed available warehouse stock.</span>
          <span>Duplicate item + batch + UOM combinations are blocked.</span>
          <span>Batch and expiry are assigned from the selected FIFO lot.</span>
        </div>
      </div>

      <div className="siv-bottom-actions">
        <button className="btn" onClick={() => navigate(-1)} disabled={saving}>
          Cancel
        </button>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!canSaveDraft || saving || disableUntilHydrated || hasOverStock}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save draft"}
        </button>
      </div>
    </div>
  );
}