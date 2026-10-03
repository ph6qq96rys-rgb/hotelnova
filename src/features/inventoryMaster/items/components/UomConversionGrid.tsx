// src/features/inventory/items/components/UomConversionGrid.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemUomDto } from "../types";
import { useI18n } from "../../../../i18n";

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
  return uom.code ? `${uom.code} - ${unitName(uom)}` : unitName(uom);
}

// Display terminology only; existing IDs, codes and factors remain unchanged.
function unitName(uom: UomOption): string {
  const tokens = [normalizeToken(uom.code), normalizeToken(uom.name)];
  if (tokens.some(x => ["PACK", "PK", "PKT", "PKG", "PACKAGE", "PACKET"].includes(x))) return "Pack";
  if (tokens.some(x => ["PCS", "PC", "PIECE", "PIECES"].includes(x))) return "Pcs";
  return uom.name || uom.code;
}

type UomFamily = "weight" | "volume" | "count" | "package" | "unknown";

function normalizeToken(value?: string | null): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function uomFamily(uom?: Pick<UomOption, "code" | "name">): UomFamily {
  if (!uom) return "unknown";

  const tokens = new Set([normalizeToken(uom.code), normalizeToken(uom.name)]);

  if (["KG", "KGS", "KILOGRAM", "KILOGRAMS", "GM", "G", "GR", "GRAM", "GRAMS"].some((x) => tokens.has(x))) {
    return "weight";
  }

  if (["LTR", "L", "LT", "LITER", "LITRE", "LITERS", "LITRES", "ML", "MILLILITER", "MILLILITRE", "MILLILITERS", "MILLILITRES"].some((x) => tokens.has(x))) {
    return "volume";
  }

  if (["EA", "EACH", "PCS", "PC", "PIECE", "PIECES", "UNIT", "UNITS", "EACHUNIT"].some((x) => tokens.has(x))) {
    return "count";
  }

  if (["CASE", "CS", "BOX", "PACK", "PK", "PKT", "PKG", "PACKAGE", "PACKET", "CARTON", "CTN", "DOZ", "DOZEN", "BTL", "BOTTLE", "SET", "ROLL"].some((x) => tokens.has(x))) {
    return "package";
  }

  return "unknown";
}

function isCompatibleUom(baseUom?: UomOption, selectedUom?: UomOption): boolean {
  if (!baseUom || !selectedUom) return true;
  if (baseUom.id === selectedUom.id) return true;

  const baseFamily = uomFamily(baseUom);
  const selectedFamily = uomFamily(selectedUom);

  if (baseFamily === "unknown" || selectedFamily === "unknown") return true;
  if (baseFamily === selectedFamily) return true;

  return baseFamily === "package" || selectedFamily === "package";
}

function compatibilityHint(baseUom?: UomOption): string {
  const family = uomFamily(baseUom);

  if (family === "weight") return "Use weight units only, for example 1 GM = 0.001 KG or 1 KG = 1000 GM.";
  if (family === "volume") return "Use volume units only, for example 1 ML = 0.001 LTR.";
  if (family === "count") return "Enter the total pieces in one pack, box or carton for this item. Example: 1 Pack contains 50 Pcs; 1 Carton of 20 packs contains 1000 Pcs.";
  if (family === "package") return "Pack is the base stock unit. Enter the fraction of a pack in one selected unit: if 1 Pack contains 50 Pcs, enter 0.02 for Pcs. If 1 Carton contains 20 packs, enter 20 for Carton.";

  return "The factor means base quantity received from 1 selected unit.";
}

function formatConversionNumber(value: number): string {
  if (!Number.isFinite(value)) return "?";

  const nearestWhole = Math.round(value);
  if (Math.abs(value - nearestWhole) < 0.01) return String(nearestWhole);

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  });
}

function resolveFactor(row: ItemUomDto, text: string): number | null {
  if (row.isBase) return 1;
  if (isValidFactorText(text)) return Number(text);
  return isPositiveFactor(row.toBaseFactor) ? row.toBaseFactor : null;
}

