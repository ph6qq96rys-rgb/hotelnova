// src/modules/company/onboarding/steps/CompanyStep.tsx
// ERP-grade company onboarding step.
// Security rules:
// - SystemAdmin only: create/switch companies.
// - CompanyAdmin/SystemAdmin: edit selected company profile/settings according to granular permissions.
// - Branch-level users: read-only company context only.

import { useEffect, useMemo, useState } from "react";
import type React from "react";

import type {
  CompanyDto,
  CompanySettingsDto,
  CreateCompanyDto,
} from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import {
  COSTING_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_SETTINGS,
  TIMEZONE_OPTIONS,
} from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction } from "../state/onboarding.types";
import { extractApiError, trimOrNull } from "../utils/onboarding.utils";
import {
  Alert,
  Btn,
  EmptyState,
  Field,
  Input,
  SectionTitle,
  SelectInput,
  Toggle,
} from "../components/company.ui";

type CompanyStepAccess = {
  /** Platform-only. Tenant users should normally receive false. */
  canCreateCompany: boolean;
  /** Platform-only. Tenant users should normally receive false. */
  canSwitchCompany: boolean;
  /** Company profile fields: legal name, TIN, address, contact. */
  canEditCompanyProfile: boolean;
  /** Fiscal/default settings: currency, timezone, costing, stock policy. */
  canEditCompanySettings: boolean;
};

type Props = {
  companies: CompanyDto[];
  existing: CompanyDto | null;
  defaultSettings: CompanySettingsDto;
  saving: boolean;
  access: CompanyStepAccess;
  onSelected: (companyId: string) => void;
  onCreated: (company: CompanyDto) => Promise<void> | void;
  onSaved: (settings: CompanySettingsDto) => void;
  dispatch: React.Dispatch<OnboardingAction>;
};

type CompanyFormData = {
  legalName: string;
  tradeName: string;
  tinNumber: string;
  businessRegistrationNumber: string;
  vatNumber: string;
  phone: string;
  email: string;
  country: string;
  city: string;
  addressLine: string;
  defaultCurrency: string;
  timezone: string;
};

const EMPTY_FORM: CompanyFormData = {
  legalName: "",
  tradeName: "",
  tinNumber: "",
  businessRegistrationNumber: "",
  vatNumber: "",
  phone: "",
  email: "",
  country: "Ethiopia",
  city: "Addis Ababa",
  addressLine: "",
  defaultCurrency: "ETB",
  timezone: "Africa/Addis_Ababa",
};

function idOf(value: any): string {
  return String(value?.id ?? value?.companyId ?? value?.Id ?? "").trim();
}

function dtoToForm(company: CompanyDto): CompanyFormData {
  const x = company as any;
  return {
    legalName: String(x.legalName ?? x.name ?? ""),
    tradeName: String(x.tradeName ?? ""),
    tinNumber: String(x.tinNumber ?? ""),
    businessRegistrationNumber: String(x.businessRegistrationNumber ?? ""),
    vatNumber: String(x.vatNumber ?? ""),
    phone: String(x.phone ?? ""),
    email: String(x.email ?? ""),
    country: String(x.country ?? "Ethiopia"),
    city: String(x.city ?? "Addis Ababa"),
    addressLine: String(x.addressLine ?? ""),
    defaultCurrency: String(x.defaultCurrency ?? "ETB"),
    timezone: String(x.timezone ?? "Africa/Addis_Ababa"),
  };
}

function toPayload(form: CompanyFormData): CreateCompanyDto {
  return {
    legalName: form.legalName.trim(),
    tradeName: trimOrNull(form.tradeName),
    tinNumber: trimOrNull(form.tinNumber),
    businessRegistrationNumber: trimOrNull(form.businessRegistrationNumber),
    vatNumber: trimOrNull(form.vatNumber),
    phone: trimOrNull(form.phone),
    email: trimOrNull(form.email),
    country: trimOrNull(form.country),
    city: trimOrNull(form.city),
    addressLine: trimOrNull(form.addressLine),
    defaultCurrency: form.defaultCurrency.trim().toUpperCase() || "ETB",
    timezone: form.timezone.trim() || "Africa/Addis_Ababa",
  } as CreateCompanyDto;
}

