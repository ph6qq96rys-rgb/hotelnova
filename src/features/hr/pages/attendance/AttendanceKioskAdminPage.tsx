import { useEffect, useState } from "react";
import { http } from "../../../../api/http";
import { useAppScope } from "../../../../app/useAppScope";
import { useAuth } from "../../../../auth/AuthProvider";

type Row = Record<string, any>;
export default function AttendanceKioskAdminPage() {
  const { companyId, branchId } = useAppScope();
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
  const [photo, setPhoto] = useState(false);
  const [mixed, setMixed] = useState(true);
  const [retention, setRetention] = useState(30);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
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
  async function load() {
    if (!companyId) return;
    if (tab === "devices" && canDevices) setDevices((await http.get(base)).data);
    else if (branchId && ((tab === "corrections" && canCorrections) || (tab === "audit" && canAudit))) {
      setRows((await http.get(base + "/" + tab, { params: { branchId } })).data);
    }
  }
  useEffect(() => { setRows([]); setPeople([]); setEmployee(""); setActivation(null); void run(load); }, [companyId, branchId, tab]);
  useEffect(() => { if (!canDevices && canPin) setTab("pins"); }, [canDevices, canPin]);
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
    <label>Employee<select className="form-control" value={employee} onChange={e => setEmployee(e.target.value)}><option value="">Select employee</option>{people.map(p => <option key={p.id} value={p.id}>{p.employeeNo} — {p.name}</option>)}</select></label>
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
        <h2>Register a device</h2>
        <div className="form-row"><label>Kiosk name<input className="form-control" value={name} onChange={e => setName(e.target.value)} maxLength={120} /></label><label>Physical location<input className="form-control" value={location} onChange={e => setLocation(e.target.value)} maxLength={200} /></label><label>Device / asset label<input className="form-control" value={deviceName} onChange={e => setDeviceName(e.target.value)} maxLength={200} /></label></div>
        <label><input type="checkbox" checked={mixed} onChange={e => setMixed(e.target.checked)} /> Allow clock-out after Telegram or another attendance channel</label>
        <label><input type="checkbox" checked={photo} onChange={e => setPhoto(e.target.checked)} /> Require a photo for clock-in and clock-out</label>
        {photo && <label>Retain photos for days<input className="form-control" type="number" min={1} max={90} value={retention} onChange={e => setRetention(Number(e.target.value))} /></label>}
        <p>Open <strong>{window.location.origin}/attendance-kiosk</strong> on the branch device in a dedicated browser profile. Pairing signs that browser out of ERP. Use the device's managed kiosk mode to restrict navigation.</p>
        <button className="btn btn-primary" disabled={busy || !branchId || !name || !location || !deviceName} onClick={() => void run(async () => {
          const { data } = await http.post(base, { branchId, name, location, device: deviceName, requirePhoto: photo, photoRetentionDays: retention, allowMixedChannels: mixed });
          setActivation(data); await load();
        })}>Register kiosk</button>
        {activation && <section className="alert"><h3>Activate within 10 minutes</h3><p>Kiosk ID: <code>{activation.id}</code></p><p>One-time device code: <code style={{ overflowWrap: "anywhere" }}>{activation.pairingCode}</code></p><button className="btn btn-secondary" onClick={() => setActivation(null)}>Hide code</button></section>}
        <table className="table"><thead><tr><th>Kiosk</th><th>Location</th><th>Device</th><th>Status</th><th>Photo</th><th /></tr></thead><tbody>{devices.map(d => <tr key={d.id}><td>{d.name}</td><td>{d.location}</td><td>{d.device}</td><td>{!d.isActive ? "Disabled" : d.paired ? "Paired" : "Awaiting activation"}</td><td>{d.requirePhoto ? `Required · ${d.photoRetentionDays} days` : "Off"}</td><td><button className="btn btn-secondary" disabled={busy || !d.isActive} onClick={() => { if (window.confirm("Disable this kiosk immediately?")) void run(async () => { await http.delete(base + "/" + d.id); await load(); }); }}>Disable</button></td></tr>)}</tbody></table>
      </>}
      {tab === "pins" && canPin && <>
        <h2>Set or reset a temporary PIN</h2><p>Existing PINs cannot be viewed. Share the temporary PIN privately; the employee must change it before clocking attendance.</p>
        {picker}<label>Temporary six-digit PIN<input className="form-control" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} /></label>
        <button className="btn btn-primary" disabled={busy || !employee || pin.length !== 6} onClick={() => void run(async () => { await http.post(base + "/employees/" + employee + "/pin", { temporaryPin: pin }); setNotice("Temporary PIN set. The employee must change it on first use."); })}>Set temporary PIN</button>
        {canDevices && <section style={{ marginTop: 30 }}><h3>Approve cross-branch attendance</h3><p>For the selected employee, select the destination branch and expiry. Access is limited to that branch and period.</p><BranchGrant base={base} employee={employee} run={run} disabled={busy} /></section>}
      </>}
      {tab === "corrections" && canCorrections && <>
        <h2>Request an attendance correction</h2>{picker}
        <div className="form-row"><label>Business date<input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>Clock-in<input className="form-control" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label><label>Clock-out (optional)<input className="form-control" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label></div>
        <label>Request / decision reason<textarea className="form-control" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={busy || !employee || !start || !date || !reason.trim()} onClick={() => void run(async () => { await http.post(base + "/employees/" + employee + "/corrections", { date, clockIn: new Date(start).toISOString(), clockOut: end ? new Date(end).toISOString() : null, reason }); setNotice("Correction submitted for independent approval."); await load(); })}>Submit correction</button>
        <h3>Review requests</h3><p>Use the reason field above when approving or rejecting. You cannot approve your own request or attendance.</p>
        <table className="table"><thead><tr><th>Employee</th><th>Original</th><th>Requested</th><th>Reason</th><th>Status</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.employeeName ?? r.employeeId}<br />{new Date(r.date).toLocaleDateString()}</td><td>{display(r.originalClockIn)}<br />{display(r.originalClockOut)}</td><td>{display(r.requestedClockIn)}<br />{display(r.requestedClockOut)}</td><td>{r.reason}<br />{r.decisionReason}</td><td>{r.status}</td><td>{canDecide && r.status === "Pending" && [true, false].map(approve => <button key={String(approve)} className="btn btn-secondary" disabled={busy || !reason.trim()} onClick={() => void run(async () => { await http.post(base + "/corrections/" + r.id + "/decision", { approve, reason }); await load(); })}>{approve ? "Approve" : "Reject"}</button>)}</td></tr>)}</tbody></table>
      </>}
      {tab === "audit" && canAudit && <>
        {branchId && <AttendancePhotos key={base + branchId} base={base} branchId={branchId} />}<h2>Recent attendance audit</h2><p>Includes failed attempts, five-attempt lockouts, unauthorized branch attempts, PIN reset requests, and corrections. Records cannot be edited.</p>
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
  return <section><h3>Attendance verification photos</h3><p>Use only for attendance review. Photos expire automatically under the kiosk retention policy.</p>
    {error && <p role="status">{error}</p>}
    {preview && <div><img src={preview} alt="Selected attendance verification photo" style={{ maxWidth: 480, width: "100%" }} /><button className="btn btn-secondary" onClick={() => setPreview("")}>Close photo</button></div>}
    <table className="table"><thead><tr><th>Employee</th><th>Action</th><th>Retention ends</th><th /></tr></thead><tbody>{photos.map(p => <tr key={p.id}><td>{p.employeeId}</td><td>{p.action}</td><td>{display(p.expiresAtUtc)}</td><td><button className="btn btn-secondary" onClick={() => void view(p.id)}>Review photo</button></td></tr>)}</tbody></table>
  </section>;
}
