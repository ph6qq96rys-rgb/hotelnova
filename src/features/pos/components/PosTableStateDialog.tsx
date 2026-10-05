import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import type { PosFloorTableDto, TableServiceState } from "../api/posServiceApi";
import { TABLE_STATUS_TEXT } from "../utils/posTables";
import { PosDialog } from "./PosDialog";

type Props = {
  table: (PosFloorTableDto & { area?: string }) | null;
  busy: boolean;
  /** Reserve or take a table out of use (supervisors and floor managers). */
  canManage: boolean;
  onClose: () => void;
  onSave: (state: TableServiceState, note: string) => void;
  /** Offered for a free table that may be seated: start an order there now. */
  onSeat?: () => void;
};

const OPTIONS: Array<{ state: TableServiceState; label: string; managed: boolean }> = [
  { state: "available", label: "Available", managed: false },
  { state: "needsCleaning", label: "Needs cleaning", managed: false },
  { state: "reserved", label: "Reserved", managed: true },
  { state: "unavailable", label: "Unavailable", managed: true },
];

/** Shows a table's status and lets staff mark it clean, dirty, reserved or out of use. */
export function PosTableStateDialog({ table, busy, canManage, onClose, onSave, onSeat }: Props) {
  const { tx } = useI18n();
  const [state, setState] = useState<TableServiceState>("available");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!table) return;
    setState(table.serviceState);
    setNote(table.serviceNote ?? "");
  }, [table]);

  if (!table) return null;
  const hasOrder = table.tickets.length > 0;
  // Reserved / out-of-use tables are released only by someone who may set those states.
  const lockedByManager = !canManage && (table.serviceState === "reserved" || table.serviceState === "unavailable");
  const allowed = (option: (typeof OPTIONS)[number]) =>
    !(option.managed && !canManage) && !(hasOrder && option.managed) && !lockedByManager;
  const changed = state !== table.serviceState || (note.trim() || "") !== (table.serviceNote ?? "");

  return (
    <PosDialog open title={`${tx("Table")} ${table.number}${table.area ? ` · ${table.area}` : ""}`} busy={busy}
      description={`${tx(TABLE_STATUS_TEXT[table.status])}${table.serviceNote ? ` · ${table.serviceNote}` : ""}${table.serviceStateChangedBy
        ? ` · ${tx("set by {name} at {time}", { name: table.serviceStateChangedBy, time: formatAppDateTime(table.serviceStateChangedAtUtc) })}` : ""}`}
      confirmText={tx("Save status")} confirmDisabled={!changed || lockedByManager}
      onConfirm={() => onSave(state, note.trim())} onClose={onClose}>
      <div className="rpos-hold">
        <div className="rpos-chip-row" role="radiogroup" aria-label={tx("Table status")}>
          {OPTIONS.map((option) => (
            <Button key={option.state} type="button" role="radio" aria-checked={state === option.state} disabled={!allowed(option)}
              variant={state === option.state ? "default" : "outline"} className={`rpos-state-chip rpos-table--${option.state}`}
              onClick={() => setState(option.state)}>
              {tx(option.label)}
            </Button>
          ))}
        </div>
        {state === "reserved" || state === "unavailable" ? (
          <label className="rpos-field">
            <span>{tx(state === "reserved" ? "Reserved for" : "Reason")}</span>
            <Input value={note} maxLength={200} disabled={!canManage} placeholder={tx(state === "reserved" ? "Guest name and time" : "e.g. broken chair")}
              onChange={(e) => setNote(e.target.value)} />
          </label>
        ) : null}
        {lockedByManager ? <p className="rpos-muted">{tx("Only a supervisor can release a reserved or out-of-use table.")}</p> : null}
        {hasOrder ? <p className="rpos-muted">{tx("This table has an open order, so it cannot be reserved or taken out of use.")}</p> : null}
        {onSeat && table.serviceState === "available" && !hasOrder ? (
          <Button type="button" variant="outline" onClick={onSeat}>{tx("Start an order at this table")}</Button>
        ) : null}
      </div>
    </PosDialog>
  );
}
