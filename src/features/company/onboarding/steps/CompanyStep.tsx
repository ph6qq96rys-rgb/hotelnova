// src/modules/company/onboarding/steps/CompanyStep.tsx
//
// ERP-grade company onboarding step.
// Fixes:
// - After registering a new company, the new company is selected immediately.
// - Parent wizard receives the created company after local selection is completed.
// - Save state is always closed with SAVE_SUCCESS or SAVE_ERROR.
// - Prevents branch step from receiving an empty companyId.
// - Keeps existing companies configurable inline.

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
import type {
  FieldErrors,
  OnboardingAction,
} from "../state/onboarding.types";
import {
  extractApiError,
  trimOrNull,
} from "../utils/onboarding.utils";

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

interface CompanyFormData {
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
}

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

function getCompanyId(company: Partial<CompanyDto> | null | undefined): string {
  const value = company as any;
  return String(value?.id ?? value?.companyId ?? value?.Id ?? "").trim();
}

function dtoToForm(company: CompanyDto): CompanyFormData {
  const value = company as any;

  return {
    legalName: value.legalName ?? "",
    tradeName: value.tradeName ?? "",
    tinNumber: value.tinNumber ?? "",
    businessRegistrationNumber: value.businessRegistrationNumber ?? "",
    vatNumber: value.vatNumber ?? "",
    phone: value.phone ?? "",
    email: value.email ?? "",
    country: value.country ?? "Ethiopia",
    city: value.city ?? "Addis Ababa",
    addressLine: value.addressLine ?? "",
    defaultCurrency: value.defaultCurrency ?? "ETB",
    timezone: value.timezone ?? "Africa/Addis_Ababa",
  };
}

