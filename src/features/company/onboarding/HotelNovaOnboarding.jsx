import { useState, useMemo, useReducer, useCallback } from "react";

// ── Domain constants (mirrors company.types.ts) ──────────────────────────────
const StockLocationType = { Warehouse: 0, Kitchen: 1, Bar: 2, Transit: 3, WIP: 4, Store: 5 };
const LOCATION_TYPE_OPTIONS = [
  { value: 0, label: "Warehouse" },
  { value: 1, label: "Kitchen" },
  { value: 2, label: "Bar" },
  { value: 3, label: "Transit" },
  { value: 4, label: "WIP" },
  { value: 5, label: "Store" },
];
const LOCATION_TYPE_ICONS = { 0: "ti-building-warehouse", 1: "ti-tools-kitchen-2", 2: "ti-glass-full", 3: "ti-truck", 4: "ti-settings-2", 5: "ti-building-store" };
const ROLE_OPTIONS = [
  { value: "BranchAdmin", label: "Branch Admin" },
  { value: "Staff",       label: "Staff"        },
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Wizard steps (mirrors ONBOARDING_STEPS) ──────────────────────────────────
const STEPS = [
  { key: "company",   title: "Company",          subtitle: "Legal entity & ERP defaults",        icon: "ti-building" },
  { key: "branch",    title: "Branch",           subtitle: "First operational branch",            icon: "ti-git-branch" },
  { key: "locations", title: "Stock locations",  subtitle: "Warehouse, kitchen, bar",             icon: "ti-package" },
  { key: "stores",    title: "Stores",           subtitle: "POS and sales units",                 icon: "ti-device-tablet" },
  { key: "users",     title: "Users & roles",    subtitle: "Branch admin access",                 icon: "ti-users" },
  { key: "review",    title: "Review & launch",  subtitle: "Confirm and complete setup",          icon: "ti-circle-check" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function stockLocationTypeLabel(t) { return LOCATION_TYPE_OPTIONS.find(o => o.value === t)?.label ?? "Unknown"; }
function branchUserDisplayName(m) { return [m.firstName, m.lastName].filter(Boolean).join(" ") || m.userName || m.email || "User"; }
function initials(str) { return str.split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase() || "?"; }
function uid() { return Math.random().toString(36).slice(2,10); }

// ── Initial state ─────────────────────────────────────────────────────────────
function createInitialState() {
  return {
    active: "company",
    companyId: null, branchId: null,
    company: null, branch: null,
    stockLocations: [], stores: [], members: [],
    settings: { vatEnabled: false, vatRate: 15, pricesIncludeVat: false, invoicePrefix: "INV", receiptPrefix: "RCPT", allowNegativeStock: false, fiscalYearStartMonth: 1 },
    saving: false, loading: false,
    error: null, notice: null,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_ACTIVE": return { ...state, active: action.step, error: null, notice: null };
    case "COMPANY_CREATED": return { ...state, companyId: action.id, company: action.company, settings: action.settings ?? state.settings, active: "branch", notice: "Company created. Set up your first branch next." };
    case "SETTINGS_SAVED": return { ...state, settings: action.settings, notice: "Company defaults saved." };
    case "BRANCH_CREATED": return { ...state, branchId: action.id, branch: action.branch, active: "locations", notice: "Branch created. Add stock locations next." };
    case "STOCK_ADDED": return { ...state, stockLocations: [...state.stockLocations, action.item] };
    case "STOCK_REMOVED": return { ...state, stockLocations: state.stockLocations.filter(l => l.id !== action.id) };
    case "STORE_ADDED": return { ...state, stores: [...state.stores, action.item] };
    case "STORE_REMOVED": return { ...state, stores: state.stores.filter(s => s.id !== action.id) };
    case "MEMBER_ADDED": return { ...state, members: [...state.members, action.item] };
    case "MEMBER_REMOVED": return { ...state, members: state.members.filter(m => m.userId !== action.userId) };
    case "CLEAR_NOTICE": return { ...state, notice: null };
    case "SET_ERROR": return { ...state, error: action.error, saving: false };
    case "CLEAR_ERROR": return { ...state, error: null };
    default: return state;
  }
}

// ── Design-system primitives (matches company-onboarding.css + company.ui) ───

function Btn({ children, variant = "ghost", onClick, disabled, style, type = "button" }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    minHeight: 40, borderRadius: 12, padding: "0 18px",
    fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
    transition: "all 160ms ease", border: "1px solid transparent", fontFamily: "inherit",
  };
  const variants = {
    primary: { background: "linear-gradient(180deg,#0f172a 0%,#020617 100%)", color: "#fff", border: "1px solid rgba(15,23,42,.9)", boxShadow: "0 10px 25px -12px rgba(2,6,23,.45), inset 0 1px 0 rgba(255,255,255,.08)" },
    ghost:   { background: "rgba(255,255,255,.95)", color: "#334155", border: "1px solid #e2e8f0", boxShadow: "0 4px 10px -6px rgba(15,23,42,.08)" },
    soft:    { background: "#f1f5f9", color: "#0f172a", border: "1px solid #e2e8f0" },
    danger:  { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", letterSpacing: "0.02em" }}>
          {label}{required && <span style={{ color: "#e11d48", marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {hint && <span style={{ fontSize: 11, color: "#94a3b8" }}>{hint}</span>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", disabled, style }) {
  return (
    <input
      type={type} value={value ?? ""} placeholder={placeholder} disabled={disabled}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid #dbe3ee", background: "rgba(255,255,255,.95)", padding: "0 14px", fontSize: 13, color: "#0f172a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", ...style }}
      onFocus={e => { e.target.style.borderColor="#0f172a"; e.target.style.boxShadow="0 0 0 4px rgba(15,23,42,.08)"; }}
      onBlur={e => { e.target.style.borderColor="#dbe3ee"; e.target.style.boxShadow="none"; }}
    />
  );
}

function SelectInput({ value, onChange, options, disabled, style }) {
  return (
    <select
      value={value ?? ""} disabled={disabled} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid #dbe3ee", background: "rgba(255,255,255,.95)", padding: "0 14px", fontSize: 13, color: "#0f172a", outline: "none", fontFamily: "inherit", appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", boxSizing: "border-box", ...style }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TextArea({ value, onChange, placeholder, disabled, rows = 3 }) {
  return (
    <textarea
      value={value ?? ""} placeholder={placeholder} disabled={disabled} rows={rows}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", borderRadius: 10, border: "1px solid #dbe3ee", background: "rgba(255,255,255,.95)", padding: "10px 14px", fontSize: 13, color: "#0f172a", outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
      onFocus={e => { e.target.style.borderColor="#0f172a"; e.target.style.boxShadow="0 0 0 4px rgba(15,23,42,.08)"; }}
      onBlur={e => { e.target.style.borderColor="#dbe3ee"; e.target.style.boxShadow="none"; }}
    />
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "#0f172a" : "#e2e8f0", position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", width: 18, height: 18, borderRadius: "50%", background: "#fff", top: 3, left: checked ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </div>
  );
}

function Checkbox({ checked, onChange, label, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => onChange(!checked)}>
      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? "#0f172a" : "#cbd5e1"}`, background: checked ? "#0f172a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all .15s" }}>
        {checked && <i className="ti ti-check" style={{ fontSize: 11, color: "#fff" }} />}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{hint}</div>}
      </div>
    </div>
  );
}

function Alert({ tone, title, message }) {
  const colors = {
    danger:  { bg: "#fef2f2", border: "#fecaca", title: "#991b1b", msg: "#b91c1c", icon: "ti-alert-circle" },
    ok:      { bg: "#f0fdf4", border: "#bbf7d0", title: "#166534", msg: "#15803d", icon: "ti-circle-check" },
    warn:    { bg: "#fffbeb", border: "#fde68a", title: "#92400e", msg: "#b45309", icon: "ti-alert-triangle" },
    info:    { bg: "#eff6ff", border: "#bfdbfe", title: "#1e40af", msg: "#1d4ed8", icon: "ti-info-circle" },
  };
  const c = colors[tone] ?? colors.info;
  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, marginBottom: 14 }}>
      <i className={`ti ${c.icon}`} style={{ fontSize: 16, color: c.title, flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: c.title }}>{title}</div>
        <div style={{ fontSize: 12, color: c.msg, marginTop: 2, lineHeight: 1.5 }}>{message}</div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" },
    success: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
    info:    { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
    warn:    { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  };
  const t = tones[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
      {children}
    </span>
  );
}

function CheckItem({ done, title, required }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: done ? "#f0fdf4" : "#fafafa" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: done ? "#16a34a" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {done ? <i className="ti ti-check" style={{ fontSize: 12, color: "#fff" }} /> : <i className="ti ti-minus" style={{ fontSize: 11, color: "#94a3b8" }} />}
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: done ? "#166534" : "#64748b", flex: 1 }}>{title}</span>
      {required && !done && <Badge tone="warn">Required</Badge>}
      {done && <Badge tone="success">Done</Badge>}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function EmptyState({ title, sub, icon = "ti-inbox" }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", border: "1px dashed #e2e8f0", borderRadius: 12, background: "#fafafa" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 28, color: "#cbd5e1", display: "block", marginBottom: 8 }} />
      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#020617", letterSpacing: "-0.02em" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ borderRadius: 20, background: "rgba(255,255,255,.96)", border: "1px solid rgba(226,232,240,.9)", boxShadow: "0 10px 30px -18px rgba(15,23,42,.15)", padding: "20px 22px", marginBottom: 14, ...style }}>
      {children}
    </div>
  );
}

// ── Wizard Rail (matches WizardRail component) ────────────────────────────────
function WizardRail({ active, readiness, onSelect }) {
  const activeIdx = STEPS.findIndex(s => s.key === active);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {STEPS.map((step, i) => {
        const r = readiness[step.key];
        const isActive = step.key === active;
        const isDone = r.done;
        const isLocked = r.locked;
        const isPast = i < activeIdx;
        return (
          <div key={step.key} onClick={() => !isLocked && onSelect(step.key)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, cursor: isLocked ? "not-allowed" : "pointer", background: isActive ? "#0f172a" : "transparent", transition: "all .18s", opacity: isLocked ? 0.4 : 1 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isActive ? "rgba(255,255,255,.12)" : isDone ? "#dcfce7" : "#f1f5f9", border: isActive ? "none" : isDone ? "1px solid #bbf7d0" : "1px solid #e2e8f0" }}>
              {isDone && !isActive
                ? <i className="ti ti-check" style={{ fontSize: 13, color: "#16a34a" }} />
                : <i className={`ti ${step.icon}`} style={{ fontSize: 14, color: isActive ? "#fff" : "#94a3b8" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#fff" : "#334155", lineHeight: 1.2 }}>{step.title}</div>
              <div style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,.6)" : "#94a3b8", marginTop: 2, lineHeight: 1.3 }}>{step.subtitle}</div>
            </div>
            {!isActive && isDone && <i className="ti ti-check" style={{ fontSize: 11, color: "#16a34a" }} />}
            {isLocked && <i className="ti ti-lock" style={{ fontSize: 11, color: "#cbd5e1" }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Step: Company ─────────────────────────────────────────────────────────────
function CompanyStep({ existing, settings, onCreated, onSettingsSaved }) {
  const [form, setForm] = useState({ name: "", code: "", taxId: "", phone: "", email: "", website: "", addressLine: "", city: "", country: "Ethiopia" });
  const [cfg, setCfg] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCfgK = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  async function create() {
    if (!form.name.trim() || !form.code.trim()) { setErr("Company name and code are required."); return; }
    setBusy(true); setErr(null);
    await new Promise(r => setTimeout(r, 700));
    const id = uid();
    onCreated(id, { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() }, cfg);
    setBusy(false);
  }

  if (existing) {
    return (
      <div>
        <Alert tone="ok" title="Company created" message={`${existing.name} · ID: ${existing.id ?? "saved"}`} />
        <Card>
          <SectionTitle title="Company defaults" subtitle="Applied to all branches and stores." />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>VAT enabled</div><div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Apply VAT to sales and invoices</div></div>
              <Toggle checked={cfg.vatEnabled} onChange={v => setCfgK("vatEnabled", v)} />
            </div>
            {cfg.vatEnabled && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="VAT rate (%)" hint="e.g. 15 for 15%">
                  <Input value={String(cfg.vatRate)} onChange={v => setCfgK("vatRate", parseFloat(v) || 0)} placeholder="15" type="number" />
                </Field>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px" }}>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>Inclusive pricing</div><div style={{ fontSize: 11, color: "#64748b" }}>Prices include VAT</div></div>
                  <Toggle checked={cfg.pricesIncludeVat} onChange={v => setCfgK("pricesIncludeVat", v)} />
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Invoice prefix" hint="e.g. INV-2024-"><Input value={cfg.invoicePrefix} onChange={v => setCfgK("invoicePrefix", v)} placeholder="INV" /></Field>
              <Field label="Receipt prefix" hint="e.g. RCPT-"><Input value={cfg.receiptPrefix} onChange={v => setCfgK("receiptPrefix", v)} placeholder="RCPT" /></Field>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Allow negative stock</div><div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Permit stock levels below zero</div></div>
              <Toggle checked={cfg.allowNegativeStock} onChange={v => setCfgK("allowNegativeStock", v)} />
            </div>
            <Field label="Fiscal year start month">
              <SelectInput value={String(cfg.fiscalYearStartMonth)} onChange={v => setCfgK("fiscalYearStartMonth", Number(v))} options={MONTHS.map((m,i) => ({ value: String(i+1), label: m }))} />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="primary" onClick={() => onSettingsSaved(cfg)}>Save defaults</Btn>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {err && <Alert tone="danger" title="Validation error" message={err} />}
      <Card>
        <SectionTitle title="Legal entity" subtitle="This becomes your root tenant in HotelNova ERP." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Company name" required>
            <Input value={form.name} onChange={v => set("name", v)} placeholder="Horizon Hospitality Group PLC" />
          </Field>
          <Field label="Company code" required hint="Short uppercase identifier">
            <Input value={form.code} onChange={v => set("code", v.toUpperCase())} placeholder="HHG" />
          </Field>
          <Field label="Tax / VAT ID">
            <Input value={form.taxId} onChange={v => set("taxId", v)} placeholder="0012345678" />
          </Field>
          <Field label="Country">
            <SelectInput value={form.country} onChange={v => set("country", v)} options={["Ethiopia","Kenya","Uganda","South Africa","United Kingdom","United States","UAE","Other"].map(c=>({ value:c, label:c }))} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={v => set("email", v)} placeholder="admin@company.com" type="email" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={v => set("phone", v)} placeholder="+251 911 000 000" />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={v => set("city", v)} placeholder="Addis Ababa" />
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={v => set("website", v)} placeholder="https://horizon.com" />
          </Field>
        </div>
        <Field label="Address line">
          <TextArea value={form.addressLine} onChange={v => set("addressLine", v)} placeholder="Street / Building / Landmark…" rows={2} />
        </Field>
      </Card>
      <Card>
        <SectionTitle title="ERP defaults" subtitle="Applied across all branches. You can change these later in Company Settings." />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>VAT enabled</div><div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Apply VAT to sales and invoices</div></div>
            <Toggle checked={cfg.vatEnabled} onChange={v => setCfgK("vatEnabled", v)} />
          </div>
          {cfg.vatEnabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="VAT rate (%)"><Input value={String(cfg.vatRate)} onChange={v => setCfgK("vatRate", parseFloat(v)||0)} placeholder="15" type="number" /></Field>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px" }}>
                <div><div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>Inclusive pricing</div><div style={{ fontSize: 11, color: "#64748b" }}>Prices include VAT</div></div>
                <Toggle checked={cfg.pricesIncludeVat} onChange={v => setCfgK("pricesIncludeVat", v)} />
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Invoice prefix" hint="e.g. INV-2024-"><Input value={cfg.invoicePrefix} onChange={v => setCfgK("invoicePrefix", v)} placeholder="INV" /></Field>
            <Field label="Receipt prefix" hint="e.g. RCPT-"><Input value={cfg.receiptPrefix} onChange={v => setCfgK("receiptPrefix", v)} placeholder="RCPT" /></Field>
          </div>
          <Field label="Fiscal year start month">
            <SelectInput value={String(cfg.fiscalYearStartMonth)} onChange={v => setCfgK("fiscalYearStartMonth", Number(v))} options={MONTHS.map((m,i)=>({ value:String(i+1), label:m }))} />
          </Field>
        </div>
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={create} disabled={busy}>
          <i className="ti ti-building" />
          {busy ? "Creating…" : "Create company"}
        </Btn>
      </div>
    </div>
  );
}

// ── Step: Branch ──────────────────────────────────────────────────────────────
function BranchStep({ companyId, branchId, branch, onCreated }) {
  const [form, setForm] = useState({ code: "", name: "", city: "", region: "", addressLine: "", isMain: true, phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function create() {
    if (!form.name.trim() || !form.code.trim()) { setErr("Branch name and code are required."); return; }
    setBusy(true); setErr(null);
    await new Promise(r => setTimeout(r, 600));
    const id = uid();
    onCreated(id, { id, ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() });
    setBusy(false);
  }

  if (branchId && branch) {
    return (
      <Alert tone="ok"
        title="Branch created"
        message={`${branch.name} (${branch.code})${branch.city ? " · " + branch.city : ""} · ID: ${branchId}`}
      />
    );
  }

  return (
    <div>
      {err && <Alert tone="danger" title="Validation error" message={err} />}
      <Card>
        <SectionTitle title="Branch details" subtitle="A branch maps to a physical location — hotel property or restaurant site." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Branch code" required hint="Short identifier, e.g. BOLE">
            <Input value={form.code} onChange={v => set("code", v.toUpperCase())} placeholder="BOLE" />
          </Field>
          <Field label="Branch name" required>
            <Input value={form.name} onChange={v => set("name", v)} placeholder="Bole Branch" />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={v => set("city", v)} placeholder="Addis Ababa" />
          </Field>
          <Field label="Region">
            <Input value={form.region} onChange={v => set("region", v)} placeholder="Oromia" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={v => set("phone", v)} placeholder="+251 911 000 000" />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={v => set("email", v)} placeholder="bole@company.com" type="email" />
          </Field>
        </div>
        <Field label="Address line">
          <TextArea value={form.addressLine} onChange={v => set("addressLine", v)} placeholder="Street / Building / Landmark…" rows={2} />
        </Field>
        <div style={{ marginTop: 14 }}>
          <Checkbox checked={form.isMain} onChange={v => set("isMain", v)} label="Main branch" hint="Mark as the primary branch for this company" />
        </div>
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={create} disabled={busy}>
          <i className="ti ti-git-branch" />
          {busy ? "Creating…" : "Create branch"}
        </Btn>
      </div>
    </div>
  );
}

// ── Step: Stock Locations ─────────────────────────────────────────────────────
function StockLocationsStep({ items, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState(0);
  const [isDefaultReceiving, setIsDefaultReceiving] = useState(false);
  const [isDefaultIssue, setIsDefaultIssue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function create() {
    if (!name.trim() || !code.trim()) { setErr("Name and code are required."); return; }
    setBusy(true); setErr(null);
    await new Promise(r => setTimeout(r, 400));
    onAdd({ id: uid(), name: name.trim(), code: code.trim().toUpperCase(), type: Number(type), isDefaultReceiving, isDefaultIssue });
    setName(""); setCode(""); setIsDefaultReceiving(false); setIsDefaultIssue(false);
    setBusy(false);
  }

  return (
    <div>
      {err && <Alert tone="danger" title="Validation error" message={err} />}
      <Card>
        <SectionTitle title="Add stock location" subtitle="Define where physical inventory is held — warehouse, kitchen, bar, etc." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Name" required>
            <Input value={name} onChange={setName} placeholder="Main Warehouse" disabled={busy} />
          </Field>
          <Field label="Code" required hint="e.g. WH-001">
            <Input value={code} onChange={v => setCode(v.toUpperCase())} placeholder="WH-001" disabled={busy} />
          </Field>
          <Field label="Type">
            <SelectInput value={type} onChange={v => setType(Number(v))} options={LOCATION_TYPE_OPTIONS} disabled={busy} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
          <Checkbox checked={isDefaultReceiving} onChange={setIsDefaultReceiving} label="Default receiving location" hint="Goods are received here by default" />
          <Checkbox checked={isDefaultIssue} onChange={setIsDefaultIssue} label="Default issue location" hint="Stock is issued from here by default" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="primary" onClick={create} disabled={busy}>
            <i className="ti ti-plus" />
            {busy ? "Adding…" : "Add location"}
          </Btn>
        </div>
      </Card>

      {items.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(x => (
            <div key={x.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", alignItems: "center", background: "#fafafa" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={`ti ${LOCATION_TYPE_ICONS[x.type] ?? "ti-package"}`} style={{ fontSize: 15, color: "#64748b" }} />
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{x.name}</span>
                <span style={{ marginLeft: 8, color: "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>{x.code}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>{stockLocationTypeLabel(x.type)}</span>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {x.isDefaultReceiving && <Badge tone="success">Receiving</Badge>}
                {x.isDefaultIssue && <Badge tone="info">Issue</Badge>}
              </div>
              <Btn variant="danger" onClick={() => onRemove(x.id)} style={{ padding: "4px 10px", fontSize: 12, minHeight: 30 }}>
                <i className="ti ti-trash" style={{ fontSize: 13 }} />
              </Btn>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No stock locations yet" sub="Add at least one warehouse or kitchen location." icon="ti-package" />}
    </div>
  );
}

// ── Step: Stores ──────────────────────────────────────────────────────────────
function StoresStep({ stores, stockLocations, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function create() {
    if (!name.trim()) { setErr("Store name is required."); return; }
    setBusy(true); setErr(null);
    await new Promise(r => setTimeout(r, 400));
    onAdd({ id: uid(), name: name.trim() });
    setName("");
    setBusy(false);
  }

  return (
    <div>
      {err && <Alert tone="danger" title="Validation error" message={err} />}
      {stockLocations.length === 0 && (
        <Alert tone="warn" title="No stock locations" message="Create stock locations first so stores can be mapped to issue locations." />
      )}
      <Card>
        <SectionTitle title="Add store" subtitle="Stores are POS and sales units — one per counter, restaurant section, or service point." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
          <Field label="Store name" required>
            <Input value={name} onChange={setName} placeholder="e.g. Main POS, Ground Floor Restaurant, Rooftop Bar" disabled={busy} />
          </Field>
          <Btn variant="primary" onClick={create} disabled={busy} style={{ alignSelf: "flex-end" }}>
            <i className="ti ti-plus" />
            {busy ? "…" : "Add store"}
          </Btn>
        </div>
      </Card>
      {stores.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {stores.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fafafa" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ti ti-device-tablet" style={{ fontSize: 14, color: "#3b82f6" }} />
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{s.name}</span>
              <Badge>Store {i + 1}</Badge>
              <Btn variant="danger" onClick={() => onRemove(s.id)} style={{ padding: "4px 10px", fontSize: 12, minHeight: 30 }}>
                <i className="ti ti-trash" style={{ fontSize: 13 }} />
              </Btn>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No stores yet" sub="Stores are POS and sales units tied to a branch." icon="ti-device-tablet" />}
    </div>
  );
}

// ── Step: Users ───────────────────────────────────────────────────────────────
function UsersStep({ members, onAdd, onRemove }) {
  const [form, setForm] = useState({ userName: "", email: "", password: "", firstName: "", lastName: "", role: "BranchAdmin" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const adminCount = members.filter(m => m.role === "BranchAdmin").length;

  async function createUser() {
    if (!form.userName.trim() || !form.email.trim() || !form.password) { setErr("Username, email and password are required."); return; }
    setBusy(true); setErr(null);
    await new Promise(r => setTimeout(r, 600));
    onAdd({ userId: uid(), userName: form.userName.trim(), email: form.email.trim().toLowerCase(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), role: form.role });
    setForm({ userName: "", email: "", password: "", firstName: "", lastName: "", role: "BranchAdmin" });
    setBusy(false);
  }

  return (
    <div>
      {err && <Alert tone="danger" title="Validation error" message={err} />}
      <Card>
        <SectionTitle title="Create branch user" subtitle="Create a user and assign them to this branch with the appropriate role." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="First name"><Input value={form.firstName} onChange={v => setF("firstName", v)} placeholder="e.g. Hana" disabled={busy} /></Field>
          <Field label="Last name"><Input value={form.lastName} onChange={v => setF("lastName", v)} placeholder="e.g. Tesfaye" disabled={busy} /></Field>
          <Field label="Username" required><Input value={form.userName} onChange={v => setF("userName", v)} placeholder="e.g. hana.t" disabled={busy} /></Field>
          <Field label="Email" required><Input value={form.email} onChange={v => setF("email", v)} placeholder="hana@company.com" type="email" disabled={busy} /></Field>
          <Field label="Password" required><Input value={form.password} onChange={v => setF("password", v)} type="password" placeholder="Minimum 6 characters" disabled={busy} /></Field>
          <Field label="Role">
            <SelectInput value={form.role} onChange={v => setF("role", v)} options={ROLE_OPTIONS} disabled={busy} />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="primary" onClick={createUser} disabled={busy}>
            <i className="ti ti-user-plus" />
            {busy ? "Creating…" : "Create user"}
          </Btn>
        </div>
      </Card>

      {members.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Branch members ({members.length}) · {adminCount} admin{adminCount !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map(m => {
              const displayName = branchUserDisplayName(m);
              const inits = initials(displayName);
              const isAdmin = m.role === "BranchAdmin";
              return (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fafafa" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: isAdmin ? "#dcfce7" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: isAdmin ? "#166534" : "#475569", flexShrink: 0 }}>{inits}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{m.email}</div>
                  </div>
                  <Badge tone={isAdmin ? "success" : "default"}>{m.role}</Badge>
                  <Btn variant="ghost" onClick={() => onRemove(m.userId)} style={{ padding: "4px 10px", fontSize: 12, minHeight: 30 }}>Remove</Btn>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step: Review ──────────────────────────────────────────────────────────────
function ReviewStep({ state, readiness, onFinish, saving }) {
  const hasBranchAdmin = state.members.some(m => m.role === "BranchAdmin");
  const canFinish = readiness.review.done;
  const { company, branch, stockLocations, stores, members, settings } = state;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {company && (
          <Card style={{ margin: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Company</div>
            <InfoRow label="Name" value={company.name} />
            <InfoRow label="Code" value={company.code} />
            <InfoRow label="Country" value={company.country} />
            <InfoRow label="Email" value={company.email} />
            <InfoRow label="VAT" value={settings.vatEnabled ? `${settings.vatRate}%` : "Disabled"} />
            <InfoRow label="Fiscal year" value={MONTHS[(settings.fiscalYearStartMonth ?? 1) - 1]} />
          </Card>
        )}
        {branch && (
          <Card style={{ margin: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Branch</div>
            <InfoRow label="Name" value={branch.name} />
            <InfoRow label="Code" value={branch.code} />
            <InfoRow label="City" value={branch.city} />
            <InfoRow label="Region" value={branch.region} />
            <InfoRow label="Main branch" value={branch.isMain ? "Yes" : "No"} />
          </Card>
        )}
      </div>

      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Setup checklist</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <CheckItem done={!!state.companyId} title="Company created" required />
          <CheckItem done={!!state.branchId} title="Branch created" required />
          <CheckItem done={stockLocations.length > 0} title={`${stockLocations.length} stock location${stockLocations.length !== 1 ? "s" : ""} configured`} />
          <CheckItem done={stores.length > 0} title={`${stores.length} store${stores.length !== 1 ? "s" : ""} configured`} />
          <CheckItem done={hasBranchAdmin} title="At least one branch admin assigned" required />
        </div>
      </Card>

      {!canFinish && <Alert tone="warn" title="Complete required steps" message="Create a company, branch, and assign at least one branch admin before finishing." />}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={onFinish} disabled={!canFinish || saving}>
          <i className="ti ti-circle-check" />
          {saving ? "Finishing…" : canFinish ? "Finish setup" : "Complete required steps above"}
        </Btn>
      </div>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ state, onGoToDashboard }) {
  const { company, branch } = state;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <i className="ti ti-circle-check" style={{ fontSize: 28, color: "#4ade80" }} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#020617", letterSpacing: "-0.03em", marginBottom: 8 }}>Setup complete</div>
      <div style={{ fontSize: 14, color: "#64748b", maxWidth: 380, lineHeight: 1.7, marginBottom: 24 }}>
        {company?.name} is live on HotelNova ERP. Your first branch {branch?.name && `(${branch.name})`} is ready for operations.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", marginBottom: 24 }}>
        {[
          { icon: "ti-rocket", title: "Quick-start tour", desc: "Guided walkthrough of your ERP" },
          { icon: "ti-file-import", title: "Import data", desc: "Migrate items, menus & stock" },
          { icon: "ti-plug", title: "Integrations", desc: "Connect OTAs, payments & APIs" },
        ].map(c => (
          <div key={c.title} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px", background: "#fafafa", textAlign: "left" }}>
            <i className={`ti ${c.icon}`} style={{ fontSize: 20, color: "#0f172a", display: "block", marginBottom: 8 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{c.title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{c.desc}</div>
          </div>
        ))}
      </div>
      <Btn variant="primary" onClick={onGoToDashboard}>
        <i className="ti ti-layout-dashboard" /> Go to ERP dashboard
      </Btn>
    </div>
  );
}

// ── Root module (mirrors CompanyOnboardingModule) ─────────────────────────────
export default function CompanyOnboardingModule() {
  const [state, dispatch] = useReducer(reducer, createInitialState());
  const [done, setDone] = useState(false);

  const activeIndex = STEPS.findIndex(s => s.key === state.active);
  const pct = Math.round(((activeIndex + 1) / STEPS.length) * 100);

  const readiness = useMemo(() => {
    const hasCompany = !!state.companyId;
    const hasBranch = !!state.branchId;
    const hasStock = state.stockLocations.length > 0;
    const hasStore = state.stores.length > 0;
    const hasAdmin = state.members.some(m => m.role === "BranchAdmin");
    return {
      company:   { done: hasCompany, locked: false },
      branch:    { done: hasBranch, locked: !hasCompany },
      locations: { done: hasStock, locked: !hasBranch },
      stores:    { done: hasStore, locked: !hasBranch },
      users:     { done: hasAdmin, locked: !hasBranch },
      review:    { done: hasCompany && hasBranch && hasAdmin, locked: !hasBranch },
    };
  }, [state.companyId, state.branchId, state.stockLocations.length, state.stores.length, state.members]);

  function goTo(step) {
    if (readiness[step].locked) return;
    dispatch({ type: "SET_ACTIVE", step });
  }

  function next() {
    const candidate = STEPS[activeIndex + 1];
    if (candidate && !readiness[candidate.key].locked) goTo(candidate.key);
  }

  function back() {
    const candidate = STEPS[activeIndex - 1];
    if (candidate) goTo(candidate.key);
  }

  if (done) {
    return (
      <div style={{ fontFamily: "var(--font-sans, system-ui, sans-serif)", minHeight: 600 }}>
        <SuccessScreen state={state} onGoToDashboard={() => setDone(false)} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#020617", letterSpacing: "-0.03em" }}>Company onboarding</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Create a tenant, configure the first branch, add stock locations, stores, and branch admins.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={() => dispatch({ type: "CLEAR_NOTICE" })} disabled={!state.companyId}>
            <i className="ti ti-refresh" style={{ fontSize: 14 }} /> Refresh
          </Btn>
          <Btn variant="ghost">
            <i className="ti ti-building" style={{ fontSize: 14 }} /> Companies
          </Btn>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 20, height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #0f172a 0%, #334155 100%)", width: `${pct}%`, transition: "width .4s ease" }} />
      </div>

      {/* Banners */}
      {state.error  && <Alert tone="danger" title="Action required" message={state.error} />}
      {state.notice && <Alert tone="ok"     title="Saved"           message={state.notice} />}

      {/* Layout: rail + content */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
        {/* Wizard rail */}
        <div style={{ borderRadius: 20, background: "rgba(255,255,255,.96)", border: "1px solid rgba(226,232,240,.9)", boxShadow: "0 10px 30px -18px rgba(15,23,42,.15)", padding: "14px 12px" }}>
          <WizardRail active={state.active} readiness={readiness} onSelect={goTo} />
        </div>

        {/* Step content */}
        <div style={{ borderRadius: 20, background: "rgba(255,255,255,.96)", border: "1px solid rgba(226,232,240,.9)", boxShadow: "0 10px 30px -18px rgba(15,23,42,.15)", overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#020617", letterSpacing: "-0.02em" }}>{STEPS[activeIndex]?.title}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{STEPS[activeIndex]?.subtitle}</div>
          </div>

          <div style={{ padding: "20px 22px" }}>
            {state.active === "company" && (
              <CompanyStep
                existing={state.company}
                settings={state.settings}
                onCreated={(id, company, settings) => dispatch({ type: "COMPANY_CREATED", id, company, settings })}
                onSettingsSaved={settings => dispatch({ type: "SETTINGS_SAVED", settings })}
              />
            )}
            {state.active === "branch" && (
              <BranchStep
                companyId={state.companyId}
                branchId={state.branchId}
                branch={state.branch}
                onCreated={(id, branch) => dispatch({ type: "BRANCH_CREATED", id, branch })}
              />
            )}
            {state.active === "locations" && (
              <StockLocationsStep
                items={state.stockLocations}
                onAdd={item => dispatch({ type: "STOCK_ADDED", item })}
                onRemove={id => dispatch({ type: "STOCK_REMOVED", id })}
              />
            )}
            {state.active === "stores" && (
              <StoresStep
                stores={state.stores}
                stockLocations={state.stockLocations}
                onAdd={item => dispatch({ type: "STORE_ADDED", item })}
                onRemove={id => dispatch({ type: "STORE_REMOVED", id })}
              />
            )}
            {state.active === "users" && (
              <UsersStep
                members={state.members}
                onAdd={item => dispatch({ type: "MEMBER_ADDED", item })}
                onRemove={userId => dispatch({ type: "MEMBER_REMOVED", userId })}
              />
            )}
            {state.active === "review" && (
              <ReviewStep
                state={state}
                readiness={readiness}
                saving={state.saving}
                onFinish={() => setDone(true)}
              />
            )}
          </div>

          {/* Footer nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderTop: "1px solid #f1f5f9", background: "#fafafa" }}>
            <Btn variant="ghost" onClick={back} disabled={activeIndex <= 0}>
              <i className="ti ti-chevron-left" style={{ fontSize: 15 }} /> Back
            </Btn>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Step {activeIndex + 1} of {STEPS.length}
            </div>
            {state.active === "review" ? (
              <Btn variant="primary" onClick={() => setDone(true)} disabled={!readiness.review.done || state.saving}>
                {state.saving ? "Finishing…" : "Finish setup"}
                <i className="ti ti-circle-check" style={{ fontSize: 15 }} />
              </Btn>
            ) : (
              <Btn variant="primary" onClick={next} disabled={activeIndex >= STEPS.length - 1}>
                Continue <i className="ti ti-chevron-right" style={{ fontSize: 15 }} />
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
