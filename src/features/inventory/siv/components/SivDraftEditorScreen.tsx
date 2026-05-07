import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { useSivScreenController } from "../hooks/useSivScreenController";
import { sivApi } from "../api/sivApi";
import type { InventorySearchItemDto } from "../../../inventoryMaster/items/types";
import "../pages/siv-draft.css";

type SivDraftEditorScreenProps = {
  companyId: string;
  branchId: string;
  departmentId?: string | null;
  currentLocationId?: string | null;
  mode?: "create" | "edit";
  draftId?: string | null;
  initialDraft?: any | null;
};

type ItemPatch = {
  itemId: string;
  itemName?: string;
  uomId?: string;
  uomCode?: string;
};

function formatQty(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(n);
}

function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function makeFifoKey(opt: {
  fifoLayerId?: string | null;
  sourceId?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
}): string {
  return [
    opt.fifoLayerId || opt.sourceId || "no-source",
    opt.batchNo || "no-batch",
    opt.expiryDate || "no-exp",
  ].join("|");
}

function requireString(value: string | null | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function ItemDropdownCell({
  disabled,
  value,
  items,
  loading,
  onOpen,
  onSelect,
}: {
  disabled: boolean;
  value: string;
  items: InventorySearchItemDto[];
  loading?: boolean;
  onOpen?: () => void | Promise<void>;
  onSelect: (patch: ItemPatch) => void | Promise<void>;
}) {
  return (
    <select
      className="lux-select"
      value={value || ""}
      disabled={disabled || loading}
      onFocus={() => void onOpen?.()}
      onMouseDown={() => void onOpen?.()}
      onChange={(e) => {
        const itemId = e.target.value;
        const item = items.find((x) => x.id === itemId);

        if (!item) {
          void onSelect({
            itemId: "",
            itemName: "",
            uomId: "",
            uomCode: "",
          });
          return;
        }

        void onSelect({
          itemId: item.id,
          itemName: item.name,
          uomId: item.baseUomId ?? "",
          uomCode: item.baseUomCode ?? "",
        });
      }}
    >
      <option value="">
        {loading ? "Loading items..." : "Select inventory item"}
      </option>

      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
          {item.sku
            ? ` · ${item.sku}`
            : item.barcode
              ? ` · ${item.barcode}`
              : ""}
          {item.baseUomCode ? ` · ${item.baseUomCode}` : ""}
        </option>
      ))}
    </select>
  );
}

