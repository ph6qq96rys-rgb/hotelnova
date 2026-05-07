import type { InventoryAdjustmentLineDto } from "../types";

type Props = {
  lines: InventoryAdjustmentLineDto[];
  onChange: (lines: InventoryAdjustmentLineDto[]) => void;
};

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function AdjustmentLineEditor({ lines, onChange }: Props) {
  // ✅ Update Line (SAFE + AUDIT READY)
  const updateLine = (
    index: number,
    patch: Partial<InventoryAdjustmentLineDto>
  ) => {
    const existing = lines[index];
    if (!existing) return;

    const updated: InventoryAdjustmentLineDto = {
      ...existing,
      ...patch,
    };

    // ✅ Always recalc adjustment (never trust UI)
    updated.adjustmentQty =
      safeNumber(updated.countedQty) - safeNumber(updated.systemQty);

    const next = [...lines];
    next[index] = updated;

    onChange(next);
  };

  // ✅ Add Line (FULL DEFAULT STRUCTURE)
  const addLine = () => {
    const newLine: InventoryAdjustmentLineDto = {
      itemId: "",
      itemName: "",
      stockLocationId: "",
      stockLocationName: "",
      uomId: "",
      uomName: "",
      systemQty: 0,
      countedQty: 0,
      adjustmentQty: 0,
      notes: "",
    };

    onChange([...lines, newLine]);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {/* HEADER */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Adjustment Lines</h3>
        <button type="button" className="btn btn-primary" onClick={addLine}>
          + Add Line
        </button>
      </div>

      {/* TABLE */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="p-2 text-left">Item</th>
            <th className="p-2 text-left">UOM</th>
            <th className="p-2 text-right">System Qty</th>
            <th className="p-2 text-right">Counted Qty</th>
            <th className="p-2 text-right">Adjustment</th>
            <th className="p-2 text-left">Notes</th>
            <th className="p-2"></th>
          </tr>
        </thead>

        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-slate-400">
                No lines added yet
              </td>
            </tr>
          )}

          {lines.map((line, index) => (
            <tr key={index} className="border-b">
              {/* ITEM */}
              <td className="p-2">
                <input
                  className="input w-full"
                  value={line.itemName ?? line.itemId ?? ""}
                  placeholder="Select Item"
                  onChange={(e) =>
                    updateLine(index, {
                      itemId: e.target.value,
                      itemName: e.target.value,
                    })
                  }
                />
              </td>

              {/* UOM */}
              <td className="p-2">
                <input
                  className="input w-full"
                  value={line.uomName ?? line.uomId ?? ""}
                  placeholder="UOM"
                  onChange={(e) =>
                    updateLine(index, {
                      uomId: e.target.value,
                      uomName: e.target.value,
                    })
                  }
                />
              </td>

              {/* SYSTEM QTY */}
              <td className="p-2">
                <input
                  type="number"
                  className="input w-full text-right"
                  value={line.systemQty ?? 0}
                  onChange={(e) =>
                    updateLine(index, {
                      systemQty: safeNumber(e.target.value),
                    })
                  }
                />
              </td>

              {/* COUNTED QTY */}
              <td className="p-2">
                <input
                  type="number"
                  className="input w-full text-right"
                  value={line.countedQty ?? 0}
                  onChange={(e) =>
                    updateLine(index, {
                      countedQty: safeNumber(e.target.value),
                    })
                  }
                />
              </td>

              {/* ADJUSTMENT */}
              <td
                className={`p-2 text-right font-semibold ${
                  (line.adjustmentQty ?? 0) > 0
                    ? "text-green-600"
                    : (line.adjustmentQty ?? 0) < 0
                    ? "text-red-600"
                    : ""
                }`}
              >
                {line.adjustmentQty ?? 0}
              </td>

              {/* NOTES */}
              <td className="p-2">
                <input
                  className="input w-full"
                  value={line.notes ?? ""}
                  placeholder="Optional notes"
                  onChange={(e) =>
                    updateLine(index, { notes: e.target.value })
                  }
                />
              </td>

              {/* REMOVE */}
              <td className="p-2 text-right">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => removeLine(index)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}