function validateProfile(form: CompanyFormData, setErrors: (e: FieldErrors) => void) {
  const errors: FieldErrors = {};
  if (!form.legalName.trim()) errors.legalName = "Legal name is required.";
  if (!form.defaultCurrency.trim()) errors.defaultCurrency = "Default currency is required.";
  if (!form.timezone.trim()) errors.timezone = "Timezone is required.";
  setErrors(errors);
  return Object.keys(errors).length === 0;
}

function badgeFor(status: unknown) {
  const value = String(status ?? "").toLowerCase();
  if (value === "active") return "ob-badge ob-badge--success";
  if (value === "draft" || value === "pending") return "ob-badge ob-badge--warn";
  return "ob-badge";
}

function ReadonlyRow(props: { label: string; value?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ color: "#94a3b8", fontSize: 12 }}>{props.label}</span>
      <strong style={{ color: "#334155", fontSize: 13 }}>{props.value || "—"}</strong>
    </div>
  );
}

function SettingsEditor(props2: { value: CompanySettingsDto; onChange: (next: CompanySettingsDto) => void; disabled?: boolean }) {
  const s = props2.value as any;
  const change = (patch: Partial<CompanySettingsDto>) => props2.onChange({ ...props2.value, ...patch });
  return (
    <>
      <SectionTitle title="Fiscal and costing defaults" subtitle="These defaults are used by inventory, POS posting, and reports." />
      <div className="ob-grid-2">
        <Field label="Default currency">
          <SelectInput value={String(s.defaultCurrency ?? "ETB")} onChange={(v) => change({ defaultCurrency: v } as any)} options={CURRENCY_OPTIONS as any} disabled={props2.disabled as any} />
        </Field>
        <Field label="Timezone">
          <SelectInput value={String(s.timezone ?? "Africa/Addis_Ababa")} onChange={(v) => change({ timezone: v } as any)} options={TIMEZONE_OPTIONS as any} disabled={props2.disabled as any} />
        </Field>
        <Field label="Costing method">
          <SelectInput value={String(s.costingMethod ?? "FIFO")} onChange={(v) => change({ costingMethod: v } as any)} options={COSTING_OPTIONS as any} disabled={props2.disabled as any} />
        </Field>
        <Field label="Allow negative stock">
          <Toggle checked={Boolean(s.allowNegativeStock)} onChange={(v) => change({ allowNegativeStock: v } as any)} disabled={props2.disabled as any} />
        </Field>
      </div>
    </>
  );
}

function CompanyFields(props2: { value: CompanyFormData; errors: FieldErrors; onChange: (next: CompanyFormData) => void; disabled?: boolean }) {
  const f = props2.value;
  const set = (patch: Partial<CompanyFormData>) => props2.onChange({ ...f, ...patch });
  return (
    <div className="ob-grid-2">
      <Field label="Legal name" required error={props2.errors.legalName}><Input value={f.legalName} onChange={(v) => set({ legalName: v })} placeholder="Company legal name" disabled={props2.disabled as any} /></Field>
      <Field label="Trade name"><Input value={f.tradeName} onChange={(v) => set({ tradeName: v })} placeholder="Brand / trade name" disabled={props2.disabled as any} /></Field>
      <Field label="TIN"><Input value={f.tinNumber} onChange={(v) => set({ tinNumber: v })} disabled={props2.disabled as any} /></Field>
      <Field label="Business registration no."><Input value={f.businessRegistrationNumber} onChange={(v) => set({ businessRegistrationNumber: v })} disabled={props2.disabled as any} /></Field>
      <Field label="VAT no."><Input value={f.vatNumber} onChange={(v) => set({ vatNumber: v })} disabled={props2.disabled as any} /></Field>
      <Field label="Phone"><Input value={f.phone} onChange={(v) => set({ phone: v })} disabled={props2.disabled as any} /></Field>
      <Field label="Email"><Input value={f.email} onChange={(v) => set({ email: v })} disabled={props2.disabled as any} /></Field>
      <Field label="Country"><Input value={f.country} onChange={(v) => set({ country: v })} disabled={props2.disabled as any} /></Field>
      <Field label="City"><Input value={f.city} onChange={(v) => set({ city: v })} disabled={props2.disabled as any} /></Field>
      <Field label="Address"><Input value={f.addressLine} onChange={(v) => set({ addressLine: v })} disabled={props2.disabled as any} /></Field>
    </div>
  );
}

