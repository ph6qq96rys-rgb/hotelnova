import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ItemUomDto } from "../types";

import {
  inputStyle,
  tableStyle,
  thStyle,
  tdStyle,
  primaryBtn,
  secondaryBtn,
} from "../../../../shared/inventoryStyles";

type UomOption = {
  id: string;
  code: string;
  name: string;
};

type Props = {
  baseUomId?: string;
  uoms: UomOption[];
  rows: ItemUomDto[];
  onChange: (rows: ItemUomDto[]) => void;
};

type RowVm = ItemUomDto & {
  key: string;
};

const makeRowKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function stripKey(row: RowVm): ItemUomDto {
  const { key: _key, ...dto } = row;
  return dto;
}

function toRowVm(row: ItemUomDto, key?: string): RowVm {
  return {
    ...row,
    key: key ?? makeRowKey(),
  };
}

function isValidFactor(value: string): boolean {
  const numberValue = Number(value);
  return value.trim() !== "" && Number.isFinite(numberValue) && numberValue > 0;
}

function getFactorDisplayValue(row: ItemUomDto, factorText: string): number {
  const typed = Number(factorText);

  if (isValidFactor(factorText)) return typed;

  if (typeof row.toBaseFactor === "number" && Number.isFinite(row.toBaseFactor)) {
    return row.toBaseFactor;
  }

  return 1;
}

function getUomLabel(uom: UomOption): string {
  return uom.code ? `${uom.code} — ${uom.name}` : uom.name;
}

