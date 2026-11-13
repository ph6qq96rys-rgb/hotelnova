import { useEffect, useState } from "react";
import { http } from "../../../api/http";
import { useAuth } from "../../../auth/AuthProvider";
import { Button } from "../../../components/ui/button";
import { NumberField, TextAreaField, readApiError } from "../sales/ui";
import type { CateringEventDto } from "../api/cateringManagementApi";

type Completion = { serviceId: string; guestsServed: number; completedAtUtc: string; notes?: string };
export function EventServiceProgress({ event, onChanged }: { event: CateringEventDto; onChanged: () => void }) {
  const { hasPermission } = useAuth();
  const [completed, setCompleted] = useState<Completion[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [guests, setGuests] = useState<number | "">(0);
  const [notes, setNotes] = useState("");
  const base = `/companies/${event.companyId}/catering/events/${event.id}/services`;
  useEffect(() => {
    const c = new AbortController();
    http.get<Completion[]>(base, { signal: c.signal }).then(r => setCompleted(r.data)).catch(e => { if (!c.signal.aborted) setError(readApiError(e)); });
    return () => c.abort();
  }, [base]);
  const save = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await http.post<Completion>(`${base}/${editing}/complete`, { guestsServed: Number(guests), notes: notes.trim() || null });
      setCompleted(rows => [...rows.filter(x => x.serviceId !== data.serviceId), data]); setEditing(null); onChanged();
    } catch (e) { setError(readApiError(e)); } finally { setBusy(false); }
  };
  const closed = ["completed", "cancelled"].includes(String(event.status).toLowerCase());
  return <section className="co-card"><h3>Meal service completion</h3>
    {error && <p role="alert" className="co-notice">{error}</p>}
    {event.services?.map(s => { const actual = completed.find(x => x.serviceId === s.id); return <div key={s.id} className="co-toolbar">
      <span>{s.name} · {new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", dateStyle: "medium", timeStyle: "short" }).format(new Date(s.serviceAtUtc))} · {actual ? `${actual.guestsServed} guests served` : `${s.snapshot.guestCount} guests booked`}</span>
      {actual ? <span>Completed{actual.notes ? ` · ${actual.notes}` : ""}</span> : !closed && hasPermission("catering.events.manage") && <Button variant="outline" disabled={busy || new Date(s.serviceAtUtc) > new Date()} onClick={() => { setEditing(s.id); setGuests(s.snapshot.guestCount); setNotes(""); }}>Record completion</Button>}
      {editing === s.id && <fieldset><legend>{s.name}: actual service</legend>
        <NumberField label="Guests served" min={0} value={guests} onChange={setGuests} />
        <TextAreaField label="Notes / explanation for guest-count changes" value={notes} onChange={setNotes} />
        <p>Completion records are final. Verify the actual guest count before saving.</p>
        <Button disabled={busy || guests === "" || (guests !== s.snapshot.guestCount && !notes.trim())} onClick={save}>Save completion</Button>
        <Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
      </fieldset>}
    </div>; })}
  </section>;
}
