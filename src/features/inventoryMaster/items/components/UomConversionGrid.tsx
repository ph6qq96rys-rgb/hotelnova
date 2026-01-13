import { useMemo } from "react";

type Uom = { id: string; code: string; name: string };
export type AllowedUomRow = { uomId: string; toBaseFactor: number };

export default function UomConversionGrid(props: {
  baseUomId?: string;
  uoms: Uom[];
  rows: AllowedUomRow[];
  onChange: (rows: AllowedUomRow[]) => void;
}) {
  const { baseUomId, uoms, rows, onChange } = props;

  const baseUom = useMemo(() => uoms.find(u => u.id === baseUomId), [uoms, baseUomId]);
  const rowUoms = useMemo(
    () =>
      rows.map(r => ({
        ...r,
        uom: uoms.find(u => u.id === r.uomId),
      })),
    [rows, uoms]
  );

  const availableChoices = useMemo(() => {
    const used = new Set(rows.map(r => r.uomId));
    return uoms.filter(u => !used.has(u.id) && u.id !== baseUomId);
  }, [uoms, rows, baseUomId]);

  const addRow = () => {
    const first = availableChoices[0];
    if (!first) return;
    onChange([...rows, { uomId: first.id, toBaseFactor: 1 }]);
  };

  const removeRow = (uomId: string) => onChange(rows.filter(r => r.uomId !== uomId));

  const updateRow = (idx: number, patch: Partial<AllowedUomRow>) => {
    const next = [...rows];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Allowed Units & Conversions</div>
          <div className="text-xs text-slate-500">
            Define how each unit converts into the base unit.
          </div>
          {baseUom ? (
            <div className="mt-2 text-xs text-slate-600">
              Base unit: <span className="font-semibold">{baseUom.code}</span> — {baseUom.name}
            </div>
          ) : (
            <div className="mt-2 text-xs text-amber-600">
              Select a base UOM first to enable conversions.
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn"
          disabled={!baseUomId || availableChoices.length === 0}
          onClick={addRow}
          title={!baseUomId ? "Select base UOM first" : undefined}
        >
          + Add unit
        </button>
      </div>

      <div className="overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 w-[320px]">Unit</th>
              <th className="text-left px-3 py-2 w-[200px]">To base factor</th>
              <th className="text-left px-3 py-2">Example</th>
              <th className="px-3 py-2 w-[80px]"></th>
            </tr>
          </thead>

          <tbody>
            {rowUoms.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={4}>
                  No additional units. If you use only the base unit, you can leave this empty.
                </td>
              </tr>
            ) : (
              rowUoms.map((r, idx) => {
                const uom = r.uom;
                const factor = r.toBaseFactor ?? 1;

                return (
                  <tr key={`${r.uomId}-${idx}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <select
                        className="input"
                        value={r.uomId}
                        onChange={e => updateRow(idx, { uomId: e.target.value })}
                      >
                        {/* current choice */}
                        {uom && <option value={uom.id}>{uom.code} — {uom.name}</option>}

                        {/* other choices */}
                        {availableChoices
                          .filter(x => x.id !== r.uomId)
                          .map(x => (
                            <option key={x.id} value={x.id}>
                              {x.code} — {x.name}
                            </option>
                          ))}
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.0001"
                        value={String(factor)}
                        onChange={e => updateRow(idx, { toBaseFactor: Number(e.target.value) })}
                      />
                      <div className="text-[11px] text-slate-500 mt-1">
                        Must be &gt; 0 (e.g., KG→1000 for base G).
                      </div>
                    </td>

                    <td className="px-3 py-2 text-slate-700">
                      {baseUom && uom ? (
                        <span className="text-xs">
                          1 {uom.code} = <span className="font-semibold">{factor}</span> {baseUom.code}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <button type="button" className="btn" onClick={() => removeRow(r.uomId)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