function formToPayload(form: CompanyFormData): CreateCompanyDto {
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

function validateCompanyForm(
  form: CompanyFormData,
  setErrors: (errors: FieldErrors) => void,
): boolean {
  const errors: FieldErrors = {};

  if (!form.legalName.trim()) {
    errors.legalName = "Legal name is required.";
  }

  if (!form.defaultCurrency.trim()) {
    errors.defaultCurrency = "Currency is required.";
  }

  if (!form.timezone.trim()) {
    errors.timezone = "Timezone is required.";
  }

  setErrors(errors);
  return Object.keys(errors).length === 0;
}

function statusBadge(status?: string | null) {
  switch (String(status ?? "").toLowerCase()) {
    case "active":
      return {
        label: "Active",
        cls: "ob-badge ob-badge--success",
      };

    case "pending":
      return {
        label: "Pending",
        cls: "ob-badge ob-badge--warn",
      };

    case "draft":
      return {
        label: "Draft",
        cls: "ob-badge ob-badge--warn",
      };

    default:
      return {
        label: status || "—",
        cls: "ob-badge",
      };
  }
}

export function CompanyStep(props: {
  companies: CompanyDto[];
  existing: CompanyDto | null;
  defaultSettings: CompanySettingsDto;
  saving: boolean;
  onSelected: (companyId: string) => void;
  onCreated: (company: CompanyDto) => Promise<void> | void;
  onSaved: (settings: CompanySettingsDto) => void;
  dispatch: React.Dispatch<OnboardingAction>;
}) {
  const activeId = useMemo(
    () => getCompanyId(props.existing),
    [props.existing],
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState<CompanyFormData>({ ...EMPTY_FORM });
  const [editSettings, setEditSettings] = useState<CompanySettingsDto>({
    ...props.defaultSettings,
  });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editSaving, setEditSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CompanyFormData>({
    ...EMPTY_FORM,
  });
  const [createSettings, setCreateSettings] = useState<CompanySettingsDto>({
    ...DEFAULT_SETTINGS,
  });
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    if (props.companies.length === 0) {
      setShowCreate(true);
    }
  }, [props.companies.length]);

  function openEdit(company: CompanyDto) {
    setExpandedId(getCompanyId(company));
    setEditForm(dtoToForm(company));
    setEditSettings({ ...props.defaultSettings });
    setEditErrors({});
  }

  function closeEdit() {
    setExpandedId(null);
    setEditErrors({});
  }

  async function selectCompany(companyId: string) {
    if (!companyId) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: "Company was saved, but the server did not return a valid company id.",
      });
      return;
    }

    props.onSelected(companyId);
  }

  async function saveEdit(companyId: string) {
    if (!companyId) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: "Invalid company selection.",
      });
      return;
    }

    if (!validateCompanyForm(editForm, setEditErrors)) {
      return;
    }

    setEditSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      await onboardingApi.updateCompany(companyId, formToPayload(editForm) as any);

      const savedSettings = await onboardingApi.upsertCompanySettings(
        companyId,
        editSettings,
      );

      closeEdit();
      props.onSaved(savedSettings);
      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "Company updated successfully.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to update company."),
      });
    } finally {
      setEditSaving(false);
    }
  }

  async function createCompany() {
    if (!validateCompanyForm(createForm, setCreateErrors)) {
      return;
    }

    setCreateSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      const created = (await onboardingApi.createCompany(
        formToPayload(createForm),
      )) as CompanyDto;

      const companyId = getCompanyId(created);

      if (!companyId) {
        throw new Error("Company was created, but the API response did not include company id.");
      }

      const savedSettings = await onboardingApi
        .upsertCompanySettings(companyId, createSettings)
        .catch(() => null);

      // Critical fix:
      // Select the company first so Branch step receives a non-empty companyId.
      await selectCompany(companyId);

      if (savedSettings) {
        props.onSaved(savedSettings);
      }

      setCreateForm({ ...EMPTY_FORM });
      setCreateSettings({ ...DEFAULT_SETTINGS });
      setCreateErrors({});
      setShowCreate(false);
      setExpandedId(null);

      await props.onCreated(created);

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "Company registered successfully. Continue with branch setup.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to create company."),
      });
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {props.companies.length === 0 && !showCreate && (
        <EmptyState
          title="No companies found"
          sub="Use the form below to register the first company."
        />
      )}

      {props.companies.map((company) => {
        const companyId = getCompanyId(company);
        const value = company as any;
        const isActive = companyId === activeId;
        const isExpanded = expandedId === companyId;
        const badge = statusBadge(value.status);

        return (
          <div
            key={companyId}
            style={{
              border: isActive ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
              borderRadius: 12,
              background: isActive ? "#f5f3ff" : "#fff",
              overflow: "hidden",
              transition: "border-color 0.15s",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: isActive ? "#6366f1" : "#e2e8f0",
                  border: isActive
                    ? "2px solid #a5b4fc"
                    : "2px solid #e2e8f0",
                }}
              />

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    {company.legalName}
                  </span>

                  {value.tradeName && (
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      ({value.tradeName})
                    </span>
                  )}

                  <span className={badge.cls}>{badge.label}</span>

                  {isActive && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#6366f1",
                        background: "#ede9fe",
                        padding: "1px 7px",
                        borderRadius: 999,
                        border: "1px solid #c4b5fd",
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    marginTop: 4,
                    flexWrap: "wrap",
                    fontSize: 11,
                    color: "#94a3b8",
                  }}
                >
                  {value.defaultCurrency && <span>{value.defaultCurrency}</span>}
                  {value.city && <span>{value.city}</span>}
                  {value.tinNumber && <span>TIN: {value.tinNumber}</span>}
                  {value.businessRegistrationNumber && (
                    <span>Reg: {value.businessRegistrationNumber}</span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!isActive && (
                  <Btn
                    variant="primary"
                    onClick={() => void selectCompany(companyId)}
                    disabled={props.saving || editSaving || createSaving}
                    style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}
                  >
                    Select
                  </Btn>
                )}

                <Btn
                  variant="ghost"
                  onClick={() => (isExpanded ? closeEdit() : openEdit(company))}
                  disabled={editSaving || createSaving}
                  style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}
                >
                  {isExpanded ? "Close" : "Configure"}
                </Btn>
              </div>
            </div>

            {isExpanded && (
              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  padding: "20px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {Object.values(editErrors)
                  .filter(Boolean)
                  .map((message, index) => (
                    <Alert
                      key={index}
                      tone="danger"
                      title="Validation"
                      message={message!}
                    />
                  ))}

                <IdentityFields
                  form={editForm}
                  onChange={setEditForm}
                  errors={editErrors}
                />
                <ContactFields form={editForm} onChange={setEditForm} />
                <FiscalFields
                  form={editForm}
                  onChange={setEditForm}
                  errors={editErrors}
                />

                <SectionTitle
                  title="Operational settings"
                  subtitle="VAT and inventory costing applied across all branches"
                />

                <SettingsFields
                  settings={editSettings}
                  onChange={setEditSettings}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 4,
                  }}
                >
                  <Btn variant="ghost" onClick={closeEdit} disabled={editSaving}>
                    Discard
                  </Btn>

                  <Btn
                    variant="primary"
                    onClick={() => void saveEdit(companyId)}
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

      <div
        style={{
          border: "1px dashed #cbd5e1",
          borderRadius: 12,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          disabled={createSaving}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "none",
            border: "none",
            cursor: createSaving ? "not-allowed" : "pointer",
            borderBottom: showCreate ? "1px solid #e2e8f0" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                color: "#16a34a",
                flexShrink: 0,
              }}
            >
              +
            </span>

            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
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

        {showCreate && (
          <div
            style={{
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {Object.values(createErrors)
              .filter(Boolean)
              .map((message, index) => (
                <Alert
                  key={index}
                  tone="danger"
                  title="Validation"
                  message={message!}
                />
              ))}

            <IdentityFields
              form={createForm}
              onChange={setCreateForm}
              errors={createErrors}
            />
            <ContactFields form={createForm} onChange={setCreateForm} />
            <FiscalFields
              form={createForm}
              onChange={setCreateForm}
              errors={createErrors}
            />

            <SectionTitle
              title="Operational settings"
              subtitle="VAT and inventory costing applied across all branches"
            />

            <SettingsFields
              settings={createSettings}
              onChange={setCreateSettings}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                paddingTop: 4,
              }}
            >
              <Btn
                variant="primary"
                onClick={() => void createCompany()}
                disabled={props.saving || createSaving}
              >
                {props.saving || createSaving
                  ? "Registering…"
                  : "Register company"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityFields(props: {
  form: CompanyFormData;
  onChange: React.Dispatch<React.SetStateAction<CompanyFormData>>;
  errors: FieldErrors;
}) {
  const set = (patch: Partial<CompanyFormData>) =>
    props.onChange((current) => ({ ...current, ...patch }));

  return (
    <div>
      <SectionTitle
        title="Company identity"
        subtitle="Legal registration and tax details"
      />

      <div className="ob-grid-2" style={{ marginTop: 12 }}>
        <Field label="Legal name" required hint={props.errors.legalName}>
          <Input
            value={props.form.legalName}
            onChange={(value) => set({ legalName: value })}
            placeholder="e.g. Dako Restaurant PLC"
          />
        </Field>

        <Field
          label="Trade / brand name"
          hint="Operating name if different from legal name"
        >
          <Input
            value={props.form.tradeName}
            onChange={(value) => set({ tradeName: value })}
            placeholder="e.g. Dako Restaurant"
          />
        </Field>

        <Field label="TIN" hint="Tax Identification Number">
          <Input
            value={props.form.tinNumber}
            onChange={(value) => set({ tinNumber: value })}
            placeholder="e.g. 0012345678"
          />
        </Field>

        <Field label="Business Registration No." hint="From the trade bureau">
          <Input
            value={props.form.businessRegistrationNumber}
            onChange={(value) =>
              set({ businessRegistrationNumber: value })
            }
            placeholder="e.g. AA/BN/12345/2023"
          />
        </Field>

        <Field label="VAT Registration No." hint="Leave blank if not VAT-registered">
          <Input
            value={props.form.vatNumber}
            onChange={(value) => set({ vatNumber: value })}
            placeholder="e.g. ETH-VAT-00001"
          />
        </Field>
      </div>
    </div>
  );
}

function ContactFields(props: {
  form: CompanyFormData;
  onChange: React.Dispatch<React.SetStateAction<CompanyFormData>>;
}) {
  const set = (patch: Partial<CompanyFormData>) =>
    props.onChange((current) => ({ ...current, ...patch }));

  return (
    <div>
      <SectionTitle
        title="Contact & location"
        subtitle="Registered address and contact details"
      />

      <div className="ob-grid-2" style={{ marginTop: 12 }}>
        <Field label="Country">
          <Input
            value={props.form.country}
            onChange={(value) => set({ country: value })}
            placeholder="Ethiopia"
          />
        </Field>

        <Field label="City">
          <Input
            value={props.form.city}
            onChange={(value) => set({ city: value })}
            placeholder="Addis Ababa"
          />
        </Field>

        <Field label="Phone">
          <Input
            value={props.form.phone}
            onChange={(value) => set({ phone: value })}
            placeholder="+251 911 000 000"
            type="tel"
          />
        </Field>

        <Field label="Email">
          <Input
            value={props.form.email}
            onChange={(value) => set({ email: value })}
            placeholder="info@company.com"
            type="email"
          />
        </Field>
      </div>

      <div style={{ marginTop: 12 }}>
        <Field label="Address line">
          <Input
            value={props.form.addressLine}
            onChange={(value) => set({ addressLine: value })}
            placeholder="Street / Building / Sub-city / Woreda"
          />
        </Field>
      </div>
    </div>
  );
}

function FiscalFields(props: {
  form: CompanyFormData;
  onChange: React.Dispatch<React.SetStateAction<CompanyFormData>>;
  errors: FieldErrors;
}) {
  const set = (patch: Partial<CompanyFormData>) =>
    props.onChange((current) => ({ ...current, ...patch }));

  return (
    <div>
      <SectionTitle
        title="Fiscal configuration"
        subtitle="Currency and timezone affect all reports and documents"
      />

      <div className="ob-grid-2" style={{ marginTop: 12 }}>
        <Field
          label="Default currency"
          required
          hint={props.errors.defaultCurrency}
        >
          <SelectInput
            value={props.form.defaultCurrency}
            onChange={(value) =>
              set({ defaultCurrency: value.toUpperCase() })
            }
            options={CURRENCY_OPTIONS}
          />
        </Field>

        <Field label="Timezone" required hint={props.errors.timezone}>
          <SelectInput
            value={props.form.timezone}
            onChange={(value) => set({ timezone: value })}
            options={TIMEZONE_OPTIONS}
          />
        </Field>
      </div>
    </div>
  );
}

function SettingsFields(props: {
  settings: CompanySettingsDto;
  onChange: (settings: CompanySettingsDto) => void;
}) {
  const settings = props.settings as any;

  const set = (patch: Partial<CompanySettingsDto>) =>
    props.onChange({
      ...props.settings,
      ...patch,
    });

  return (
    <div className="ob-inner-card">
      <div
        className="ob-inner-card-body"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="ob-toggle-row">
          <div>
            <div className="ob-toggle-row__title">VAT enabled</div>
            <div className="ob-toggle-row__sub">
              Apply VAT to sales and invoices
            </div>
          </div>

          <Toggle
            checked={Boolean(settings.vatEnabled)}
            onChange={(value) => set({ vatEnabled: value } as any)}
          />
        </div>

        <div className="ob-grid-2">
          <Field label="VAT rate (%)" hint="e.g. 15 for 15%">
            <Input
              type="number"
              value={String(
                settings.vatRate != null
                  ? Math.round(Number(settings.vatRate) * 100)
                  : 0,
              )}
              onChange={(value) =>
                set({
                  vatRate: (Number.parseFloat(value) || 0) / 100,
                } as any)
              }
              placeholder="15"
            />
          </Field>

          <Field label="Costing method">
            <SelectInput
              value={String(settings.costingMethod ?? "FIFO")}
              onChange={(value) => set({ costingMethod: value } as any)}
              options={COSTING_OPTIONS}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
