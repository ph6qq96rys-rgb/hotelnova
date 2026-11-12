import { useEffect, useState } from "react";
import { http } from "../../../../api/http";
import { useAppScope } from "../../../../app/useAppScope";
import { useAuth } from "../../../../auth/AuthProvider";
import { Button } from "../../../../components/ui/button";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { useErpNavigate } from "../../../../routes/useErpNavigation";

type Row = Record<string, any>;
// datetime-local values go to the server without an offset; it reads them in the company time zone.
const wallClock = (value: string) => (value.length === 16 ? value + ":00" : value);
// A kiosk that has not called in for 15 minutes is probably off or offline (it sends a heartbeat every 5).
const OFFLINE_AFTER_MS = 15 * 60 * 1000;
function lastSeen(d: Row) {
  if (!d.isActive) return "Disabled";
  if (!d.paired) return d.pairingExpiresAtUtc && new Date(d.pairingExpiresAtUtc).getTime() > Date.now() ? "Awaiting activation" : "Activation code expired";
  if (!d.lastSeenAtUtc) return "Paired · not seen yet";
  const age = Date.now() - new Date(d.lastSeenAtUtc).getTime();
  return (age > OFFLINE_AFTER_MS ? "Offline · last seen " : "Online · ") + new Date(d.lastSeenAtUtc).toLocaleString();
}
type Setup = {
  branchId: string; branchName: string; activeEmployees: number; withoutPin: number; temporaryPin: number; lockedPin: number; locationSet: boolean;
  kiosks: { id: string; name: string; isActive: boolean; paired: boolean; online: boolean; lastSeenAtUtc?: string | null; requirePhoto: boolean }[];
  policy: { name: string; branchSpecific: boolean; timeZoneId: string; standardDailyHours: number; lateGraceMinutes: number; maxSessionHours: number; allowSplitShifts: boolean; duplicateScanGuardMinutes: number; allowManualEntry: boolean };
  steps: { key: string; title: string; done: boolean; detail: string }[];
};
const PIN_LABEL: Record<string, string> = { NotSet: "No PIN", TemporaryPin: "Temporary PIN not yet changed", Locked: "Locked" };

/** The activation code, its QR code and link, with the steps to follow on the branch device. */
function ActivationPanel({ activation, onHide }: { activation: Row; onHide: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(activation.expiresAtUtc).getTime() - Date.now()));
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setLeft(Math.max(0, new Date(activation.expiresAtUtc).getTime() - Date.now())), 1000);
    return () => clearInterval(timer);
  }, [activation.expiresAtUtc]);
  const minutes = Math.floor(left / 60000), seconds = Math.floor((left % 60000) / 1000);
  return <section className="card" data-testid="kiosk-activation" style={{ padding: 16, marginTop: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
    {activation.activationQr && <img src={activation.activationQr} alt="Kiosk activation QR code" style={{ width: 200, height: 200, imageRendering: "pixelated" }} />}
    <div style={{ flex: "1 1 280px", minWidth: 0 }}>
      <h3 style={{ marginTop: 0 }}>Activate the branch device</h3>
      <p style={{ margin: "4px 0" }}>Activation code</p>
      <div style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 700, letterSpacing: 4 }}>{activation.pairingCode}</div>
      <p style={{ color: left > 0 ? "var(--text-muted)" : "var(--danger)" }}>{left > 0 ? `Valid for ${minutes}:${String(seconds).padStart(2, "0")}, once.` : "Expired. Issue a new activation code."}</p>
      <ol style={{ paddingLeft: 18, lineHeight: 1.6 }}>
        <li>On the branch tablet or PC, scan the QR code with its camera, or open <strong>{window.location.origin}/attendance-kiosk</strong>.</li>
        <li>If you opened the page yourself, type the activation code.</li>
        <li>The device signs out of ERP and becomes the attendance kiosk. Use the device's kiosk or guided-access mode to keep it on that page.</li>
      </ol>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {activation.activationUrl && <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(activation.activationUrl).then(() => setCopied(true)).catch(() => undefined); }}>{copied ? "Link copied" : "Copy activation link"}</Button>}
        <Button variant="ghost" size="sm" onClick={onHide}>Hide code</Button>
      </div>
    </div>
  </section>;
}

