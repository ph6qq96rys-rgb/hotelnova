// src/features/inventory/items/components/UomConversionGrid.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemUomDto } from "../types";

interface UomOption {
  id: string;
  code: string;
  name: string;
}

interface Props {
  baseUomId?: string;
  uoms: UomOption[];
  rows: ItemUomDto[];
  onChange: (rows: ItemUomDto[]) => void;
}

type RowVm = ItemUomDto & { _key: string };

const makeKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toVm = (row: ItemUomDto, key?: string): RowVm => ({
  ...row,
  _key: key ?? makeKey(),
});

const fromVm = ({ _key, ...row }: RowVm): ItemUomDto => row;

const isPositiveFactor = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function isValidFactorText(value: string): boolean {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n > 0;
}

function uomLabel(uom: UomOption): string {
  return uom.code ? `${uom.code} — ${uom.name}` : uom.name;
}

function buildBaseRow(baseUom: UomOption): ItemUomDto {
  return {
    uomId: baseUom.id,
    code: baseUom.code,
    name: baseUom.name,
    toBaseFactor: 1,
    isBase: true,
    isPurchase: true,
    isIssue: true,
    isRecipe: true,
    isConsume: true,
    isCount: true,
    isActive: true,
  };
}

function normalizeRows(
  baseUomId: string | undefined,
  uoms: UomOption[],
  rows: ItemUomDto[]
): ItemUomDto[] {
  if (!baseUomId) {
    return rows.filter((x) => Boolean(x.uomId));
  }

  const baseUom = uoms.find((x) => x.id === baseUomId);
  if (!baseUom) {
    return rows.filter((x) => Boolean(x.uomId));
  }

  const byUom = new Map<string, ItemUomDto>();

  for (const row of rows) {
    if (!row.uomId) continue;

    const meta = uoms.find((x) => x.id === row.uomId);
    const isBase = row.uomId === baseUomId;

    byUom.set(row.uomId, {
      ...row,
      code: meta?.code ?? row.code ?? "",
      name: meta?.name ?? row.name ?? "",
      isBase,
      isActive: isBase ? true : row.isActive !== false,
      isPurchase: Boolean(row.isPurchase),
      isIssue: Boolean(row.isIssue),
      isRecipe: Boolean(row.isRecipe),
      isConsume: Boolean(row.isConsume),
      isCount: row.isCount !== false,
      toBaseFactor: isBase ? 1 : isPositiveFactor(row.toBaseFactor) ? row.toBaseFactor : null,
    });
  }

  byUom.set(baseUomId, {
    ...buildBaseRow(baseUom),
    ...byUom.get(baseUomId),
    uomId: baseUomId,
    code: baseUom.code,
    name: baseUom.name,
    toBaseFactor: 1,
    isBase: true,
    isActive: true,
  });

  return Array.from(byUom.values()).sort((a, b) => {
    if (a.uomId === baseUomId) return -1;
    if (b.uomId === baseUomId) return 1;
    return `${a.code ?? ""}`.localeCompare(`${b.code ?? ""}`);
  });
}