export default function SivDraftEditorScreen({
  companyId,
  branchId,
  departmentId,
  currentLocationId,
  mode = "create",
  draftId,
  initialDraft,
}: SivDraftEditorScreenProps) {
  const navigate = useNavigate();

  const controller: any = useSivScreenController({
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

    fromLocations,
    selectedFromLocationId,
    setSelectedFromLocationId,

    issueDate,
    setIssueDate,

    notes,
    setNotes,

    lines,
    hydrateDraft,
    addLine,
    replaceLine,
    removeLine,
    updateLine,

    searchInventoryItems,
    onPickItem,

    createDraft,
    updateDraft,
    canSaveDraft,
  } = controller;

  const [itemOptions, setItemOptions] = useState<InventorySearchItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [clientError, setClientError] = useState("");
  const [editHydrated, setEditHydrated] = useState(false);

  const isEditMode = mode === "edit" && !!draftId;
  const disableUntilHydrated = isEditMode && !editHydrated;

  useEffect(() => {
    if (!isEditMode) return;
    if (!initialDraft) return;
    if (editHydrated) return;

    hydrateDraft(initialDraft);
    setEditHydrated(true);
  }, [isEditMode, initialDraft, editHydrated, hydrateDraft]);

  useEffect(() => {
    if (!isEditMode) return;
    if (initialDraft) return;
    if (!draftId) return;
    if (editHydrated) return;

    let active = true;

    async function loadEditDraft() {
      try {
        const data = await sivApi.getById(
          companyId,
          requireString(draftId, "draftId")
        );

        if (!active) return;

        hydrateDraft(data);
        setEditHydrated(true);
      } catch (e: any) {
        if (!active) return;

        setClientError(
          e?.response?.data?.title ||
            e?.response?.data?.message ||
            e?.message ||
            "Failed to load SIV draft for editing."
        );
      }
    }

    void loadEditDraft();

    return () => {
      active = false;
    };
  }, [isEditMode, initialDraft, draftId, companyId, editHydrated, hydrateDraft]);

  useEffect(() => {
    if (mode === "create") setEditHydrated(false);
  }, [mode]);

  useEffect(() => {
    setItemOptions([]);
  }, [selectedFromLocationId]);

  useEffect(() => {
    if (clientError) setClientError("");
  }, [issueDate, notes, selectedFromLocationId, lines]);

  const selectedLines = useMemo(
    () => lines.filter((line: any) => line.itemId),
    [lines]
  );

  const totalQty = useMemo(
    () =>
      lines.reduce(
        (sum: number, line: any) => sum + Number(line.qty || 0),
        0
      ),
    [lines]
  );

  const totalAvailable = useMemo(
    () =>
      lines.reduce(
        (sum: number, line: any) =>
          sum + Number(line.availableBaseQty ?? line.availableQty ?? 0),
        0
      ),
    [lines]
  );

  const duplicateLineKeys = useMemo(() => {
    const seen = new Map<string, string>();
    const duplicates = new Set<string>();

    for (const line of lines) {
      if (!line.itemId) continue;

      const key = [
        line.itemId || "",
        line.uomId || "",
        line.batchNo || "",
        line.expiryDate || "",
      ].join("|");

      const existing = seen.get(key);

      if (existing) {
        duplicates.add(existing);
        duplicates.add(line.key);
      } else {
        seen.set(key, line.key);
      }
    }

    return duplicates;
  }, [lines]);

  async function loadItemOptions(): Promise<void> {
    if (!selectedFromLocationId) {
      setItemOptions([]);
      return;
    }

    try {
      setItemsLoading(true);

      let data = await searchInventoryItems("");

      if (!data || data.length === 0) {
        data = await searchInventoryItems("a");
      }

      setItemOptions((data || []).slice(0, 200));
    } catch {
      setItemOptions([]);
    } finally {
      setItemsLoading(false);
    }
  }

  function getLineAvailable(line: any): number {
    return Number(line.availableBaseQty ?? line.availableQty ?? 0);
  }

  function handleFifoChange(line: any, fifoKey: string): void {
    const fifo = line.fifoOptions?.find((x: any) => makeFifoKey(x) === fifoKey);

    replaceLine(line.key, {
      selectedFifoKey: fifoKey,
      batchNo: fifo?.batchNo ?? line.batchNo ?? "",
      expiryDate: fifo?.expiryDate ?? line.expiryDate ?? "",
      availableQty: fifo?.availableQty ?? line.availableQty,
      availableBaseQty:
        fifo?.availableBaseQty ??
        fifo?.availableQty ??
        line.availableBaseQty ??
        line.availableQty,
      lineError: "",
    });
  }

  function validateBeforeSave(): string {
    if (!selectedFromLocationId) return "From location is required.";
    if (selectedLines.length === 0) return "At least one item line is required.";

    if (selectedLines.some((line: any) => !line.uomId)) {
      return "UOM is required. Please reselect the affected item line.";
    }

    if (selectedLines.some((line: any) => Number(line.qty || 0) <= 0)) {
      return "Quantity must be greater than zero for all selected lines.";
    }

    if (
      selectedLines.some(
        (line: any) => Number(line.qty || 0) > getLineAvailable(line)
      )
    ) {
      return "One or more lines exceed available stock.";
    }

    if (duplicateLineKeys.size > 0) {
      return "Duplicate item + batch + UOM combinations are not allowed.";
    }

    if (selectedLines.some((line: any) => line.lineError)) {
      return "Please resolve all line errors before saving the SIV.";
    }

    return "";
  }

  async function handleSaveDraft(): Promise<void> {
    const validationMessage = validateBeforeSave();

    if (validationMessage) {
      setClientError(validationMessage);
      return;
    }

    setClientError("");

    if (isEditMode) {
      const updated = await updateDraft(requireString(draftId, "draftId"));

      if (updated?.id) {
        navigate(`/companies/${companyId}/siv/open/${updated.id}`);
      }

      return;
    }

    const created = await createDraft();

    if (created?.id) {
      navigate(`/companies/${companyId}/siv/open/${created.id}`);
    }
  }

  function handleLocationChange(value: string): void {
    setSelectedFromLocationId(value);
    setClientError("");
    setItemOptions([]);

    for (const line of lines) {
      replaceLine(line.key, {
        itemId: "",
        itemName: "",
        uomId: "",
        uomCode: "",
        qty: "",
        availableQty: undefined,
        availableBaseQty: undefined,
        batchNo: "",
        expiryDate: "",
        selectedFifoKey: "",
        fifoOptions: [],
        loadingFifo: false,
        loadingAvailability: false,
        lineError: line.itemId
          ? "Location changed. Re-select item to refresh FIFO availability."
          : "",
      });
    }
  }

  return (
    <div className="lux-page min-h-screen">
      <div className="lux-grn-sticky-top">
        <div className="lux-grn-top-inner">
          <div className="lux-grn-block">
            <div className="lux-grn-kicker">Inventory / Stock Issue Voucher</div>
            <div className="lux-grn-title">
              {isEditMode ? "Edit SIV Draft" : "Create SIV Draft"}
            </div>
            <div className="lux-grn-meta">
              <span>Company: {companyId}</span>
              <span className="lux-dot">•</span>
              <span>Branch: {branchId}</span>
              {isEditMode && draftId ? (
                <>
                  <span className="lux-dot">•</span>
                  <span>Draft: {draftId}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="lux-grn-fields">
            <div className="lux-field compact">
              <label className="lux-label">Date</label>
              <input
                type="date"
                className="lux-input"
                value={issueDate}
                disabled={disableUntilHydrated}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            <div className="lux-field compact wide">
              <label className="lux-label">From Location</label>
              <select
                className="lux-select"
                value={selectedFromLocationId || ""}
                onChange={(e) => handleLocationChange(e.target.value)}
                disabled={loading || disableUntilHydrated}
              >
                <option value="">
                  {loading ? "Loading..." : "Select location"}
                </option>

                {fromLocations.map((location: any) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.code ? ` · ${location.code}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="lux-grn-summary">
            <div className="lux-sum-card highlight">
              <div className="lux-sum-label">Issuing Qty</div>
              <div className="lux-sum-value">{formatQty(totalQty)}</div>
            </div>

            <div className="lux-sum-card">
              <div className="lux-sum-label">Items</div>
              <div className="lux-sum-value">{selectedLines.length}</div>
            </div>

            <div className="lux-sum-card muted">
              <div className="lux-sum-label">Available</div>
              <div className="lux-sum-value">{formatQty(totalAvailable)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="lux-shell lux-grn-shell">
        {clientError ? (
          <div className="lux-banner error">
            <AlertCircle size={18} />
            <div>{clientError}</div>
          </div>
        ) : null}

        {error ? (
          <div className="lux-banner error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        ) : null}

        {success ? (
          <div className="lux-banner success">
            <CheckCircle2 size={18} />
            <div>{success}</div>
          </div>
        ) : null}

        <section className="lux-card lux-section">
          <div className="lux-section-head">
            <div>
              <h2 className="lux-card-title">Remarks</h2>
              <div className="lux-card-subtitle">
                Optional issue purpose or internal note.
              </div>
            </div>
          </div>

          <textarea
            className="lux-textarea lux-grn-remarks-box"
            value={notes}
            disabled={disableUntilHydrated}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Remarks (optional)"
          />
        </section>

        <section className="lux-card lux-section">
          <div className="lux-section-head">
            <div>
              <h2 className="lux-card-title">Issue Lines</h2>
              <div className="lux-card-subtitle">
                {selectedLines.length} item(s) selected · Issuing Qty:{" "}
                {formatQty(totalQty)}
              </div>
            </div>

            <button
              type="button"
              className="lux-btn"
              onClick={() => {
                setClientError("");
                addLine();
              }}
              disabled={disableUntilHydrated}
            >
              <Plus size={16} />
              Add Line
            </button>
          </div>

          <div className="lux-table-wrap">
            <table className="lux-table">
              <thead>
                <tr>
                  <th style={{ width: 320 }}>Item</th>
                  <th style={{ width: 250 }}>FIFO Lot</th>
                  <th style={{ width: 110 }}>UOM</th>
                  <th style={{ width: 130 }}>Available</th>
                  <th style={{ width: 130 }}>Issue Qty</th>
                  <th style={{ width: 130 }}>Batch</th>
                  <th style={{ width: 130 }}>Expiry</th>
                  <th>Remarks</th>
                  <th style={{ width: 72 }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {lines.map((line: any, index: number) => {
                  const available = getLineAvailable(line);
                  const qty = Number(line.qty || 0);
                  const duplicate = duplicateLineKeys.has(line.key);

                  const effectiveLineError =
                    line.lineError ||
                    (duplicate
                      ? "Duplicate item + batch + UOM combination."
                      : qty > 0 && qty > available
                        ? "Quantity exceeds available stock."
                        : "");

                  return (
                    <tr key={line.key}>
                      <td>
                        <ItemDropdownCell
                          disabled={!selectedFromLocationId || disableUntilHydrated}
                          value={String(line.itemId || "")}
                          items={itemOptions}
                          loading={itemsLoading}
                          onOpen={async () => {
                            if (!itemOptions.length) await loadItemOptions();
                          }}
                          onSelect={async (patch) => {
                            setClientError("");
                            await onPickItem(line.key, patch);
                          }}
                        />

                        <div className="lux-row-note">
                          {line.itemId
                            ? `${line.itemName || "Selected item"} · Line ${
                                index + 1
                              }`
                            : "Choose item from selected location."}
                        </div>
                      </td>

                      <td>
                        <select
                          className="lux-select"
                          value={line.selectedFifoKey || ""}
                          disabled={
                            !line.itemId ||
                            line.loadingFifo ||
                            (line.fifoOptions?.length ?? 0) === 0 ||
                            disableUntilHydrated
                          }
                          onChange={(e) => {
                            setClientError("");
                            handleFifoChange(line, e.target.value);
                          }}
                        >
                          <option value="">
                            {line.loadingFifo ? "Loading FIFO..." : "Select FIFO lot"}
                          </option>

                          {(line.fifoOptions || []).map((opt: any) => {
                            const key = makeFifoKey(opt);

                            return (
                              <option key={key} value={key}>
                                {(opt.sourceNumber || "FIFO")} ·{" "}
                                {formatQty(opt.availableQty)} ·{" "}
                                {opt.batchNo || "No batch"}
                              </option>
                            );
                          })}
                        </select>

                        <div className="lux-row-note">
                          {line.loadingFifo
                            ? "Loading FIFO lots..."
                            : line.fifoOptions?.[0]
                              ? "FIFO lot selected"
                              : isEditMode && line.batchNo
                                ? "Saved FIFO lot"
                                : "No FIFO lot loaded"}
                        </div>
                      </td>

                      <td>
                        <input
                          className="lux-input"
                          value={line.uomCode || ""}
                          disabled
                        />
                      </td>

                      <td>
                        <input
                          className="lux-input"
                          value={
                            line.loadingAvailability
                              ? "Loading..."
                              : formatQty(available)
                          }
                          disabled
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="lux-input"
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
                          placeholder="0.00"
                        />
                      </td>

                      <td>
                        <input
                          className="lux-input"
                          value={line.batchNo || ""}
                          disabled
                        />
                      </td>

                      <td>
                        <input
                          className="lux-input"
                          value={line.expiryDate ? toIsoDate(line.expiryDate) : ""}
                          disabled
                        />
                      </td>

                      <td>
                        <textarea
                          className="lux-textarea"
                          style={{ minHeight: 64 }}
                          value={line.remarks || ""}
                          placeholder="Line remarks"
                          disabled={disableUntilHydrated}
                          onChange={(e) => {
                            setClientError("");
                            updateLine(line.key, "remarks", e.target.value);
                          }}
                        />

                        {effectiveLineError ? (
                          <div className="lux-line-error">{effectiveLineError}</div>
                        ) : null}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="lux-btn danger"
                          onClick={() => {
                            setClientError("");
                            removeLine(line.key);
                          }}
                          disabled={lines.length === 1 || disableUntilHydrated}
                          title="Remove line"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lux-helper">
            Quantity must be greater than zero, cannot exceed available stock,
            and duplicate item + batch + UOM combinations are blocked.
          </div>
        </section>

        <div className="lux-bottom-actions">
          <button
            type="button"
            className="lux-btn ghost"
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="lux-btn primary"
            onClick={() => void handleSaveDraft()}
            disabled={!canSaveDraft || saving || disableUntilHydrated}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {isEditMode ? "Save Changes" : "Save Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