export default function AttendanceKioskAdminPage() {
  const { companyId, branchId } = useAppScope();
  const navigate = useErpNavigate();
  const { hasPermission, isSystemAdmin } = useAuth();
  const [tab, setTab] = useState("devices");
  const [devices, setDevices] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [employee, setEmployee] = useState("");
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [activation, setActivation] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [photo, setPhoto] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [newSession, setNewSession] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkRows, setBulkRows] = useState<{ employeeId: string; label: string; clockIn: string; clockOut: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [mixed, setMixed] = useState(true);
  const [retention, setRetention] = useState(30);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [branches, setBranches] = useState<Row[]>([]);
  const [setupBranch, setSetupBranch] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [moreOptions, setMoreOptions] = useState(false);
  const [attention, setAttention] = useState<Row[] | null>(null);
  const [confirmMove, setConfirmMove] = useState<string | null>(null);
  const base = `/companies/${companyId}/hr/kiosks`;
  const canDevices = hasPermission("hr.attendance.kiosks.manage");
  const canPin = hasPermission("hr.attendance.pins.reset");
  const canAudit = hasPermission("hr.attendance.audit.view");
  const canCorrections = hasPermission("hr.attendance.corrections.request") && !isSystemAdmin;
  const canDecide = hasPermission("hr.attendance.corrections.approve") && !isSystemAdmin;
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setNotice("");
    try { await work(); } catch (e: any) {
      setNotice(e?.response?.data?.message ?? e?.response?.data?.error ?? "Unable to complete the request.");
    } finally { setBusy(false); setPin(""); }
  }
  const siteBranch = setupBranch || branchId || "";
  async function loadSetup(target = siteBranch) {
    if (!companyId || !target) { setSetup(null); return; }
    const { data } = await http.get<Setup>(base + "/setup", { params: { branchId: target } });
    setSetup(data);
    setName(current => current || `${data.branchName} kiosk ${data.kiosks.filter(k => k.isActive).length + 1}`);
  }
  async function load() {
    if (!companyId) return;
    if (tab === "devices" && canDevices) { setDevices((await http.get(base)).data); await loadSetup(); }
    else if (branchId && ((tab === "corrections" && canCorrections) || (tab === "audit" && canAudit))) {
      setRows((await http.get(base + "/" + tab, { params: { branchId } })).data);
    }
  }
  useEffect(() => { setRows([]); setPeople([]); setEmployee(""); setActivation(null); setEditing(null); setSelected([]); setBulkRows([]); void run(load); }, [companyId, branchId, tab]);
  function summarize(data: Row, verb: string) {
    const failed = (data?.results ?? []).filter((r: Row) => !r.success);
    const done = data?.submitted ?? data?.decided ?? 0;
    return `${done} ${verb}.` + (failed.length ? ` Not done: ` + failed.map((r: Row) => `${r.employeeNo ?? ""} ${r.message}`.trim()).join("; ") : "");
  }
  useEffect(() => { if (!canDevices && canPin) setTab("pins"); }, [canDevices, canPin]);
  useEffect(() => {
    if (!companyId || !canDevices) return;
    http.get(base + "/branches").then(r => setBranches(r.data ?? [])).catch(() => setBranches([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, canDevices]);
  async function loadAttention() {
    if (!branchId) return;
    await run(async () => { setAttention((await http.get(base + "/pins/attention", { params: { branchId } })).data); });
  }
  useEffect(() => {
    if (!activation) return;
    const delay = Math.max(0, new Date(activation.expiresAtUtc).getTime() - Date.now());
    const timer = setTimeout(() => setActivation(null), delay);
    return () => clearTimeout(timer);
  }, [activation]);
  async function find() {
    await run(async () => {
      setPeople((await http.get(base + "/employees", { params: { branchId, q: query } })).data);
    });
  }
  const picker = <div className="form-row">
    <label>Find employee<input className="form-control" value={query} onChange={e => setQuery(e.target.value)} placeholder="Employee number or first name" /></label>
    <button className="btn btn-secondary" disabled={busy || !branchId || !query.trim()} onClick={() => void find()}>Search</button>
    <label>Employee<select className="form-control" value={employee} onChange={e => setEmployee(e.target.value)}><option value="">Select employee</option>{people.map(p => <option key={p.id} value={p.id}>{p.employeeNo} — {p.name}{p.pinStatus === "Locked" ? " (PIN locked)" : p.pinStatus === "NotSet" ? " (no PIN)" : ""}</option>)}</select></label>
  </div>;
  return <div className="page">
    <div className="page-header"><div><div className="page-kicker">Human Resources · Attendance</div><h1>Attendance kiosks</h1><p>Register branch devices, manage confidential PINs, and review attendance exceptions.</p></div></div>
    <div className="card" style={{ padding: 20 }}>
      <nav style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[[canDevices, "devices", "Devices"], [canPin, "pins", "Employee PINs"], [canCorrections, "corrections", "Corrections"], [canAudit, "audit", "Audit & exceptions"]].filter(x => x[0]).map(x => <button key={String(x[1])} className={"btn " + (tab === x[1] ? "btn-primary" : "btn-secondary")} onClick={() => setTab(String(x[1]))}>{x[2]}</button>)}
      </nav>
      {!branchId && <p role="status">Select a branch in the workspace selector to manage its attendance.</p>}
      {notice && <div className="alert" role="status">{notice}</div>}
      {tab === "devices" && canDevices && <>
        <div className="form-row" style={{ alignItems: "flex-end" }}>
          <label>Branch<Select aria-label="Branch" value={siteBranch} onChange={e => { setSetupBranch(e.target.value); setName(""); void run(() => loadSetup(e.target.value)); }}>
            <option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
        </div>
        {setup && <section className="card" data-testid="kiosk-setup" style={{ padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Set-up at {setup.branchName}</h2>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {setup.steps.map(step => <li key={step.key} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span aria-hidden style={{ fontWeight: 700, color: step.done ? "var(--success)" : "var(--warn)" }}>{step.done ? "✓" : "•"}</span>
              <span><strong>{step.title}.</strong> {step.detail}
                {step.key === "pins" && !step.done && setup.withoutPin > 0 && canPin && <> <Button variant="link" size="sm" onClick={() => { setTab("pins"); }}>Set PINs</Button></>}</span>
            </li>)}
          </ol>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginTop: 14, fontSize: 13 }}>
            <div><dt className="kpi-label">Rules</dt><dd>{setup.policy.name}{setup.policy.branchSpecific ? "" : " (company default)"}</dd></div>
            <div><dt className="kpi-label">Working day</dt><dd>{setup.policy.standardDailyHours} h · late after {setup.policy.lateGraceMinutes} min</dd></div>
            <div><dt className="kpi-label">Missed clock-out after</dt><dd>{setup.policy.maxSessionHours} h</dd></div>
            <div><dt className="kpi-label">Split shifts</dt><dd>{setup.policy.allowSplitShifts ? "Allowed" : "One shift a day"}</dd></div>
            <div><dt className="kpi-label">Double-scan guard</dt><dd>{setup.policy.duplicateScanGuardMinutes} min</dd></div>
            <div><dt className="kpi-label">PINs</dt><dd>{setup.activeEmployees - setup.withoutPin} of {setup.activeEmployees} set{setup.lockedPin ? ` · ${setup.lockedPin} locked` : ""}</dd></div>
          </dl>
          {hasPermission("hr.attendance.manage") && <Button variant="outline" size="sm" style={{ marginTop: 8 }} onClick={() => navigate("hr/attendance/configuration")}>Change attendance rules</Button>}
        </section>}
        <h2>Add a kiosk</h2>
        <div className="form-row"><label>Kiosk name<Input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. Staff entrance" /></label>
          <label>Where it is (optional)<Input value={location} onChange={e => setLocation(e.target.value)} maxLength={200} placeholder="e.g. Back door, next to the lockers" /></label></div>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {photo ? `Takes a photo at every clock-in and clock-out, kept ${retention} days` : "No photo"} · {mixed ? "can close a shift started on Telegram" : "closes only shifts started on a kiosk"}.{" "}
          <Button variant="link" size="sm" onClick={() => setMoreOptions(!moreOptions)}>{moreOptions ? "Hide options" : "Change"}</Button>
        </p>
        {moreOptions && <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <label><input type="checkbox" checked={photo} onChange={e => setPhoto(e.target.checked)} /> Require a photo for clock-in and clock-out (helps stop one employee clocking for another)</label>
          {photo && <label>Keep photos for (days)<input className="form-control" type="number" min={1} max={90} value={retention} onChange={e => setRetention(Number(e.target.value))} /></label>}
          <label><input type="checkbox" checked={mixed} onChange={e => setMixed(e.target.checked)} /> Allow clock-out here after a clock-in on Telegram or another channel</label>
          <label>Device / asset label (optional)<input className="form-control" value={deviceName} onChange={e => setDeviceName(e.target.value)} maxLength={200} /></label>
        </div>}
        <Button disabled={busy || !siteBranch || !name.trim() || retention < 1 || retention > 90} onClick={() => void run(async () => {
          const { data } = await http.post(base, { branchId: siteBranch, name: name.trim(), location: location.trim() || null, device: deviceName.trim() || null, requirePhoto: photo, photoRetentionDays: retention, allowMixedChannels: mixed });
          setActivation(data); setName(""); setLocation(""); setDeviceName(""); await load();
        })}>Add kiosk and show activation code</Button>
        {activation && <ActivationPanel key={activation.pairingCode} activation={activation} onHide={() => setActivation(null)} />}
        <h2 style={{ marginTop: 24 }}>Kiosks</h2>
        <table className="table"><thead><tr><th>Kiosk</th><th>Branch</th><th>Location</th><th>Status</th><th>Photo</th><th /></tr></thead><tbody>{devices.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-muted)" }}>No kiosks yet.</td></tr>}{devices.map(d => <tr key={d.id}><td>{d.name}{d.device ? <small style={{ display: "block", color: "var(--text-muted)" }}>{d.device}</small> : null}</td><td>{d.branchName ?? "—"}</td><td>{d.location || "—"}</td><td>{lastSeen(d)}</td><td>{d.requirePhoto ? `Required · ${d.photoRetentionDays} days` : "Off"}</td><td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing({ ...d })}>Edit</Button>
          <Button variant="outline" size="sm" disabled={busy} title="Use when the device lost its activation, is replaced, or the kiosk was disabled. The current device stops at once." onClick={() => { if (d.paired && d.isActive && confirmMove !== d.id) { setConfirmMove(d.id); setNotice("The device using this kiosk now will stop until it is activated again. Click \"Confirm: stop the current device\" to continue."); return; } setConfirmMove(null); void run(async () => { const { data } = await http.post(base + "/" + d.id + "/pairing"); setActivation(data); await load(); }); }}>{!d.isActive ? "Reactivate" : d.paired ? (confirmMove === d.id ? "Confirm: stop the current device" : "Move to another device") : "Show new activation code"}</Button>
          <button className="btn btn-secondary" disabled={busy || !d.isActive} onClick={() => { if (window.confirm("Disable this kiosk immediately?")) void run(async () => { await http.delete(base + "/" + d.id); await load(); }); }}>Disable</button></td></tr>)}</tbody></table>
        {editing && <section className="alert" style={{ marginTop: 16 }}><h3>Edit {editing.name}</h3>
          <div className="form-row"><label>Kiosk name<Input value={editing.name} maxLength={120} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label><label>Where it is (optional)<Input value={editing.location ?? ""} maxLength={200} onChange={e => setEditing({ ...editing, location: e.target.value })} /></label></div>
          <label><Checkbox checked={editing.allowMixedChannels} onChange={e => setEditing({ ...editing, allowMixedChannels: e.target.checked })} /> Allow clock-out after Telegram or another attendance channel</label>
          <label><Checkbox checked={editing.requirePhoto} onChange={e => setEditing({ ...editing, requirePhoto: e.target.checked })} /> Require a photo for clock-in and clock-out</label>
          {editing.requirePhoto && <label>Retain photos for days<Input type="number" min={1} max={90} value={editing.photoRetentionDays} onChange={e => setEditing({ ...editing, photoRetentionDays: Number(e.target.value) })} /></label>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button disabled={busy || !editing.name?.trim()} onClick={() => void run(async () => { await http.put(base + "/" + editing.id, { name: editing.name, location: editing.location, requirePhoto: editing.requirePhoto, photoRetentionDays: editing.photoRetentionDays, allowMixedChannels: editing.allowMixedChannels }); setEditing(null); setNotice("Kiosk settings saved. The kiosk picks them up within five minutes or on its next reload."); await load(); })}>Save settings</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </section>}
      </>}
      {tab === "pins" && canPin && <>
        <section style={{ marginBottom: 24 }}><h2>Employees who need a PIN</h2>
          <p>Active employees of this branch with no PIN, a temporary PIN they have not changed yet, or a locked PIN. Choose one to set a PIN or unlock it below.</p>
          <Button variant="outline" disabled={busy || !branchId} onClick={() => void loadAttention()}>{attention ? "Refresh list" : "Show employees who need a PIN"}</Button>
          {attention && (attention.length === 0 ? <p role="status">Every active employee at this branch has a working PIN.</p> :
            <table className="table" data-testid="pin-attention"><thead><tr><th>Employee</th><th>PIN</th><th /></tr></thead><tbody>{attention.map(p => <tr key={p.id}>
              <td>{p.employeeNo} — {p.name}</td><td>{PIN_LABEL[p.pinStatus] ?? p.pinStatus}{p.lockedUntilUtc ? ` until ${display(p.lockedUntilUtc)}` : ""}</td>
              <td><Button size="sm" variant={employee === p.id ? "default" : "outline"} onClick={() => { setPeople(current => current.some(x => x.id === p.id) ? current : [...current, p]); setEmployee(p.id); }}>{employee === p.id ? "Selected" : "Select"}</Button></td></tr>)}</tbody></table>)}
        </section>
        <h2>Set or reset a temporary PIN</h2><p>Existing PINs cannot be viewed. Share the temporary PIN privately; the employee must change it before clocking attendance.</p>
        {picker}<label>Temporary six-digit PIN<input className="form-control" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} /></label>
        <button className="btn btn-primary" disabled={busy || !employee || pin.length !== 6} onClick={() => void run(async () => { await http.post(base + "/employees/" + employee + "/pin", { temporaryPin: pin }); setNotice("Temporary PIN set. The employee must change it on first use."); if (attention) setAttention(attention.map(a => a.id === employee && a.pinStatus === "NotSet" ? { ...a, pinStatus: "TemporaryPin" } : a)); })}>Set temporary PIN</button>
        <section style={{ marginTop: 20 }}><h3>Unlock a PIN</h3><p>Wrong PINs lock an employee out for 1 minute after five tries, 5 minutes after ten, then 15 minutes. If someone was locked out (for example by a colleague typing their number), unlock them here; their PIN does not change.</p>
          {(() => { const selected = people.find(p => p.id === employee); return selected && <p role="status">PIN status: {selected.pinStatus === "Locked" ? `Locked until ${display(selected.lockedUntilUtc)}` : selected.pinStatus === "NotSet" ? "No PIN set" : selected.pinStatus === "TemporaryPin" ? "Temporary PIN, not yet changed" : "Active"}{selected.failedAttempts ? ` · ${selected.failedAttempts} recent failed attempts` : ""}</p>; })()}
          <Button variant="outline" disabled={busy || !employee} onClick={() => void run(async () => { const { data } = await http.post(base + "/employees/" + employee + "/unlock"); setNotice(data?.message ?? "PIN unlocked."); await find(); })}>Unlock PIN</Button>
        </section>
        {canDevices && <section style={{ marginTop: 30 }}><h3>Approve cross-branch attendance</h3><p>For the selected employee, select the destination branch and expiry. Access is limited to that branch and period.</p><BranchGrant base={base} employee={employee} run={run} disabled={busy} /></section>}
      </>}
      {tab === "corrections" && canCorrections && <>
        <h2>Request an attendance correction</h2>{picker}
        <div className="form-row"><label>Business date<input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>Clock-in (branch time)<input className="form-control" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label><label>Clock-out (optional, branch time)<input className="form-control" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label></div>
        <label>Request / decision reason<textarea className="form-control" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label><Checkbox checked={newSession} onChange={e => setNewSession(e.target.checked)} /> Add as an extra shift on that day (split shift) instead of correcting an existing one</label>
        <button className="btn btn-primary" disabled={busy || !employee || !start || !date || !reason.trim()} onClick={() => void run(async () => { await http.post(base + "/employees/" + employee + "/corrections", { date, clockIn: wallClock(start), clockOut: end ? wallClock(end) : null, reason, newSession }); setNotice("Correction submitted for independent approval."); setNewSession(false); await load(); })}>Submit correction</button>
        <section style={{ marginTop: 28 }}><h3>Outage entry from the paper sign-in sheet</h3>
          <p>When the internet or the kiosk is down, staff write their name and times on the branch sign-in sheet. Enter the sheet here: each line becomes a correction request that another person approves below. Find each employee above, then add them to the sheet.</p>
          <div className="form-row"><label>Business date<Input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} /></label>
            <label>What happened<Textarea maxLength={900} value={bulkReason} onChange={e => setBulkReason(e.target.value)} placeholder="e.g. Internet down 08:00–15:30; times from the kitchen sign-in sheet" /></label></div>
          <Button variant="outline" disabled={busy || !employee || bulkRows.some(r => r.employeeId === employee)} onClick={() => { const p = people.find(x => x.id === employee); if (p) setBulkRows([...bulkRows, { employeeId: p.id, label: `${p.employeeNo} — ${p.name}`, clockIn: "", clockOut: "" }]); }}>Add selected employee to the sheet</Button>
          {bulkRows.length > 0 && <table className="table"><thead><tr><th>Employee</th><th>Clock-in (branch time)</th><th>Clock-out (branch time)</th><th /></tr></thead><tbody>{bulkRows.map((r, i) => <tr key={r.employeeId}><td>{r.label}</td>
            <td><Input type="datetime-local" value={r.clockIn} onChange={e => setBulkRows(bulkRows.map((x, j) => j === i ? { ...x, clockIn: e.target.value } : x))} /></td>
            <td><Input type="datetime-local" value={r.clockOut} onChange={e => setBulkRows(bulkRows.map((x, j) => j === i ? { ...x, clockOut: e.target.value } : x))} /></td>
            <td><Button variant="ghost" size="sm" onClick={() => setBulkRows(bulkRows.filter((_, j) => j !== i))}>Remove</Button></td></tr>)}</tbody></table>}
          <Button disabled={busy || !bulkDate || !bulkReason.trim() || bulkRows.length === 0 || bulkRows.some(r => !r.clockIn)} onClick={() => void run(async () => {
            const { data } = await http.post(base + "/corrections/bulk", { date: bulkDate, reason: bulkReason, entries: bulkRows.map(r => ({ employeeId: r.employeeId, clockIn: wallClock(r.clockIn), clockOut: r.clockOut ? wallClock(r.clockOut) : null })) });
            setNotice(summarize(data, "request(s) submitted for approval"));
            setBulkRows(bulkRows.filter(r => (data?.results ?? []).some((x: Row) => x.id === r.employeeId && !x.success)));
            await load();
          })}>Submit sheet for approval</Button>
        </section>
        <h3>Review requests</h3><p>Use the reason field above when approving or rejecting. You cannot approve your own request or attendance. Tick several requests (for example a whole outage sheet) to decide them together.</p>
        {canDecide && <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>{[true, false].map(approve => <Button key={String(approve)} variant={approve ? "default" : "outline"} disabled={busy || selected.length === 0 || !reason.trim()} onClick={() => void run(async () => { const { data } = await http.post(base + "/corrections/decisions", { ids: selected, approve, reason }); setNotice(summarize(data, approve ? "approved" : "rejected")); setSelected([]); await load(); })}>{approve ? "Approve selected" : "Reject selected"} ({selected.length})</Button>)}</div>}
        <table className="table"><thead><tr><th /><th>Employee</th><th>Original</th><th>Requested</th><th>Reason</th><th>Status</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{canDecide && r.status === "Pending" && <Checkbox aria-label="Select request" checked={selected.includes(r.id)} onChange={e => setSelected(e.target.checked ? [...selected, r.id] : selected.filter(x => x !== r.id))} />}</td><td>{r.employeeName ?? r.employeeId}<br />{new Date(r.date).toLocaleDateString()}</td><td>{r.attendanceRecordId || r.originalClockIn ? <>{display(r.originalClockIn)}<br />{display(r.originalClockOut)}</> : "New shift"}</td><td>{display(r.requestedClockIn)}<br />{display(r.requestedClockOut)}</td><td>{r.reason}<br />{r.decisionReason}</td><td>{r.status}</td><td>{canDecide && r.status === "Pending" && [true, false].map(approve => <button key={String(approve)} className="btn btn-secondary" disabled={busy || !reason.trim()} onClick={() => void run(async () => { await http.post(base + "/corrections/" + r.id + "/decision", { approve, reason }); await load(); })}>{approve ? "Approve" : "Reject"}</button>)}</td></tr>)}</tbody></table>
      </>}
      {tab === "audit" && canAudit && <>
        {branchId && <AttendancePhotos key={base + branchId} base={base} branchId={branchId} />}<h2>Recent attendance audit</h2><p>Includes failed attempts and lockouts, missed clock-outs, unauthorized branch attempts, PIN reset requests and unlocks, kiosk changes, photo views and corrections. Records cannot be edited.</p>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void run(load)}>Refresh</button>
        <table className="table"><thead><tr><th>Server time</th><th>Employee</th><th>Action / method</th><th>Result</th><th>Details</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{display(r.atUtc)}</td><td>{r.employeeName ?? r.employeeId ?? "Unknown"}</td><td>{r.action}<br />{r.method}</td><td>{r.success ? "Success" : "Review required"}</td><td style={{ maxWidth: 400, overflowWrap: "anywhere" }}>{r.detail}</td></tr>)}</tbody></table>
      </>}
    </div>
  </div>;
}
function display(value?: string) { return value ? new Date(value).toLocaleString() : "—"; }
function BranchGrant({ base, employee, run, disabled }: { base: string; employee: string; run: (work: () => Promise<void>) => Promise<void>; disabled: boolean }) {
  const [branch, setBranch] = useState(""), [expiry, setExpiry] = useState("");
  const [branches, setBranches] = useState<Row[]>([]);
  useEffect(() => { http.get(base + "/branches").then(r => setBranches(r.data)).catch(() => setBranches([])); }, [base]);
  return <div className="form-row"><label>Destination branch<select className="form-control" value={branch} onChange={e => setBranch(e.target.value)}><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Access expires<input className="form-control" type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} /></label><button className="btn btn-secondary" disabled={disabled || !employee || !branch || !expiry} onClick={() => void run(async () => { await http.post(base + "/branch-access", { employeeId: employee, branchId: branch, expiresAtUtc: new Date(expiry).toISOString() }); setBranch(""); setExpiry(""); })}>Approve access</button></div>;
}



