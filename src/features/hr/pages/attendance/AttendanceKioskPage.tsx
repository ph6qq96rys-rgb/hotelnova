import { useCallback, useEffect, useRef, useState } from "react";
import { clearAuth } from "../../../../auth/auth.storage";
import { clearWorkspaceAuth } from "../../../../auth/workspace-auth.storage";
import { clearPlatformAuth } from "../../../../auth/platform-auth.storage";
import "./attendance-kiosk.css";

const words = {
  en: { title: "Employee attendance", id: "Employee ID / badge number", pin: "Six-digit PIN", newPin: "New six-digit PIN", in: "Clock In", out: "Clock Out", change: "Change PIN", correction: "Request correction", reset: "Forgot PIN", cancel: "Clear / Cancel", ready: "Ready for the next employee", busy: "Recording…", privacy: "Your details clear after every transaction or 15 seconds of inactivity.", network: "Unable to reach the server. Attendance is not confirmed. Retry or contact your supervisor.", pair: "Activate this kiosk", kioskId: "Kiosk ID", code: "Activation code", connect: "Activate and sign out of ERP", setup: "Ask your administrator for a device activation code. This browser will become a dedicated attendance kiosk.", photo: "This kiosk requires an attendance photo.", camera: "Enable camera", photoUse: "Photos are available only to authorized attendance reviewers. Retention:", days: "days", date: "Business date", start: "Requested clock-in", end: "Requested clock-out (optional)", reason: "Reason", send: "Submit request", sound: "Sound", hours: "Worked hours", full: "Full screen", pending: "Contact HR for a temporary PIN.", loading: "Connecting to your branch…", cameraError: "Camera unavailable. Contact your supervisor.", invalid: "Employee ID or PIN is invalid, or attendance access is unavailable. Contact HR.", weak: "Choose a different six-digit PIN without repeated or sequential patterns.", required: "Change your temporary PIN before clocking attendance.", denied: "This branch is not authorized. Contact your supervisor.", already: "You are already clocked in.", noOpen: "No active clock-in. Contact your supervisor if a record is missing.", completed: "Attendance already exists for this business date. Contact your supervisor.", saved: "Attendance recorded", changed: "PIN changed. Sign in again.", requested: "Correction sent for independent approval.", invalidCorrection: "Check your date, clock times, and reason.", mixed: "Use the original attendance channel or contact your supervisor.", manualDisabled: "Correction requests are disabled. Contact HR.", next: "Returning to the home screen…" },
  am: { title: "የሠራተኛ መግቢያና መውጫ", id: "የሠራተኛ መለያ / ባጅ ቁጥር", pin: "ባለ 6 አሃዝ ፒን", newPin: "አዲስ ባለ 6 አሃዝ ፒን", in: "መግቢያ መመዝገብ", out: "መውጫ መመዝገብ", change: "ፒን መቀየር", correction: "ማስተካከያ መጠየቅ", reset: "ፒን ረሳሁ", cancel: "አጽዳ / ሰርዝ", ready: "ለቀጣዩ ሠራተኛ ዝግጁ", busy: "በመመዝገብ ላይ…", privacy: "መረጃዎ ከእያንዳንዱ ሂደት በኋላ ወይም ለ15 ሰከንድ ካልተጠቀሙ ይጸዳል።", network: "ከአገልጋዩ ጋር መገናኘት አልተቻለም። ምዝገባው አልተረጋገጠም። እንደገና ይሞክሩ ወይም ኃላፊዎን ያነጋግሩ።", pair: "ይህን ኪዮስክ ያንቁ", kioskId: "የኪዮስክ መለያ", code: "የማንቂያ ኮድ", connect: "አንቃ እና ከERP ውጣ", setup: "ከአስተዳዳሪዎ የማንቂያ ኮድ ይጠይቁ። ይህ አሳሽ ለመግቢያና መውጫ ምዝገባ ይጠቀማል።", photo: "ይህ ኪዮስክ የምዝገባ ፎቶ ይፈልጋል።", camera: "ካሜራ አብራ", photoUse: "ፎቶዎችን ፈቃድ ያላቸው ገምጋሚዎች ብቻ ማየት ይችላሉ። የማቆያ ጊዜ፦", days: "ቀናት", date: "የሥራ ቀን", start: "የተጠየቀ መግቢያ ሰዓት", end: "የተጠየቀ መውጫ ሰዓት (አማራጭ)", reason: "ምክንያት", send: "ጥያቄ ላክ", sound: "ድምጽ", hours: "የተሠራ ሰዓት", full: "ሙሉ ማያ", pending: "ለጊዜያዊ ፒን የሰው ኃይል ክፍልን ያነጋግሩ።", loading: "ከቅርንጫፉ ጋር በመገናኘት ላይ…", cameraError: "ካሜራ አይገኝም። ኃላፊዎን ያነጋግሩ።", invalid: "የሠራተኛ መለያ ወይም ፒን ትክክል አይደለም፣ ወይም መግቢያ አልተፈቀደም። የሰው ኃይል ክፍልን ያነጋግሩ።", weak: "ተደጋጋሚ ወይም ተከታታይ ያልሆነ አዲስ ባለ 6 አሃዝ ፒን ይምረጡ።", required: "ከመመዝገብዎ በፊት ጊዜያዊ ፒንዎን ይቀይሩ።", denied: "በዚህ ቅርንጫፍ መመዝገብ አልተፈቀደም። ኃላፊዎን ያነጋግሩ።", already: "መግቢያዎ አስቀድሞ ተመዝግቧል።", noOpen: "ክፍት የመግቢያ መዝገብ የለም። ኃላፊዎን ያነጋግሩ።", completed: "ለዚህ ቀን ምዝገባ አለ። ኃላፊዎን ያነጋግሩ።", saved: "ምዝገባው ተሳክቷል", changed: "ፒን ተቀይሯል። እንደገና ይግቡ።", requested: "የማስተካከያ ጥያቄ ለማጽደቅ ተልኳል።", invalidCorrection: "ቀን፣ ሰዓትና ምክንያትዎን ያረጋግጡ።", mixed: "የመግቢያ መመዝገቢያዎን ይጠቀሙ ወይም ኃላፊዎን ያነጋግሩ።", manualDisabled: "የማስተካከያ ጥያቄ አልተፈቀደም። የሰው ኃይል ክፍልን ያነጋግሩ።", next: "ወደ መነሻ ማያ በመመለስ ላይ…" }
};
type Device = { name: string; branchName: string; location: string; requirePhoto: boolean; photoRetentionDays: number };
type Outcome = { success?: boolean; code?: string; message?: string; firstName?: string; atUtc?: string; workedHours?: number };
export default function AttendanceKioskPage() {
  const [language, setLanguage] = useState<"en" | "am">("en");
  const t = words[language];
  const [device, setDevice] = useState<Device | null>(null);
  const [checking, setChecking] = useState(true);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [mode, setMode] = useState<"clock" | "pin" | "correction">("clock");
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [sound, setSound] = useState(true);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const stopCamera = useCallback(() => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; }, []);
  const clear = useCallback(() => {
    sequence.current++; request.current?.abort(); stopCamera();
    setEmployeeNumber(""); setPin(""); setNewPin(""); setReason(""); setDate(""); setStart(""); setEnd("");
    setMode("clock"); setResult(null); setBusy(false); input.current?.focus();
  }, [stopCamera]);
  const activity = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(clear, 15000);
  }, [clear]);
  useEffect(() => {
    localStorage.setItem("attendance.kioskMode", "true");
    clearAuth(); clearWorkspaceAuth(); clearPlatformAuth();
    const abort = new AbortController();
    fetch("/api/attendance-kiosk/status", { credentials: "same-origin", cache: "no-store", signal: abort.signal })
      .then(async r => { if (r.ok) setDevice(await r.json()); else if (r.status !== 401) setResult({ code: "Network" }); })
      .catch(() => { if (!abort.signal.aborted) setResult({ code: "Network" }); }).finally(() => setChecking(false));
    return () => { abort.abort(); request.current?.abort(); if (timer.current) clearTimeout(timer.current); stopCamera(); };
  }, [stopCamera]);
  useEffect(() => { activity(); }, [activity, employeeNumber, pin, newPin, mode, reason, start, end, date]);
  useEffect(() => {
    if (!result?.success) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(clear, 4000);
  }, [result, clear]);
  function beep(ok: boolean) {
    if (!sound || !audio.current) return;
    const a = audio.current, oscillator = a.createOscillator(), gain = a.createGain();
    oscillator.connect(gain); gain.connect(a.destination); oscillator.frequency.value = ok ? 780 : 240;
    gain.gain.value = 0.08; oscillator.start(); oscillator.stop(a.currentTime + 0.18);
  }
  async function camera() {
    try {
      const current = sequence.current;
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480 }, audio: false });
      if (current !== sequence.current) { media.getTracks().forEach(x => x.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
    } catch { setResult({ code: "Camera" }); }
  }
  async function submit(action: string) {
    if (busy) return;
    if (sound) { audio.current ??= new AudioContext(); void audio.current.resume(); }
    setBusy(true); setResult(null);
    const current = ++sequence.current;
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      let photo: string | undefined;
      if (device?.requirePhoto && (action === "ClockIn" || action === "ClockOut")) {
        if (!stream.current || !video.current?.videoWidth) { setResult({ code: "PhotoRequired" }); return; }
        const canvas = document.createElement("canvas"); canvas.width = 480; canvas.height = 360;
        canvas.getContext("2d")?.drawImage(video.current, 0, 0, 480, 360);
        photo = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
      }
      const pairing = action === "Pair", reset = action === "Reset";
      const body = pairing ? { id, code } : reset ? { employeeNumber } :
        { employeeNumber, pin, newPin: newPin || undefined, action, photo,
          correction: mode === "correction" ? { date, clockIn: new Date(start).toISOString(),
            clockOut: end ? new Date(end).toISOString() : null, reason } : undefined };
      const response = await fetch("/api/attendance-kiosk/" + (pairing ? "pair" : reset ? "pin-reset-request" : "transaction"), {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal
      });
      const data: Outcome = await response.json().catch(() => ({ code: "Network" }));
      if (current !== sequence.current) return;
      if (pairing && response.ok) { window.location.replace("/attendance-kiosk"); return; }
      if (response.status === 401) { setDevice(null); clear(); return; }
      if (response.status === 429) data.code = "InvalidCredentials";
      if (data.code === "ChangeRequired") { setMode("pin"); setPin(""); setNewPin(""); }
      else { setPin(""); setNewPin(""); }
      if (response.ok) { setEmployeeNumber(""); setReason(""); setDate(""); setStart(""); setEnd(""); stopCamera(); }
      setResult({ ...data, success: response.ok && data.success !== false }); beep(response.ok);
      if (response.ok) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(clear, 4000); }
    } catch { if (current === sequence.current) { setPin(""); setNewPin(""); setResult({ code: "Network" }); beep(false); } }
    finally { clearTimeout(timeout); if (current === sequence.current) setBusy(false); }
  }
  const message = result ? ({
    Network: t.network, Camera: t.cameraError, PhotoRequired: t.cameraError, InvalidCredentials: t.invalid,
    WeakPin: t.weak, ChangeRequired: t.required, BranchDenied: t.denied, AlreadyIn: t.already,
    NoOpenSession: t.noOpen, Completed: t.completed, ClockIn: t.in + " — " + t.saved,
    ClockOut: t.out + " — " + t.saved, PinChanged: t.changed, CorrectionRequested: t.requested,
    MixedChannelDenied: t.mixed, ManualDisabled: t.manualDisabled, ResetRequested: t.pending, InvalidCorrection: t.invalidCorrection, Pending: t.requested
  } as Record<string, string>)[result.code ?? ""] ?? (language === "en" ? result.message : t.invalid) : null;
  return <main className="attendance-kiosk" lang={language} onPointerDown={activity} onKeyDown={activity}>
    <header><strong>HOTEL NOVA · {t.title}</strong><div><button onClick={() => setLanguage(language === "en" ? "am" : "en")}>{language === "en" ? "አማርኛ" : "English"}</button><button onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}>{t.full}</button></div></header>
    <section className="kiosk-card">
      {checking ? <h1>{t.loading}</h1> : !device ? <>
        <h1>{t.pair}</h1><p>{t.setup}</p>
        <label>{t.kioskId}<input value={id} onChange={e => setId(e.target.value)} autoComplete="off" /></label>
        <label>{t.code}<input type="password" value={code} onChange={e => setCode(e.target.value)} autoComplete="off" /></label>
        <button className="kiosk-primary" disabled={busy || !id || !code} onClick={() => void submit("Pair")}>{t.connect}</button>
      </> : <>
        <div className="kiosk-branch">{device.branchName} · {device.location}</div>
        <h1>{t.title}</h1><p>{t.privacy}</p>
        <label>{t.id}<input ref={input} autoFocus value={employeeNumber} onChange={e => setEmployeeNumber(e.target.value)} maxLength={100} autoComplete="off" disabled={busy} /></label>
        <label>{t.pin}<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} disabled={busy} /></label>
        {mode === "pin" && <label>{t.newPin}<input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} disabled={busy} /></label>}
        {mode === "correction" && <div className="kiosk-correction">
          <label>{t.date}<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label>{t.start}<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
          <label>{t.end}<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label>
          <label>{t.reason}<textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        </div>}
        {device.requirePhoto && mode === "clock" && <div className="kiosk-camera"><p>{t.photo} {t.photoUse} {device.photoRetentionDays} {t.days}.</p><video ref={video} muted playsInline /><button onClick={() => void camera()}>{t.camera}</button></div>}
        <div className="kiosk-clock-actions">
          {mode === "clock" ? <><button className="kiosk-primary" disabled={busy || !employeeNumber || pin.length !== 6} onClick={() => void submit("ClockIn")}>{t.in}</button><button className="kiosk-out" disabled={busy || !employeeNumber || pin.length !== 6} onClick={() => void submit("ClockOut")}>{t.out}</button></>
          : <button className="kiosk-primary" disabled={busy || !employeeNumber || pin.length !== 6 || (mode === "pin" ? newPin.length !== 6 : !date || !start || !reason.trim())} onClick={() => void submit(mode === "pin" ? "ChangePin" : "RequestCorrection")}>{mode === "pin" ? t.change : t.send}</button>}
        </div>
        <div className="kiosk-secondary"><button disabled={busy} onClick={() => { stopCamera(); setMode("pin"); setResult(null); }}>{t.change}</button><button disabled={busy} onClick={() => { stopCamera(); setMode("correction"); setResult(null); }}>{t.correction}</button><button disabled={busy || !employeeNumber} onClick={() => void submit("Reset")}>{t.reset}</button><button onClick={clear}>{t.cancel}</button></div>
      </>}
      <div className={"kiosk-feedback " + (result?.success ? "is-success" : result ? "is-error" : "")} aria-live="assertive" role="status">
        {busy ? t.busy : message || (device ? t.ready : "")}
        {result?.firstName && <strong>{result.firstName}</strong>}
        {result?.atUtc && <span>{new Date(result.atUtc).toLocaleString(language === "am" ? "am-ET" : "en-GB")}</span>}
        {result?.workedHours != null && <span>{t.hours}: {result.workedHours.toFixed(2)}</span>}
        {result?.success && <small>{t.next}</small>}
      </div>
      <label className="kiosk-sound"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /> {t.sound}</label>
    </section>
  </main>;
}