function buildConversionExample(
  row: ItemUomDto,
  text: string,
  selectedUom: UomOption,
  baseUom: UomOption
): { display: string; detail: string | null } {
  const factor = resolveFactor(row, text);
  const selectedLabel = unitName(selectedUom);
  const baseLabel = unitName(baseUom);

  if (!factor) {
    return {
      display: `1 ${selectedLabel} = ? ${baseLabel}`,
      detail: null,
    };
  }

  if (!row.isBase && uomFamily(baseUom) === "count") {
    return {
      display: `1 ${selectedLabel} contains ${formatConversionNumber(factor)} ${baseLabel}`,
      detail: `2 ${selectedLabel} = ${formatConversionNumber(2 * factor)} ${baseLabel}`,
    };
  }

  if (!row.isBase && factor < 1) {
    const unitsPerBase = 1 / factor;

    return {
      display: `${formatConversionNumber(unitsPerBase)} ${selectedLabel} = 1 ${baseLabel}`,
      detail: `Stored as 1 ${selectedLabel} = ${formatConversionNumber(factor)} ${baseLabel}`,
    };
  }

  return {
    display: `1 ${selectedLabel} = ${formatConversionNumber(factor)} ${baseLabel}`,
    detail: null,
  };
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

function rowSignature(rows: ItemUomDto[]): string {
  return rows
    .map((row) => [
      row.uomId,
      row.toBaseFactor ?? "",
      row.isBase ? 1 : 0,
      row.isPurchase ? 1 : 0,
      row.isIssue ? 1 : 0,
      row.isRecipe ? 1 : 0,
      row.isConsume ? 1 : 0,
      row.isCount ? 1 : 0,
      row.isActive !== false ? 1 : 0,
    ].join(":"))
    .join("|");
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
  const { tx } = useI18n();
  const normalizedRows = useMemo(
    () => normalizeRows(baseUomId, uoms, rows),
    [baseUomId, uoms, rows]
  );

  const [vmRows, setVmRows] = useState<RowVm[]>(() =>
    normalizedRows.map((x) => toVm(x))
  );

  const [factorText, setFactorText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (rowSignature(rows) === rowSignature(normalizedRows)) return;
    onChange(normalizedRows);
  }, [normalizedRows, onChange, rows]);

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
    () =>
      Boolean(baseUomId) &&
      uoms.some((x) => x.id !== baseUomId && !usedUomIds.has(x.id) && isCompatibleUom(baseUom, x)),
    [baseUom, baseUomId, uoms, usedUomIds]
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

      return uoms.filter((x) => {
        if (x.id === baseUomId) return false;
        if (x.id !== row.uomId && takenByOthers.has(x.id)) return false;
        return isCompatibleUom(baseUom, x);
      });
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
      (x) => x.id !== baseUomId && !usedUomIds.has(x.id) && isCompatibleUom(baseUom, x)
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
  }, [baseUom, baseUomId, commit, uoms, usedUomIds, vmRows]);

  const removeRow = useCallback(
    (key: string) => {
      const row = vmRows.find((x) => x._key === key);
      if (!row || row.isBase) return;

      if (row.isActive !== false) {
        updateRow(key, {
          isActive: false,
          isPurchase: false,
          isIssue: false,
          isRecipe: false,
          isConsume: false,
          isCount: false,
        });
        return;
      }

      commit(vmRows.filter((x) => x._key !== key));

      setFactorText((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [commit, updateRow, vmRows]
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
          <div className="uom-grid__title">{tx("Allowed Units & Conversions")}</div>
          <div className="uom-grid__subtitle">
            {tx("Define the contents of one purchasing unit for this item. Pack sizes are item-specific.")}
          </div>

          {baseUom ? (
            <div className="uom-chip">
              <span className="uom-chip__label">{tx("Base unit")}</span>
              <strong>{baseUom.code || baseUom.name}</strong>
              <span className="uom-chip__separator">-</span>
              <span>{unitName(baseUom)}</span>
            </div>
          ) : (
            <div className="uom-chip uom-chip--warn">
              {tx("Select a base UOM first.")}
            </div>
          )}
        </div>

        <button
          type="button"
          className="inv-btn inv-btn--outline inv-btn--sm"
          disabled={!canAdd}
          onClick={addRow}
        >
          + {tx("Add Unit")}
        </button>
      </div>

      <div className="uom-factor-hint" role="note">
        {tx("Pcs means individual pieces. Pack means a bundle of pieces. Box / Carton means an outer container. For items counted individually, use Pcs as the base stock unit.")}
        {" "}{tx("Enter every conversion directly in the base unit: 50 Pcs per Pack and 1000 Pcs per Carton, not 20 packs per carton.")}
        {" "}{tx("Catering Package refers to an event offering; its quantities come from its included items and guest count.")}
      </div>
      <div className="uom-table-wrap">
        <div className="uom-table-scroll">
          <table className="uom-table">
            <thead>
              <tr>
                <th>{tx("Unit")}</th>
                <th>{baseUom ? `${unitName(baseUom)} ${tx("in 1 selected unit")}` : tx("Base quantity in 1 selected unit")}</th>
                <th>{tx("Purchase")}</th>
                <th>{tx("Issue")}</th>
                <th>{tx("Recipe")}</th>
                <th>{tx("Consume")}</th>
                <th>{tx("Count")}</th>
                <th>{tx("Active")}</th>
                <th>{tx("Example")}</th>
                <th className="right">{tx("Actions")}</th>
              </tr>
            </thead>

            <tbody>
              {!baseUomId ? (
                <tr>
                  <td colSpan={10} className="uom-table__empty">
                    {tx("Select a base UOM to automatically create the required base conversion row.")}
                  </td>
                </tr>
              ) : (
                vmRows.map((row) => {
                  const selectedUom = uomById.get(row.uomId);
                  const text = factorText[row._key] ?? "";
                  const example = baseUom && selectedUom
                    ? buildConversionExample(row, text, selectedUom, baseUom)
                    : null;
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
                            {tx("Base row required for conversion.")}
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
                          aria-label={selectedUom && baseUom ? `1 ${unitName(selectedUom)} contains how many ${unitName(baseUom)}?` : tx("Base quantity in one unit")}
                          value={row.isBase ? "1" : text}
                          disabled={row.isBase}
                          onChange={(e) => onFactorChange(row._key, e.target.value)}
                          onBlur={() => onFactorBlur(row._key)}
                        />

                        <div className={`uom-factor-hint${invalid ? " uom-factor-hint--error" : ""}`}>
                          {row.isBase ? tx("Locked to 1.") : tx(compatibilityHint(baseUom))}
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
                        {example ? (
                          <span className="uom-example">
                            <strong>{example.display}</strong>
                            {example.detail && (
                              <span className="uom-factor-hint">
                                {example.detail}
                              </span>
                            )}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="right">
                        <button
                          type="button"
                          className="inv-btn inv-btn--outline inv-btn--sm"
                          disabled={row.isBase}
                          onClick={() => removeRow(row._key)}
                        >
                          {row.isBase
                            ? tx("Locked")
                            : row.isActive === false
                              ? tx("Remove")
                              : tx("Deactivate")}
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
          {tx("Purchase GRN requires")} <strong>{tx("Purchase")}</strong>. {tx("SIV/store issue requires")} {" "}
          <strong>{tx("Issue")}</strong>. {tx("Recipe/COGS posting requires")} {" "}
          <strong>{tx("Consume")}</strong>. {tx("Physical count requires")} <strong>{tx("Count")}</strong>. {tx("The factor is always 1 selected unit = N base units.")}
        </div>
      </div>
    </div>
  );
}