function CompanyReadonly(props2: { company: CompanyDto; defaultSettings: CompanySettingsDto }) {
  const x = props2.company as any;
  return (
    <div className="ob-inner-card-body" style={{ borderTop: "1px solid #e2e8f0" }}>
      <SectionTitle title="Company information" subtitle="Read-only tenant context for your current ERP session." />
      <div className="ob-grid-2">
        <ReadonlyRow label="Legal name" value={x.legalName ?? x.name} />
        <ReadonlyRow label="Trade name" value={x.tradeName} />
        <ReadonlyRow label="TIN" value={x.tinNumber} />
        <ReadonlyRow label="VAT no." value={x.vatNumber} />
        <ReadonlyRow label="Phone" value={x.phone} />
        <ReadonlyRow label="Email" value={x.email} />
        <ReadonlyRow label="City" value={x.city} />
        <ReadonlyRow label="Currency" value={x.defaultCurrency ?? (props2.defaultSettings as any)?.defaultCurrency ?? "ETB"} />
      </div>
    </div>
  );
}

export function CompanyStep(props: Props) {
  const activeId = useMemo(() => idOf(props.existing), [props.existing]);
  const canEditAnything = props.access.canEditCompanyProfile || props.access.canEditCompanySettings;

  const visibleCompanies = useMemo(() => {
    if (props.access.canSwitchCompany) return props.companies;
    return props.companies.filter((company) => idOf(company) === activeId);
  }, [activeId, props.access.canSwitchCompany, props.companies]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CompanyFormData>({ ...EMPTY_FORM });
  const [editSettings, setEditSettings] = useState<CompanySettingsDto>({ ...props.defaultSettings });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editSaving, setEditSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CompanyFormData>({ ...EMPTY_FORM });
  const [createSettings, setCreateSettings] = useState<CompanySettingsDto>({ ...DEFAULT_SETTINGS });
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    if (props.access.canCreateCompany && props.companies.length === 0) setShowCreate(true);
    if (!props.access.canCreateCompany) setShowCreate(false);
  }, [props.access.canCreateCompany, props.companies.length]);

  useEffect(() => {
    setEditSettings({ ...props.defaultSettings });
  }, [props.defaultSettings]);

  function openEdit(company: CompanyDto) {
    if (!canEditAnything) return;
    setExpandedId(idOf(company));
    setEditForm(dtoToForm(company));
    setEditSettings({ ...props.defaultSettings });
    setEditErrors({});
  }

  async function saveEdit(companyId: string) {
    if (!canEditAnything) {
      props.dispatch({ type: "SAVE_ERROR", error: "You are not authorized to configure this company." });
      return;
    }

    if (!companyId) return;
    if (props.access.canEditCompanyProfile && !validateProfile(editForm, setEditErrors)) return;

    setEditSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      let savedSettings: CompanySettingsDto | null = null;

      if (props.access.canEditCompanyProfile) {
        await onboardingApi.updateCompany(companyId, toPayload(editForm) as any);
      }

      if (props.access.canEditCompanySettings) {
        savedSettings = await onboardingApi.upsertCompanySettings(companyId, editSettings);
        props.onSaved(savedSettings);
      }

      setExpandedId(null);
      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: savedSettings ? "Company profile and settings updated." : "Company profile updated.",
      });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update company.") });
    } finally {
      setEditSaving(false);
    }
  }

  async function createCompany() {
    if (!props.access.canCreateCompany) {
      props.dispatch({ type: "SAVE_ERROR", error: "Only a SystemAdmin can register a new company." });
      return;
    }

    if (!validateProfile(createForm, setCreateErrors)) return;

    setCreateSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      const created = await onboardingApi.createCompany(toPayload(createForm));
      const companyId = idOf(created);
      if (!companyId) throw new Error("Company was created but the API did not return a company id.");

      const savedSettings = await onboardingApi.upsertCompanySettings(companyId, createSettings).catch(() => null);

      props.onSelected(companyId);
      if (savedSettings) props.onSaved(savedSettings);
      await props.onCreated(created as CompanyDto);

      setCreateForm({ ...EMPTY_FORM });
      setCreateSettings({ ...DEFAULT_SETTINGS });
      setCreateErrors({});
      setShowCreate(false);
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Company registered. Continue with branch setup." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to create company.") });
    } finally {
      setCreateSaving(false);
    }
  }

  function selectCompany(companyId: string) {
    if (!props.access.canSwitchCompany) {
      props.dispatch({ type: "SAVE_ERROR", error: "Your role cannot switch companies." });
      return;
    }
    props.onSelected(companyId);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!canEditAnything && (
        <Alert tone="warn" title="Company administration is locked" message="Your role can operate inside assigned branches only. Company registration, switching, and configuration are restricted." />
      )}

      {visibleCompanies.length === 0 && !showCreate && (
        <EmptyState title="No company available" sub={props.access.canCreateCompany ? "Register the company before branch setup." : "Your account is not assigned to a company in this tenant."} />
      )}

      {visibleCompanies.map((company) => {
        const companyId = idOf(company);
        const x = company as any;
        const active = companyId === activeId;
        const expanded = expandedId === companyId;
        return (
          <div key={companyId} className="ob-inner-card" style={{ borderColor: active ? "#6366f1" : undefined }}>
            <div className="ob-inner-card-body" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <strong>{x.legalName ?? x.name}</strong>
                  {x.tradeName && <span style={{ color: "#64748b", fontSize: 12 }}>({x.tradeName})</span>}
                  <span className={badgeFor(x.status)}>{x.status ?? (x.isActive === false ? "Inactive" : "Active")}</span>
                  {active && <span className="ob-badge ob-badge--success">Selected</span>}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{x.city ?? "—"} · {x.defaultCurrency ?? (props.defaultSettings as any)?.defaultCurrency ?? "ETB"}</div>
              </div>

              {props.access.canSwitchCompany ? (
                <Btn variant="ghost" onClick={() => selectCompany(companyId)} disabled={!companyId || active}>Use company</Btn>
              ) : (
                <span className="ob-badge">Company locked</span>
              )}

              {canEditAnything ? (
                <Btn variant="ghost" onClick={() => (expanded ? setExpandedId(null) : openEdit(company))}>{expanded ? "Close" : "Configure"}</Btn>
              ) : null}
            </div>

            {expanded && canEditAnything && (
              <div className="ob-inner-card-body" style={{ borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 16 }}>
                {Object.values(editErrors).filter(Boolean).map((m) => <Alert key={m} tone="danger" title="Validation" message={m!} />)}
                <CompanyFields value={editForm} errors={editErrors} onChange={setEditForm} disabled={!props.access.canEditCompanyProfile} />
                <SettingsEditor value={editSettings} onChange={setEditSettings} disabled={!props.access.canEditCompanySettings} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Btn variant="primary" onClick={() => void saveEdit(companyId)} disabled={editSaving || props.saving}>{editSaving ? "Saving…" : "Save company"}</Btn>
                </div>
              </div>
            )}

            {!canEditAnything && active && <CompanyReadonly company={company} defaultSettings={props.defaultSettings} />}
          </div>
        );
      })}

      {props.access.canCreateCompany && (
        <div className="ob-inner-card">
          <button type="button" onClick={() => setShowCreate((x) => !x)} style={{ width: "100%", padding: 14, border: "none", background: "transparent", textAlign: "left", cursor: "pointer" }}>
            <strong>{showCreate ? "Close company form" : "+ Register company"}</strong>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Platform-only tenant identity, fiscal defaults, and ERP baseline settings.</div>
          </button>
          {showCreate && (
            <div className="ob-inner-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.values(createErrors).filter(Boolean).map((m) => <Alert key={m} tone="danger" title="Validation" message={m!} />)}
              <CompanyFields value={createForm} errors={createErrors} onChange={setCreateForm} />
              <SettingsEditor value={createSettings} onChange={setCreateSettings} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Btn variant="primary" onClick={() => void createCompany()} disabled={createSaving || props.saving}>{createSaving ? "Registering…" : "Register company"}</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