function AttendancePhotos({ base, branchId }: { base: string; branchId: string }) {
  const [photos, setPhotos] = useState<Row[]>([]);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    http.get(base + "/photos", { params: { branchId } }).then(r => { if (active) setPhotos(r.data); }).catch(() => { if (active) setError("Unable to load attendance photos."); });
    return () => { active = false; };
  }, [base, branchId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function view(id: string) {
    setError("");
    try { const response = await http.get(base + "/photos/" + id, { responseType: "blob" }); setPreview(URL.createObjectURL(response.data)); }
    catch { setError("Photo unavailable or retention period expired."); }
  }
  return <section><h3>Attendance verification photos</h3><p>Use only for attendance review, e.g. to check that the person in the photo is the employee who clocked. Each view is recorded in the audit. Photos expire automatically under the kiosk retention policy.</p>
    {error && <p role="status">{error}</p>}
    {preview && <div><img src={preview} alt="Selected attendance verification photo" style={{ maxWidth: 480, width: "100%" }} /><button className="btn btn-secondary" onClick={() => setPreview("")}>Close photo</button></div>}
    <table className="table"><thead><tr><th>Employee</th><th>Action</th><th>Punch time</th><th>Retention ends</th><th /></tr></thead><tbody>{photos.map(p => <tr key={p.id}><td>{p.employeeNo ? `${p.employeeNo} — ${p.employeeName ?? ""}` : p.employeeId}</td><td>{p.action}</td><td>{display(p.punchedAtUtc)}</td><td>{display(p.expiresAtUtc)}</td><td><button className="btn btn-secondary" onClick={() => void view(p.id)}>Review photo</button></td></tr>)}</tbody></table>
  </section>;
}
