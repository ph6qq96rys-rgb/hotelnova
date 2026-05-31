// src/modules/company/onboarding/steps/CompanyStep.tsx
//
// All companies are listed as rows. Each row can be expanded inline to
// configure or modify that company. The active company is highlighted.
// A collapsible "Register new company" form sits at the bottom.

import { useEffect, useState } from "react";
import type React from "react";
import type { CompanyDto, CompanySettingsDto, CreateCompanyDto } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import {
  DEFAULT_SETTINGS,
  CURRENCY_OPTIONS, TIMEZONE_OPTIONS, COSTING_OPTIONS,
} from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction } from "../state/onboarding.types";
import { extractApiError, trimOrNull } from "../utils/onboarding.utils";
import {
  Field, Input, SelectInput, Toggle, Btn, Alert, SectionTitle, EmptyState,
} from "../components/company.ui";

// ── Form data ─────────────────────────────────────────────────────────────────

interface CompanyFormData {
  legalName:                  string;
  tradeName:                  string;
  tinNumber:                  string;
  businessRegistrationNumber: string;
  vatNumber:                  string;
  phone:                      string;
  email:                      string;
  country:                    string;
  city:                       string;
  addressLine:                string;
  defaultCurrency:            string;
  timezone:                   string;
}

const EMPTY_FORM: CompanyFormData = {
  legalName:                  "",
  tradeName:                  "",
  tinNumber:                  "",
  businessRegistrationNumber: "",
  vatNumber:                  "",
  phone:                      "",
  email:                      "",
  country:                    "Ethiopia",
  city:                       "Addis Ababa",
  addressLine:                "",
  defaultCurrency:            "ETB",
  timezone:                   "Africa/Addis_Ababa",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getId(c: CompanyDto): string {
  return String((c as any).id ?? "");
}

function dtoToForm(c: CompanyDto): CompanyFormData {
  const a = c as any;
  return {
    legalName:                  a.legalName                  ?? "",
    tradeName:                  a.tradeName                  ?? "",
    tinNumber:                  a.tinNumber                  ?? "",
    businessRegistrationNumber: a.businessRegistrationNumber ?? "",
    vatNumber:                  a.vatNumber                  ?? "",
    phone:                      a.phone                      ?? "",
    email:                      a.email                      ?? "",
    country:                    a.country                    ?? "Ethiopia",
    city:                       a.city                       ?? "Addis Ababa",
    addressLine:                a.addressLine                ?? "",
    defaultCurrency:            a.defaultCurrency            ?? "ETB",
    timezone:                   a.timezone                   ?? "Africa/Addis_Ababa",
  };
}

function formToPayload(f: CompanyFormData) {
  return {
    legalName:                  f.legalName.trim()                  || null,
    tradeName:                  trimOrNull(f.tradeName),
    tinNumber:                  trimOrNull(f.tinNumber),
    businessRegistrationNumber: trimOrNull(f.businessRegistrationNumber),
    vatNumber:                  trimOrNull(f.vatNumber),
    phone:                      trimOrNull(f.phone),
    email:                      trimOrNull(f.email),
    country:                    trimOrNull(f.country),
    city:                       trimOrNull(f.city),
    addressLine:                trimOrNull(f.addressLine),
    defaultCurrency:            f.defaultCurrency.trim().toUpperCase() || "ETB",
    timezone:                   f.timezone.trim() || "Africa/Addis_Ababa",
  };
}

function validate(f: CompanyFormData, setErrors: (e: FieldErrors) => void): boolean {
  const e: FieldErrors = {};
  if (!f.legalName.trim())       e.legalName       = "Legal name is required.";
  if (!f.defaultCurrency.trim()) e.defaultCurrency = "Currency is required.";
  if (!f.timezone.trim())        e.timezone        = "Timezone is required.";
  setErrors(e);
  return Object.keys(e).length === 0;
}

function statusBadge(status?: string) {
  switch (String(status ?? "").toLowerCase()) {
    case "active":  return { label: "Active",  cls: "ob-badge ob-badge--success" };
    case "pending": return { label: "Pending", cls: "ob-badge ob-badge--warn"    };
    case "draft":   return { label: "Draft",   cls: "ob-badge ob-badge--warn"    };
    default:        return { label: status ?? "—", cls: "ob-badge"               };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompanyStep(props: {
  companies:       CompanyDto[];
  existing:        CompanyDto | null;
  defaultSettings: CompanySettingsDto;
  saving:          boolean;
  onSelected:      (companyId: string) => void;
  onCreated:       (company: CompanyDto) => Promise<void> | void;
  onSaved:         (settings: CompanySettingsDto) => void;
  dispatch:        React.Dispatch<OnboardingAction>;
}) {
  const activeId = getId(props.existing ?? ({} as CompanyDto));

  // Which company row is expanded for configuration (null = none)
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [editForm,      setEditForm]      = useState<CompanyFormData>({ ...EMPTY_FORM });
  const [editSettings,  setEditSettings]  = useState<CompanySettingsDto>({ ...props.defaultSettings });
  const [editErrors,    setEditErrors]    = useState<FieldErrors>({});
  const [editSaving,    setEditSaving]    = useState(false);

  // Create form state
  const [showCreate,    setShowCreate]    = useState(false);
  const [createForm,    setCreateForm]    = useState<CompanyFormData>({ ...EMPTY_FORM });
  const [createSettings,setCreateSettings] = useState<CompanySettingsDto>({ ...DEFAULT_SETTINGS });
  const [createErrors,  setCreateErrors]  = useState<FieldErrors>({});

  // Auto-open create form when there are no companies yet
  useEffect(() => {
    if (props.companies.length === 0) setShowCreate(true);
  }, [props.companies.length]);

  // ── Expand / collapse ──────────────────────────────────────────────────────

  function openEdit(c: CompanyDto) {
    setExpandedId(getId(c));
    setEditForm(dtoToForm(c));
    setEditSettings({ ...props.defaultSettings });
    setEditErrors({});
  }

  function closeEdit() {
    setExpandedId(null);
    setEditErrors({});
  }

  // ── Save existing ──────────────────────────────────────────────────────────

  async function saveEdit(cid: string) {
    if (!validate(editForm, setEditErrors)) return;
    setEditSaving(true);
    props.dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.updateCompany(cid, formToPayload(editForm) as any);
      const saved = await onboardingApi.upsertCompanySettings(cid, editSettings);
      closeEdit();
      props.onSaved(saved);
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Company updated." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update company.") });
    } finally {
      setEditSaving(false);
    }
  }

  // ── Create new ─────────────────────────────────────────────────────────────

  async function create() {
    if (!validate(createForm, setCreateErrors)) return;
    props.dispatch({ type: "SAVE_START" });
    try {
      const created = await onboardingApi.createCompany(formToPayload(createForm) as CreateCompanyDto);
      const cid = getId(created as CompanyDto);
      await onboardingApi.upsertCompanySettings(cid, createSettings).catch(() => null);
      setCreateForm({ ...EMPTY_FORM });
      setShowCreate(false);
      await props.onCreated(created as CompanyDto);
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to create company.") });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Company list ─────────────────────────────────────────────────── */}
      {props.companies.length === 0 && !showCreate && (
        <EmptyState
          title="No companies found"
          sub="Use the form below to register the first company."
        />
      )}

      {props.companies.map((c) => {
        const cid        = getId(c);
        const a          = c as any;
        const isActive   = cid === activeId;
        const isExpanded = expandedId === cid;
        const badge      = statusBadge(a.status);

        return (
          <div
            key={cid}
            style={{
              border:       isActive ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
              borderRadius: 12,
              background:   isActive ? "#f5f3ff" : "#fff",
              overflow:     "hidden",
              transition:   "border-color 0.15s",
            }}
          >
            {/* ── Row summary ──────────────────────────────────────────── */}
            <div style={{
              display:        "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems:     "center",
              gap:            12,
              padding:        "12px 16px",
            }}>
              {/* Active indicator */}
              <div style={{
                width:      10,
                height:     10,
                borderRadius: "50%",
                flexShrink: 0,
                background: isActive ? "#6366f1" : "#e2e8f0",
                border:     isActive ? "2px solid #a5b4fc" : "2px solid #e2e8f0",
              }} />

              {/* Company info */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {c.legalName}
                  </span>
                  {a.tradeName && (
                    <span style={{ fontSize: 11, color: "#64748b" }}>({a.tradeName})</span>
                  )}
                  <span className={badge.cls}>{badge.label}</span>
                  {isActive && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "#6366f1",
                      background: "#ede9fe", padding: "1px 7px",
                      borderRadius: 999, border: "1px solid #c4b5fd",
                    }}>
                      Active
                    </span>
                  )}
                </div>
                {/* Key registration details */}
                <div style={{
                  display:   "flex",
                  gap:       14,
                  marginTop: 4,
                  flexWrap:  "wrap",
                  fontSize:  11,
                  color:     "#94a3b8",
                }}>
                  {a.defaultCurrency && <span>{a.defaultCurrency}</span>}
                  {a.city            && <span>{a.city}</span>}
                  {a.tinNumber       && <span>TIN: {a.tinNumber}</span>}
                  {a.businessRegistrationNumber && (
                    <span>Reg: {a.businessRegistrationNumber}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!isActive && (
                  <Btn
                    variant="primary"
                    onClick={() => props.onSelected(cid)}
                    disabled={props.saving || editSaving}
                    style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}
                  >
                    Select
                  </Btn>
                )}
                <Btn
                  variant="ghost"
                  onClick={() => isExpanded ? closeEdit() : openEdit(c)}
                  disabled={editSaving}
                  style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}
                >
                  {isExpanded ? "Close" : "Configure"}
                </Btn>
              </div>
            </div>

            {/* ── Inline configuration form ─────────────────────────── */}
            {isExpanded && (
              <div style={{
                borderTop:  "1px solid #e2e8f0",
                background: "#f8fafc",
                padding:    "20px 16px",
                display:    "flex",
                flexDirection: "column",
                gap:        20,
              }}>
                {Object.values(editErrors).filter(Boolean).map((msg, i) => (
                  <Alert key={i} tone="danger" title="Validation" message={msg!} />
                ))}

                <IdentityFields form={editForm} onChange={setEditForm} errors={editErrors} />
                <ContactFields  form={editForm} onChange={setEditForm} />
                <FiscalFields   form={editForm} onChange={setEditForm} errors={editErrors} />

                <SectionTitle
                  title="Operational settings"
                  subtitle="VAT and inventory costing applied across all branches"
                />
                <SettingsFields settings={editSettings} onChange={setEditSettings} />

                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
                  <Btn
                    variant="ghost"
                    onClick={closeEdit}
                    disabled={editSaving}
                  >
                    Discard
                  </Btn>
                  <Btn
                    variant="primary"
                    onClick={() => saveEdit(cid)}
                    disabled={editSaving}
                  >
                    {editSaving ? "Saving…" : "Save changes"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Register new company (collapsible) ───────────────────────────── */}
      <div
        style={{
          border:       "1px dashed #cbd5e1",
          borderRadius: 12,
          overflow:     "hidden",
          background:   "#fff",
        }}
      >
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          style={{
            width:          "100%",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            padding:        "12px 16px",
            background:     "none",
            border:         "none",
            cursor:         "pointer",
            borderBottom:   showCreate ? "1px solid #e2e8f0" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width:       28,
              height:      28,
              borderRadius: 8,
              background:  "#f0fdf4",
              border:      "1px solid #bbf7d0",
              display:     "flex",
              alignItems:  "center",
              justifyContent: "center",
              fontSize:    16,
              color:       "#16a34a",
              flexShrink:  0,
            }}>
              +
            </span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                Register new company
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                Create a new tenant with its own branches, inventory, and users
              </div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {showCreate ? "▲" : "▼"}
          </span>
        </button>

        {/* Create form */}
        {showCreate && (
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
            {Object.values(createErrors).filter(Boolean).map((msg, i) => (
              <Alert key={i} tone="danger" title="Validation" message={msg!} />
            ))}

            <IdentityFields form={createForm} onChange={setCreateForm} errors={createErrors} />
            <ContactFields  form={createForm} onChange={setCreateForm} />
            <FiscalFields   form={createForm} onChange={setCreateForm} errors={createErrors} />

            <SectionTitle
              title="Operational settings"
              subtitle="VAT and inventory costing applied across all branches"
            />
            <SettingsFields settings={createSettings} onChange={setCreateSettings} />

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
              <Btn
                variant="primary"
                onClick={create}
                disabled={props.saving}
              >
                {props.saving ? "Registering…" : "Register company"}
              </Btn>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Sub-forms ─────────────────────────────────────────────────────────────────

function IdentityFields({
  form, onChange, errors,
}: {
  form:     CompanyFormData;
  onChange: React.Dispatch<React.SetStateAction<CompanyFormData>>;
  errors:   FieldErrors;
}) {
  const set = (p: Partial<CompanyFormData>) => onChange((f) => ({ ...f, ...p }));
  return (
    <div>
      <SectionTitle title="Company identity" subtitle="Legal registration and tax details" />
      <div className="ob-grid-2" style={{ marginTop: 12 }}>
        <Field label="Legal name" required hint={errors.legalName}>
          <Input value={form.legalName} onChange={(v) => set({ legalName: v })}
            placeholder="e.g. Dako Restaurant PLC" />
        </Field>
        <Field label="Trade / brand name" hint="Operating name if different from legal name">
          <Input value={form.tradeName} onChange={(v) => set({ tradeName: v })}
            placeholder="e.g. Dako Restaurant" />
        </Field>
        <Field label="TIN" hint="Tax Identification Number">
          <Input value={form.tinNumber} onChange={(v) => set({ tinNumber: v })}
            placeholder="e.g. 0012345678" />
        </Field>
        <Field label="Business Registration No." hint="From the trade bureau">
          <Input value={form.businessRegistrationNumber}
            onChange={(v) => set({ businessRegistrationNumber: v })}
            placeholder="e.g. AA/BN/12345/2023" />
        </Field>
        <Field label="VAT Registration No." hint="Leave blank if not VAT-registered">
          <Input value={form.vatNumber} onChange={(v) => set({ vatNumber: v })}
            placeholder="e.g. ETH-VAT-00001" />
        </Field>
      </div>
    </div>
  );
}

function ContactFields({
  form, onChange,
}: {
  form:     CompanyFormData;
  onChange: React.Dispatch<React.SetStateAction<CompanyFormData>>;
}) {
  const set = (p: Partial<CompanyFormData>) => onChange((f) => ({ ...f, ...p }));
  return (
    <div>
      <SectionTitle title="Contact & location" subtitle="Registered address and contact details" />
      <div className="ob-grid-2" style={{ marginTop: 12 }}>
        <Field label="Country">
          <Input value={form.country} onChange={(v) => set({ country: v })}
            placeholder="Ethiopia" />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(v) => set({ city: v })}
            placeholder="Addis Ababa" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(v) => set({ phone: v })}
            placeholder="+251 911 000 000" type="tel" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(v) => set({ email: v })}
            placeholder="info@company.com" type="email" />
        </Field>
      </div>
      <div style={{ marginTop: 12 }}>
        <Field label="Address line">
          <Input value={form.addressLine} onChange={(v) => set({ addressLine: v })}
            placeholder="Street / Building / Sub-city / Woreda" />
        </Field>
      </div>
    </div>
  );
}

function FiscalFields({
  form, onChange, errors,
}: {
  form:     CompanyFormData;
  onChange: React.Dispatch<React.SetStateAction<CompanyFormData>>;
  errors:   FieldErrors;
}) {
  const set = (p: Partial<CompanyFormData>) => onChange((f) => ({ ...f, ...p }));
  return (
    <div>
      <SectionTitle
        title="Fiscal configuration"
        subtitle="Currency and timezone affect all reports and documents"
      />
      <div className="ob-grid-2" style={{ marginTop: 12 }}>
        <Field label="Default currency" required hint={errors.defaultCurrency}>
          <SelectInput value={form.defaultCurrency}
            onChange={(v) => set({ defaultCurrency: v.toUpperCase() })}
            options={CURRENCY_OPTIONS} />
        </Field>
        <Field label="Timezone" required hint={errors.timezone}>
          <SelectInput value={form.timezone}
            onChange={(v) => set({ timezone: v })}
            options={TIMEZONE_OPTIONS} />
        </Field>
      </div>
    </div>
  );
}

function SettingsFields({
  settings, onChange,
}: {
  settings: CompanySettingsDto;
  onChange: (s: CompanySettingsDto) => void;
}) {
  const s   = settings as any;
  const set = (p: object) => onChange({ ...settings, ...p } as CompanySettingsDto);
  return (
    <div className="ob-inner-card">
      <div className="ob-inner-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="ob-toggle-row">
          <div>
            <div className="ob-toggle-row__title">VAT enabled</div>
            <div className="ob-toggle-row__sub">Apply VAT to sales and invoices</div>
          </div>
          <Toggle checked={!!s.vatEnabled} onChange={(v) => set({ vatEnabled: v })} />
        </div>
        <div className="ob-grid-2">
          <Field label="VAT rate (%)" hint="e.g. 15 for 15%">
            <Input type="number"
              value={String(s.vatRate != null ? Math.round(s.vatRate * 100) : 0)}
              onChange={(v) => set({ vatRate: (parseFloat(v) || 0) / 100 })}
              placeholder="15" />
          </Field>
          <Field label="Costing method">
            <SelectInput value={String(s.costingMethod ?? "FIFO")}
              onChange={(v) => set({ costingMethod: v })}
              options={COSTING_OPTIONS} />
          </Field>
        </div>
      </div>
    </div>
  );
}