export default function UomConversionGrid({
  baseUomId,
  uoms,
  rows,
  onChange,
}: Props) {
  const [uiRows, setUiRows] = useState<RowVm[]>(() =>
    rows.map((row) => toRowVm(row))
  );

  const [factorTextByKey, setFactorTextByKey] = useState<Record<string, string>>(
    {}
  );

  const uomById = useMemo(() => {
    return new Map(uoms.map((uom) => [uom.id, uom]));
  }, [uoms]);

  const baseUom = useMemo(() => {
    return baseUomId ? uomById.get(baseUomId) : undefined;
  }, [baseUomId, uomById]);

  useEffect(() => {
    setUiRows((current) => {
      const usedKeys = new Set<string>();

      return rows.map((row) => {
        const match =
          current.find(
            (existing) =>
              !usedKeys.has(existing.key) &&
              existing.uomId === row.uomId &&
              existing.code === row.code &&
              existing.name === row.name
          ) ??
          current.find(
            (existing) =>
              !usedKeys.has(existing.key) && existing.uomId === row.uomId
          );

        if (!match) return toRowVm(row);

        usedKeys.add(match.key);
        return toRowVm(row, match.key);
      });
    });
  }, [rows]);

  useEffect(() => {
    setFactorTextByKey((current) => {
      const next = { ...current };
      const activeKeys = new Set(uiRows.map((row) => row.key));

      uiRows.forEach((row) => {
        if (next[row.key] !== undefined) return;

        next[row.key] =
          typeof row.toBaseFactor === "number" &&
          Number.isFinite(row.toBaseFactor)
            ? String(row.toBaseFactor)
            : "";
      });

      Object.keys(next).forEach((key) => {
        if (!activeKeys.has(key)) delete next[key];
      });

      return next;
    });
  }, [uiRows]);

  const commit = useCallback(
    (nextRows: RowVm[]) => {
      setUiRows(nextRows);
      onChange(nextRows.map(stripKey));
    },
    [onChange]
  );

  const usedUomIds = useMemo(() => {
    return new Set(uiRows.map((row) => row.uomId).filter(Boolean));
  }, [uiRows]);

  const canAdd = useMemo(() => {
    if (!baseUomId) return false;

    return uoms.some((uom) => uom.id !== baseUomId && !usedUomIds.has(uom.id));
  }, [baseUomId, uoms, usedUomIds]);

  const getChoicesForRow = useCallback(
    (rowKey: string): UomOption[] => {
      const row = uiRows.find((item) => item.key === rowKey);
      if (!row) return [];

      const usedByOtherRows = new Set(
        uiRows
          .filter((item) => item.key !== rowKey)
          .map((item) => item.uomId)
          .filter(Boolean)
      );

      return uoms.filter((uom) => {
        if (uom.id === baseUomId) return false;
        if (uom.id === row.uomId) return true;
        return !usedByOtherRows.has(uom.id);
      });
    },
    [baseUomId, uiRows, uoms]
  );

  const updateRow = useCallback(
    (rowKey: string, patch: Partial<ItemUomDto>) => {
      const rowIndex = uiRows.findIndex((row) => row.key === rowKey);
      if (rowIndex < 0) return;

      if (patch.uomId && patch.uomId === baseUomId) return;

      const nextRows = [...uiRows];
      const currentRow = nextRows[rowIndex];

      const patchedRow: RowVm = {
        ...currentRow,
        ...patch,
        key: currentRow.key,
      };

      if (patch.uomId) {
        const duplicate = nextRows.some(
          (row, index) => index !== rowIndex && row.uomId === patch.uomId
        );

        if (duplicate) return;

        const selectedUom = uomById.get(patch.uomId);

        if (selectedUom) {
          patchedRow.code = selectedUom.code;
          patchedRow.name = selectedUom.name;
        }
      }

      if (patch.isIssue === true) {
        nextRows.forEach((row, index) => {
          if (index !== rowIndex && row.isIssue) {
            nextRows[index] = { ...row, isIssue: false };
          }
        });
      }

      nextRows[rowIndex] = patchedRow;
      commit(nextRows);
    },
    [baseUomId, commit, uiRows, uomById]
  );

  const addRow = useCallback(() => {
    if (!baseUomId) return;

    const selectedUom = uoms.find(
      (uom) => uom.id !== baseUomId && !usedUomIds.has(uom.id)
    );

    if (!selectedUom) return;

    const nextRow: RowVm = {
      key: makeRowKey(),
      uomId: selectedUom.id,
      code: selectedUom.code,
      name: selectedUom.name,
      toBaseFactor: 0,
      isBase: false,
      isIssue: false,
      isActive: true,
    };

    commit([...uiRows, nextRow]);

    setFactorTextByKey((current) => ({
      ...current,
      [nextRow.key]: "",
    }));
  }, [baseUomId, commit, uiRows, uoms, usedUomIds]);

  const removeRow = useCallback(
    (rowKey: string) => {
      commit(uiRows.filter((row) => row.key !== rowKey));

      setFactorTextByKey((current) => {
        const next = { ...current };
        delete next[rowKey];
        return next;
      });
    },
    [commit, uiRows]
  );

  const handleFactorChange = useCallback(
    (rowKey: string, value: string) => {
      setFactorTextByKey((current) => ({
        ...current,
        [rowKey]: value,
      }));

      if (!isValidFactor(value)) return;

      updateRow(rowKey, {
        toBaseFactor: Number(value),
      });
    },
    [updateRow]
  );

  const handleFactorBlur = useCallback(
    (rowKey: string) => {
      const row = uiRows.find((item) => item.key === rowKey);
      if (!row) return;

      const value = factorTextByKey[rowKey] ?? "";

      if (!isValidFactor(value)) {
        const fallback =
          typeof row.toBaseFactor === "number" &&
          Number.isFinite(row.toBaseFactor) &&
          row.toBaseFactor > 0
            ? row.toBaseFactor
            : "";

        setFactorTextByKey((current) => ({
          ...current,
          [rowKey]: fallback === "" ? "" : String(fallback),
        }));

        return;
      }

      const normalized = String(Number(value));

      setFactorTextByKey((current) => ({
        ...current,
        [rowKey]: normalized,
      }));

      updateRow(rowKey, {
        toBaseFactor: Number(normalized),
      });
    },
    [factorTextByKey, uiRows, updateRow]
  );

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
            Allowed Units & Conversions
          </div>

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>
            Add additional units and define how each unit converts to the base
            unit.
          </div>

          {baseUom ? (
            <div style={baseChipStyle}>
              <span style={{ opacity: 0.7 }}>Base unit</span>
              <b>{baseUom.code || baseUom.name}</b>
              <span style={{ opacity: 0.45 }}>—</span>
              <span>{baseUom.name}</span>
            </div>
          ) : (
            <div style={warningChipStyle}>Select a base UOM first.</div>
          )}
        </div>

        <button
          type="button"
          style={canAdd ? primaryBtn : disabledBtnStyle}
          disabled={!canAdd}
          onClick={addRow}
          title={
            !baseUomId
              ? "Select a base UOM first"
              : !canAdd
                ? "No more units available"
                : "Add unit"
          }
        >
          + Add Unit
        </button>
      </div>

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 340 }}>Unit</th>
              <th style={{ ...thStyle, width: 260 }}>To Base Factor</th>
              <th style={thStyle}>Example</th>
              <th style={{ ...thStyle, textAlign: "right", width: 110 }}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {uiRows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, opacity: 0.7 }}>
                  No additional units. If this item uses only the base unit, you
                  can leave this section empty.
                </td>
              </tr>
            ) : (
              uiRows.map((row) => {
                const selectedUom = uomById.get(row.uomId);
                const factorText = factorTextByKey[row.key] ?? "";
                const factorInvalid =
                  factorText.trim() !== "" && !isValidFactor(factorText);

                return (
                  <tr key={row.key}>
                    <td style={tdStyle}>
                      <select
                        value={row.uomId}
                        disabled={!baseUomId}
                        onChange={(event) =>
                          updateRow(row.key, { uomId: event.target.value })
                        }
                        style={inputStyle(false)}
                      >
                        {getChoicesForRow(row.key).map((uom) => (
                          <option key={uom.id} value={uom.id}>
                            {getUomLabel(uom)}
                          </option>
                        ))}
                      </select>

                      <div style={optionRowStyle}>
                        <label style={checkLabelStyle}>
                          <input
                            type="checkbox"
                            checked={Boolean(row.isIssue)}
                            disabled={!baseUomId}
                            onChange={(event) =>
                              updateRow(row.key, {
                                isIssue: event.target.checked,
                              })
                            }
                          />
                          Issue UOM
                        </label>

                        <label style={checkLabelStyle}>
                          <input
                            type="checkbox"
                            checked={row.isActive !== false}
                            disabled={!baseUomId}
                            onChange={(event) =>
                              updateRow(row.key, {
                                isActive: event.target.checked,
                              })
                            }
                          />
                          Active
                        </label>
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="number"
                        min={0.0000001}
                        step="0.0001"
                        inputMode="decimal"
                        value={factorText}
                        disabled={!baseUomId}
                        onChange={(event) =>
                          handleFactorChange(row.key, event.target.value)
                        }
                        onBlur={() => handleFactorBlur(row.key)}
                        style={inputStyle(factorInvalid)}
                      />

                      <div
                        style={{
                          fontSize: 11,
                          marginTop: 5,
                          color: factorInvalid ? "#b91c1c" : "#64748b",
                        }}
                      >
                        Must be greater than 0. Example: KG to G = 1000.
                      </div>
                    </td>

                    <td style={tdStyle}>
                      {baseUom && selectedUom ? (
                        <span style={{ fontSize: 12, color: "#334155" }}>
                          1 <b>{selectedUom.code || selectedUom.name}</b> ={" "}
                          <b>{getFactorDisplayValue(row, factorText)}</b>{" "}
                          <b>{baseUom.code || baseUom.name}</b>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        type="button"
                        style={secondaryBtn}
                        disabled={!baseUomId}
                        onClick={() => removeRow(row.key)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div style={footerHintStyle}>
          Tip: Mark exactly one <b>Issue UOM</b> to control the unit used during
          issuing, store requests, and stock movement.
        </div>
      </div>
    </div>
  );
}

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const tableWrapStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  overflow: "hidden",
  background: "#fff",
};

const baseChipStyle: CSSProperties = {
  marginTop: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  fontSize: 12,
  color: "#334155",
};

const warningChipStyle: CSSProperties = {
  marginTop: 8,
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  fontSize: 12,
  color: "#92400e",
  fontWeight: 700,
};

const optionRowStyle: CSSProperties = {
  marginTop: 8,
  display: "flex",
  flexWrap: "wrap",
  gap: 14,
  fontSize: 12,
  color: "#475569",
};

const checkLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const footerHintStyle: CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  background: "#f8fafc",
  padding: "8px 12px",
  fontSize: 11,
  color: "#64748b",
};

const disabledBtnStyle: CSSProperties = {
  ...primaryBtn,
  opacity: 0.55,
  cursor: "not-allowed",
};