export default function UomConversionGrid({
  baseUomId,
  uoms,
  rows,
  onChange,
}: Props) {
  const normalizedRows = useMemo(
    () => normalizeRows(baseUomId, uoms, rows),
    [baseUomId, uoms, rows]
  );

  const [vmRows, setVmRows] = useState<RowVm[]>(() =>
    normalizedRows.map((x) => toVm(x))
  );

  const [factorText, setFactorText] = useState<Record<string, string>>({});

  const uomById = useMemo(() => new Map(uoms.map((x) => [x.id, x])), [uoms]);

  const baseUom = useMemo(
    () => (baseUomId ? uomById.get(baseUomId) : undefined),
    [baseUomId, uomById]
  );

  const usedUomIds = useMemo(
    () => new Set(vmRows.map((x) => x.uomId).filter(Boolean)),
    [vmRows]
  );

  const canAdd = useMemo(
    () => Boolean(baseUomId) && uoms.some((x) => x.id !== baseUomId && !usedUomIds.has(x.id)),
    [baseUomId, uoms, usedUomIds]
  );

  useEffect(() => {
    setVmRows((current) => {
      const usedKeys = new Set<string>();

      return normalizedRows.map((row) => {
        const existing = current.find(
          (x) => !usedKeys.has(x._key) && x.uomId === row.uomId
        );

        if (!existing) return toVm(row);

        usedKeys.add(existing._key);
        return toVm(row, existing._key);
      });
    });
  }, [normalizedRows]);

  useEffect(() => {
    setFactorText((prev) => {
      const next = { ...prev };
      const keys = new Set(vmRows.map((x) => x._key));

      for (const row of vmRows) {
        if (next[row._key] !== undefined) continue;
        next[row._key] = isPositiveFactor(row.toBaseFactor)
          ? String(row.toBaseFactor)
          : "";
      }

      for (const key of Object.keys(next)) {
        if (!keys.has(key)) delete next[key];
      }

      return next;
    });
  }, [vmRows]);

  const commit = useCallback(
    (next: RowVm[]) => {
      const normalized = normalizeRows(baseUomId, uoms, next.map(fromVm));
      const keyed = normalized.map((row) => {
        const existing = next.find((x) => x.uomId === row.uomId);
        return toVm(row, existing?._key);
      });

      setVmRows(keyed);
      onChange(keyed.map(fromVm));
    },
    [baseUomId, onChange, uoms]
  );

  const choicesFor = useCallback(
    (key: string): UomOption[] => {
      const row = vmRows.find((x) => x._key === key);
      if (!row) return [];

      if (row.isBase) {
        return baseUom ? [baseUom] : [];
      }

      const takenByOthers = new Set(
        vmRows
          .filter((x) => x._key !== key)
          .map((x) => x.uomId)
          .filter(Boolean)
      );

      return uoms.filter(
        (x) =>
          x.id !== baseUomId &&
          (x.id === row.uomId || !takenByOthers.has(x.id))
      );
    },
    [baseUom, baseUomId, uoms, vmRows]
  );

  const updateRow = useCallback(
    (key: string, patch: Partial<ItemUomDto>) => {
      const idx = vmRows.findIndex((x) => x._key === key);
      if (idx < 0) return;

      const current = vmRows[idx];

      if (current.isBase) {
        const next = [...vmRows];
        next[idx] = {
          ...current,
          ...patch,
          uomId: baseUomId ?? current.uomId,
          toBaseFactor: 1,
          isBase: true,
          isActive: true,
          _key: current._key,
        };
        commit(next);
        return;
      }

      if (patch.uomId === baseUomId) return;

      const next = [...vmRows];

      if (patch.uomId) {
        const duplicate = next.some(
          (x, i) => i !== idx && x.uomId === patch.uomId
        );
        if (duplicate) return;
      }

      const updated: RowVm = {
        ...current,
        ...patch,
        isBase: false,
        _key: current._key,
      };

      if (patch.uomId) {
        const meta = uomById.get(patch.uomId);
        if (meta) {
          updated.code = meta.code;
          updated.name = meta.name;
        }
      }

      next[idx] = updated;
      commit(next);
    },
    [baseUomId, commit, uomById, vmRows]
  );

  const addRow = useCallback(() => {
    const nextUom = uoms.find(
      (x) => x.id !== baseUomId && !usedUomIds.has(x.id)
    );

    if (!nextUom) return;

    const row: RowVm = {
      _key: makeKey(),
      uomId: nextUom.id,
      code: nextUom.code,
      name: nextUom.name,
      toBaseFactor: null,
      isBase: false,
      isPurchase: false,
      isIssue: false,
      isRecipe: false,
      isConsume: false,
      isCount: true,
      isActive: true,
    };

    commit([...vmRows, row]);
    setFactorText((prev) => ({ ...prev, [row._key]: "" }));
  }, [baseUomId, commit, uoms, usedUomIds, vmRows]);

  const removeRow = useCallback(
    (key: string) => {
      const row = vmRows.find((x) => x._key === key);
      if (!row || row.isBase) return;

      commit(vmRows.filter((x) => x._key !== key));

      setFactorText((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [commit, vmRows]
  );

  const onFactorChange = useCallback(
    (key: string, value: string) => {
      const row = vmRows.find((x) => x._key === key);
      if (!row || row.isBase) return;

      setFactorText((prev) => ({ ...prev, [key]: value }));

      if (isValidFactorText(value)) {
        updateRow(key, { toBaseFactor: Number(value) });
      }
    },
    [updateRow, vmRows]
  );

  const onFactorBlur = useCallback(
    (key: string) => {
      const row = vmRows.find((x) => x._key === key);
      if (!row) return;

      if (row.isBase) {
        setFactorText((prev) => ({ ...prev, [key]: "1" }));
        updateRow(key, { toBaseFactor: 1 });
        return;
      }

      const text = factorText[key] ?? "";

      if (!isValidFactorText(text)) {
        setFactorText((prev) => ({
          ...prev,
          [key]: isPositiveFactor(row.toBaseFactor) ? String(row.toBaseFactor) : "",
        }));
        return;
      }

      const normalized = String(Number(text));
      setFactorText((prev) => ({ ...prev, [key]: normalized }));
      updateRow(key, { toBaseFactor: Number(normalized) });
    },
    [factorText, updateRow, vmRows]
  );

  return (
    <div className="uom-grid">
      <div className="uom-grid__header">
        <div className="uom-grid__meta">
          <div className="uom-grid__title">Allowed Units &amp; Conversions</div>
          <div className="uom-grid__subtitle">
            Configure which UOMs are valid for purchase, issue, consumption, and stock count.
          </div>

          {baseUom ? (
            <div className="uom-chip">
              <span className="uom-chip__label">Base unit</span>
              <strong>{baseUom.code || baseUom.name}</strong>
              <span className="uom-chip__separator">—</span>
              <span>{baseUom.name}</span>
            </div>
          ) : (
            <div className="uom-chip uom-chip--warn">
              Select a base UOM first.
            </div>
          )}
        </div>

        <button
          type="button"
          className="inv-btn inv-btn--outline inv-btn--sm"
          disabled={!canAdd}
          onClick={addRow}
        >
          + Add Unit
        </button>
      </div>

      <div className="uom-table-wrap">
        <div className="uom-table-scroll">
          <table className="uom-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>To Base Factor</th>
                <th>Purchase</th>
                <th>Issue</th>
                <th>Recipe</th>
                <th>Consume</th>
                <th>Count</th>
                <th>Active</th>
                <th>Example</th>
                <th className="right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {!baseUomId ? (
                <tr>
                  <td colSpan={10} className="uom-table__empty">
                    Select a base UOM to automatically create the required base conversion row.
                  </td>
                </tr>
              ) : (
                vmRows.map((row) => {
                  const selectedUom = uomById.get(row.uomId);
                  const text = factorText[row._key] ?? "";
                  const invalid =
                    !row.isBase && text.trim() !== "" && !isValidFactorText(text);

                  return (
                    <tr key={row._key} className={row.isBase ? "uom-table__row--base" : undefined}>
                      <td>
                        <select
                          className="inv-input"
                          value={row.uomId}
                          disabled={row.isBase}
                          onChange={(e) => updateRow(row._key, { uomId: e.target.value })}
                        >
                          {choicesFor(row._key).map((uom) => (
                            <option key={uom.id} value={uom.id}>
                              {uomLabel(uom)}
                            </option>
                          ))}
                        </select>

                        {row.isBase && (
                          <div className="uom-factor-hint">
                            Base row required for conversion.
                          </div>
                        )}
                      </td>

                      <td>
                        <input
                          type="number"
                          className={`inv-input${invalid ? " inv-input--invalid" : ""}`}
                          min={0.0000001}
                          step="0.0001"
                          inputMode="decimal"
                          value={row.isBase ? "1" : text}
                          disabled={row.isBase}
                          onChange={(e) => onFactorChange(row._key, e.target.value)}
                          onBlur={() => onFactorBlur(row._key)}
                        />

                        <div className={`uom-factor-hint${invalid ? " uom-factor-hint--error" : ""}`}>
                          {row.isBase ? "Locked to 1." : "Must be greater than zero."}
                        </div>
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(row.isPurchase)}
                          onChange={(e) => updateRow(row._key, { isPurchase: e.target.checked })}
                        />
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(row.isIssue)}
                          onChange={(e) => updateRow(row._key, { isIssue: e.target.checked })}
                        />
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(row.isRecipe)}
                          onChange={(e) => updateRow(row._key, { isRecipe: e.target.checked })}
                        />
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(row.isConsume)}
                          onChange={(e) => updateRow(row._key, { isConsume: e.target.checked })}
                        />
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={row.isCount !== false}
                          onChange={(e) => updateRow(row._key, { isCount: e.target.checked })}
                        />
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={row.isActive !== false}
                          disabled={row.isBase}
                          onChange={(e) => updateRow(row._key, { isActive: e.target.checked })}
                        />
                      </td>

                      <td>
                        {baseUom && selectedUom ? (
                          <span className="uom-example">
                            1 <b>{selectedUom.code || selectedUom.name}</b>
                            {" = "}
                            <b>
                              {row.isBase
                                ? 1
                                : isValidFactorText(text)
                                  ? Number(text)
                                  : row.toBaseFactor || "?"}
                            </b>{" "}
                            <b>{baseUom.code || baseUom.name}</b>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="right">
                        <button
                          type="button"
                          className="inv-btn inv-btn--outline inv-btn--sm"
                          disabled={row.isBase}
                          onClick={() => removeRow(row._key)}
                        >
                          {row.isBase ? "Locked" : "Remove"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="uom-table-footer">
          Purchase GRN requires <strong>Purchase</strong>. SIV/store issue requires{" "}
          <strong>Issue</strong>. Recipe/COGS posting requires{" "}
          <strong>Consume</strong>. Physical count requires <strong>Count</strong>.
        </div>
      </div>
    </div>
  );
}