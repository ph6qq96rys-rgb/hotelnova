// src/features/inventory/items/components/UomConversionGrid.tsx
//
// Controlled grid for managing per-item UOM conversion lines.
// All styling via inventory-items.css (.uom-* classes) —
// zero inline style objects.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemUomDto } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UomOption {
  id:   string;
  code: string;
  name: string;
}

interface Props {
  baseUomId?: string;
  uoms:       UomOption[];
  rows:       ItemUomDto[];
  onChange:   (rows: ItemUomDto[]) => void;
}

type RowVm = ItemUomDto & { _key: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toVm   = (row: ItemUomDto, key?: string): RowVm => ({ ...row, _key: key ?? makeKey() });
const fromVm = ({ _key: _k, ...dto }: RowVm): ItemUomDto => dto;

function isValidFactor(value: string): boolean {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n > 0;
}

function resolvedFactor(row: ItemUomDto, factorText: string): number {
  if (isValidFactor(factorText)) return Number(factorText);
  return typeof row.toBaseFactor === "number" && Number.isFinite(row.toBaseFactor)
    ? row.toBaseFactor
    : 1;
}

function uomLabel(uom: UomOption): string {
  return uom.code ? `${uom.code} — ${uom.name}` : uom.name;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UomConversionGrid({ baseUomId, uoms, rows, onChange }: Props) {
  const [vmRows,       setVmRows]       = useState<RowVm[]>(() => rows.map((r) => toVm(r)));
  const [factorText,   setFactorText]   = useState<Record<string, string>>({});

  const uomById  = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);
  const baseUom  = useMemo(() => (baseUomId ? uomById.get(baseUomId) : undefined), [baseUomId, uomById]);
  const usedIds  = useMemo(() => new Set(vmRows.map((r) => r.uomId).filter(Boolean)), [vmRows]);
  const canAdd   = useMemo(() => !!baseUomId && uoms.some((u) => u.id !== baseUomId && !usedIds.has(u.id)), [baseUomId, uoms, usedIds]);

  // Sync vmRows when parent rows change (factor hydration from parent).
  useEffect(() => {
    setVmRows((current) => {
      const seen = new Set<string>();
      return rows.map((row) => {
        const match =
          current.find((vm) => !seen.has(vm._key) && vm.uomId === row.uomId && vm.code === row.code) ??
          current.find((vm) => !seen.has(vm._key) && vm.uomId === row.uomId);
        if (!match) return toVm(row);
        seen.add(match._key);
        return toVm(row, match._key);
      });
    });
  }, [rows]);

  // Keep factorText map in sync with vmRows (add missing, prune stale).
  useEffect(() => {
    setFactorText((prev) => {
      const next = { ...prev };
      const activeKeys = new Set(vmRows.map((r) => r._key));
      vmRows.forEach((row) => {
        if (next[row._key] !== undefined) return;
        next[row._key] = typeof row.toBaseFactor === "number" && Number.isFinite(row.toBaseFactor)
          ? String(row.toBaseFactor)
          : "";
      });
      Object.keys(next).forEach((k) => { if (!activeKeys.has(k)) delete next[k]; });
      return next;
    });
  }, [vmRows]);

  // ── Internal commit ────────────────────────────────────────────────────────

  const commit = useCallback((next: RowVm[]) => {
    setVmRows(next);
    onChange(next.map(fromVm));
  }, [onChange]);

  // ── Row choices ────────────────────────────────────────────────────────────

  const choicesFor = useCallback((key: string): UomOption[] => {
    const row = vmRows.find((r) => r._key === key);
    if (!row) return [];
    const takenByOthers = new Set(vmRows.filter((r) => r._key !== key).map((r) => r.uomId).filter(Boolean));
    return uoms.filter((u) => u.id !== baseUomId && (u.id === row.uomId || !takenByOthers.has(u.id)));
  }, [baseUomId, uoms, vmRows]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateRow = useCallback((key: string, patch: Partial<ItemUomDto>) => {
    const idx = vmRows.findIndex((r) => r._key === key);
    if (idx < 0) return;
    if (patch.uomId === baseUomId) return; // can't assign base UOM to a conversion row

    const next = [...vmRows];
    const cur  = next[idx];

    // Enforce single issue UOM
    if (patch.isIssue === true) {
      next.forEach((r, i) => { if (i !== idx && r.isIssue) next[i] = { ...r, isIssue: false }; });
    }

    const updated: RowVm = { ...cur, ...patch, _key: cur._key };

    if (patch.uomId) {
      if (next.some((r, i) => i !== idx && r.uomId === patch.uomId)) return; // duplicate
      const meta = uomById.get(patch.uomId);
      if (meta) { updated.code = meta.code; updated.name = meta.name; }
    }

    next[idx] = updated;
    commit(next);
  }, [baseUomId, commit, uomById, vmRows]);

  const addRow = useCallback(() => {
    const nextUom = uoms.find((u) => u.id !== baseUomId && !usedIds.has(u.id));
    if (!nextUom) return;
    const row: RowVm = { _key: makeKey(), uomId: nextUom.id, code: nextUom.code, name: nextUom.name, toBaseFactor: 0, isBase: false, isIssue: false, isActive: true };
    commit([...vmRows, row]);
    setFactorText((prev) => ({ ...prev, [row._key]: "" }));
  }, [baseUomId, commit, uoms, usedIds, vmRows]);

  const removeRow = useCallback((key: string) => {
    commit(vmRows.filter((r) => r._key !== key));
    setFactorText((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }, [commit, vmRows]);

  // ── Factor input handlers ──────────────────────────────────────────────────

  const onFactorChange = useCallback((key: string, value: string) => {
    setFactorText((prev) => ({ ...prev, [key]: value }));
    if (isValidFactor(value)) updateRow(key, { toBaseFactor: Number(value) });
  }, [updateRow]);

  const onFactorBlur = useCallback((key: string) => {
    const row = vmRows.find((r) => r._key === key);
    if (!row) return;
    const text = factorText[key] ?? "";
    if (!isValidFactor(text)) {
      const fallback = typeof row.toBaseFactor === "number" && row.toBaseFactor > 0 ? String(row.toBaseFactor) : "";
      setFactorText((prev) => ({ ...prev, [key]: fallback }));
    } else {
      const normalized = String(Number(text));
      setFactorText((prev) => ({ ...prev, [key]: normalized }));
      updateRow(key, { toBaseFactor: Number(normalized) });
    }
  }, [factorText, updateRow, vmRows]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="uom-grid">
      {/* Header */}
      <div className="uom-grid__header">
        <div className="uom-grid__meta">
          <div className="uom-grid__title">Allowed Units &amp; Conversions</div>
          <div className="uom-grid__subtitle">Define how each additional unit converts to the base unit.</div>

          {baseUom ? (
            <div className="uom-chip">
              <span className="uom-chip__label">Base unit</span>
              <strong>{baseUom.code || baseUom.name}</strong>
              <span style={{ opacity: 0.4 }}>—</span>
              <span>{baseUom.name}</span>
            </div>
          ) : (
            <div className="uom-chip uom-chip--warn">Select a base UOM first.</div>
          )}
        </div>

        <button
          type="button"
          className="inv-btn inv-btn--outline inv-btn--sm"
          disabled={!canAdd}
          onClick={addRow}
          title={!baseUomId ? "Select a base UOM first" : !canAdd ? "No more units available" : "Add unit"}
        >
          + Add Unit
        </button>
      </div>

      {/* Table */}
      <div className="uom-table-wrap">
        <div style={{ overflowX: "auto" }}>
          <table className="uom-table">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Unit</th>
                <th style={{ width: 220 }}>To Base Factor</th>
                <th>Example</th>
                <th className="right" style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {vmRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="uom-table__empty">
                    No additional units. Items using only the base unit can leave this empty.
                  </td>
                </tr>
              ) : vmRows.map((row) => {
                const selectedUom = uomById.get(row.uomId);
                const text        = factorText[row._key] ?? "";
                const invalid     = text.trim() !== "" && !isValidFactor(text);

                return (
                  <tr key={row._key}>
                    {/* Unit select + toggles */}
                    <td>
                      <select
                        className={`inv-input${!baseUomId ? " inv-input--invalid" : ""}`}
                        value={row.uomId}
                        disabled={!baseUomId}
                        onChange={(e) => updateRow(row._key, { uomId: e.target.value })}
                      >
                        {choicesFor(row._key).map((uom) => (
                          <option key={uom.id} value={uom.id}>{uomLabel(uom)}</option>
                        ))}
                      </select>

                      <div className="uom-cell-toggles">
                        <label className="uom-toggle-label">
                          <input
                            type="checkbox"
                            checked={Boolean(row.isIssue)}
                            disabled={!baseUomId}
                            onChange={(e) => updateRow(row._key, { isIssue: e.target.checked })}
                          />
                          Issue UOM
                        </label>
                        <label className="uom-toggle-label">
                          <input
                            type="checkbox"
                            checked={row.isActive !== false}
                            disabled={!baseUomId}
                            onChange={(e) => updateRow(row._key, { isActive: e.target.checked })}
                          />
                          Active
                        </label>
                      </div>
                    </td>

                    {/* Factor */}
                    <td>
                      <input
                        type="number"
                        className={`inv-input${invalid ? " inv-input--invalid" : ""}`}
                        min={0.0000001}
                        step="0.0001"
                        inputMode="decimal"
                        value={text}
                        disabled={!baseUomId}
                        onChange={(e) => onFactorChange(row._key, e.target.value)}
                        onBlur={() => onFactorBlur(row._key)}
                      />
                      <div className={`uom-factor-hint${invalid ? " uom-factor-hint--error" : ""}`}>
                        Must be &gt; 0. Example: KG → G = 1000
                      </div>
                    </td>

                    {/* Example */}
                    <td>
                      {baseUom && selectedUom ? (
                        <span className="uom-example">
                          1 <b>{selectedUom.code || selectedUom.name}</b>
                          {" = "}
                          <b>{resolvedFactor(row, text)}</b>
                          {" "}
                          <b>{baseUom.code || baseUom.name}</b>
                        </span>
                      ) : "—"}
                    </td>

                    {/* Remove */}
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="inv-btn inv-btn--outline inv-btn--sm"
                        disabled={!baseUomId}
                        onClick={() => removeRow(row._key)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="uom-table-footer">
          Tip: mark exactly one row as <strong>Issue UOM</strong> to control the unit used during store requests and stock movements.
        </div>
      </div>
    </div>
  );
}