// src/modules/security/pages/SettingsPage.tsx

import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  Database,
  Fingerprint,
  Globe2,
  Paintbrush,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  UserRoundCog,
} from "lucide-react";

import { useAppScope } from "../../../app/useAppScope";
import CompanySettingsPage from "../../../features/company/onboarding/CompanySettingsPage";
import { useAuth } from "../../../auth/AuthProvider";

import "./security.css";

type SettingsSection =
  | "company"
  | "security"
  | "inventory"
  | "pos"
  | "hr"
  | "integrations"
  | "branding"
  | "audit"
  | "platform";

type SettingsNavItem = {
  key: SettingsSection;
  label: string;
  description: string;
  icon: React.ReactNode;
  platformOnly?: boolean;
};

type SettingsForm = {
  companyName: string;
  tradeName: string;
  defaultCurrency: string;
  timezone: string;
  country: string;
  city: string;
  passwordMinLength: number;
  sessionTimeoutMinutes: number;
  requireMfa: boolean;
  allowCompanyAdminUserManagement: boolean;
  defaultInventoryCostMethod: string;
  requireApprovalForAdjustments: boolean;
  requireApprovalForTransfers: boolean;
  allowNegativeStock: boolean;
  defaultPosLocationPolicy: string;
  requireCashierSessionClose: boolean;
  hrAttendanceMode: string;
  requireTelegramAttendance: boolean;
  allowManualAttendanceEdit: boolean;
  telegramBotEnabled: boolean;
  telegramWebhookUrl: string;
  smtpHost: string;
  apiWebhookSecret: string;
  primaryColor: string;
  logoUrl: string;
  uiDensity: string;
  auditRetentionDays: number;
  requireAuditReasonForSensitiveActions: boolean;
  tenantProvisioningEnabled: boolean;
  globalMaintenanceMode: boolean;
};

const NAV_ITEMS: SettingsNavItem[] = [
  {
    key: "company",
    label: "Company Profile",
    description: "Legal identity, location, currency, and locale.",
    icon: <Building2 size={18} />,
  },
  {
    key: "security",
    label: "Security",
    description: "Password policy, session rules, MFA, and admin authority.",
    icon: <ShieldCheck size={18} />,
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Costing, approvals, negative stock, and stock controls.",
    icon: <Database size={18} />,
  },
  {
    key: "pos",
    label: "POS",
    description: "Cashier sessions and sales operating defaults.",
    icon: <Store size={18} />,
  },
  {
    key: "hr",
    label: "HR",
    description: "Attendance mode, Telegram QR, and manual edit policy.",
    icon: <UserRoundCog size={18} />,
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "Telegram, SMTP, webhooks, and external services.",
    icon: <Globe2 size={18} />,
  },
  {
    key: "branding",
    label: "Branding",
    description: "Logo, theme color, and UI density.",
    icon: <Paintbrush size={18} />,
  },
  {
    key: "audit",
    label: "Audit & Compliance",
    description: "Retention, sensitive actions, and governance rules.",
    icon: <Fingerprint size={18} />,
  },
  {
    key: "platform",
    label: "Platform",
    description: "SystemAdmin-only tenant and platform controls.",
    icon: <SlidersHorizontal size={18} />,
    platformOnly: true,
  },
];

function hasRole(user: unknown, roleName: string): boolean {
  const row = user as any;
  const roles = (((row?.roles ?? row?.roleNames ?? []) as string[]) || [])
    .filter(Boolean)
    .map(String);

  return roles.some((role) => role.toLowerCase() === roleName.toLowerCase());
}

function isSystemAdmin(user: unknown): boolean {
  return hasRole(user, "SystemAdmin") || hasRole(user, "SysAdmin");
}

function isCompanyAdmin(user: unknown): boolean {
  return hasRole(user, "CompanyAdmin");
}

function SectionBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return <span className={`sec-chip sec-chip--${tone}`}>{children}</span>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="sec-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className={`sec-toggle${checked ? " is-on" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="sec-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function SettingsPage() {
  const { companyId, companyName } = useAppScope();
  const { hasPermission, user } = useAuth() as any;

  const currentIsSystemAdmin = isSystemAdmin(user);
  const currentIsCompanyAdmin = isCompanyAdmin(user);

  const canView =
    currentIsSystemAdmin ||
    currentIsCompanyAdmin ||
    hasPermission?.("settings.view");

  const canManage =
    currentIsSystemAdmin ||
    currentIsCompanyAdmin;

  const [active, setActive] = useState<SettingsSection>("company");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<SettingsForm>({
    companyName: companyName ?? "",
    tradeName: "",
    defaultCurrency: "USD",
    timezone: "America/Los_Angeles",
    country: "United States",
    city: "",
    passwordMinLength: 8,
    sessionTimeoutMinutes: 30,
    requireMfa: false,
    allowCompanyAdminUserManagement: true,
    defaultInventoryCostMethod: "FIFO",
    requireApprovalForAdjustments: true,
    requireApprovalForTransfers: true,
    allowNegativeStock: false,
    defaultPosLocationPolicy: "Branch default sale location",
    requireCashierSessionClose: true,
    hrAttendanceMode: "Telegram QR + Admin Review",
    requireTelegramAttendance: true,
    allowManualAttendanceEdit: true,
    telegramBotEnabled: false,
    telegramWebhookUrl: "",
    smtpHost: "",
    apiWebhookSecret: "",
    primaryColor: "#2563eb",
    logoUrl: "",
    uiDensity: "Comfortable",
    auditRetentionDays: 365,
    requireAuditReasonForSensitiveActions: true,
    tenantProvisioningEnabled: true,
    globalMaintenanceMode: false,
  });

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.platformOnly || currentIsSystemAdmin),
    [currentIsSystemAdmin]
  );

  const current =
    visibleNavItems.find((item) => item.key === active) ?? visibleNavItems[0];

  const riskCount = [
    !form.requireMfa,
    form.allowNegativeStock,
    !form.requireApprovalForAdjustments,
    !form.requireApprovalForTransfers,
    !form.requireAuditReasonForSensitiveActions,
    form.globalMaintenanceMode,
  ].filter(Boolean).length;

  function update<K extends keyof SettingsForm>(
    key: K,
    value: SettingsForm[K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
    setDirty(true);
    setNotice(null);
  }

  async function save() {
    if (!canManage) return;

    setSaving(true);
    setNotice(null);

    try {
      // TODO: Replace with real backend endpoint:
      // await companySettingsApi.update(companyId, form);
      await Promise.resolve();

      setDirty(false);
      setNotice("Settings staged successfully. Connect this workspace to the company settings API when backend endpoints are ready.");
    } finally {
      setSaving(false);
    }
  }

  if (companyId) {
    return <CompanySettingsPage />;
  }

  if (!companyId && !currentIsSystemAdmin) {
    return (
      <div className="sec-page">
        <div className="sec-empty-state">
          <Building2 size={32} />
          <h2>No company selected</h2>
          <p>Select a company workspace before managing ERP settings.</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="sec-page">
        <div className="sec-empty-state">
          <ShieldCheck size={32} />
          <h2>Access denied</h2>
          <p>You do not have permission to view company settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sec-page sec-settings-page">
      <section className="sec-settings-hero">
        <div>
          <p className="sec-kicker">
            {currentIsSystemAdmin && !companyId ? "Platform Settings" : "Company Settings"}
          </p>
          <h1 className="sec-page-title">ERP Settings Console</h1>
          <p className="sec-page-subtitle">
            Configure company defaults, operational controls, security policy,
            integrations, branding, and compliance governance.
          </p>

          <div className="sec-chip-list">
            <SectionBadge tone="success">
              {companyId ? "Company scoped" : "Platform scoped"}
            </SectionBadge>
            {currentIsCompanyAdmin && <SectionBadge tone="success">CompanyAdmin</SectionBadge>}
            {currentIsSystemAdmin && <SectionBadge tone="warning">SystemAdmin</SectionBadge>}
            {dirty && <SectionBadge tone="warning">Unsaved changes</SectionBadge>}
          </div>
        </div>

        <div className="sec-settings-hero__actions">
          <button
            type="button"
            className="sec-btn"
            disabled={!dirty || saving}
            onClick={() => {
              setDirty(false);
              setNotice(null);
            }}
          >
            Discard
          </button>

          <button
            type="button"
            className="sec-btn sec-btn--primary"
            disabled={!canManage || saving || !dirty}
            onClick={save}
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {notice && (
        <div className="sec-alert sec-alert--success" role="status">
          {notice}
        </div>
      )}

      <section className="sec-kpi-grid">
        <Kpi
          label="Scope"
          value={currentIsSystemAdmin && !companyId ? "Platform" : "Company"}
          hint="Settings apply inside the selected workspace."
        />
        <Kpi
          label="Security"
          value={form.requireMfa ? "MFA On" : "MFA Optional"}
          hint={`${form.passwordMinLength}+ character password policy`}
        />
        <Kpi
          label="Inventory"
          value={form.defaultInventoryCostMethod}
          hint={form.allowNegativeStock ? "Negative stock allowed" : "Negative stock blocked"}
        />
        <Kpi
          label="Risk Flags"
          value={riskCount}
          hint="Operational settings that require review."
        />
      </section>

      <section className="sec-settings-layout">
        <aside className="sec-settings-sidebar">
          <div className="sec-settings-sidebar__title">Configuration</div>

          {visibleNavItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sec-settings-nav-card${
                current.key === item.key ? " is-active" : ""
              }`}
              onClick={() => setActive(item.key)}
            >
              <span className="sec-settings-nav-card__icon">{item.icon}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </aside>

        <main className="sec-settings-main">
          <div className="sec-card sec-settings-card">
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">{current.label}</p>
                <p className="sec-card__subtitle">{current.description}</p>
              </div>

              <SectionBadge tone={canManage ? "success" : "neutral"}>
                {canManage ? "Editable" : "Read only"}
              </SectionBadge>
            </div>

            <div className="sec-card__body">{renderSection()}</div>
          </div>

          <aside className="sec-settings-inspector">
            <div className="sec-card">
              <div className="sec-card__head">
                <div>
                  <p className="sec-card__title">Governance Review</p>
                  <p className="sec-card__subtitle">
                    Operational controls that may affect audit readiness.
                  </p>
                </div>
              </div>

              <div className="sec-card__body">
                <div className="sec-review-list">
                  <div>
                    <strong>MFA</strong>
                    <span>{form.requireMfa ? "Required" : "Optional"}</span>
                  </div>
                  <div>
                    <strong>Inventory approvals</strong>
                    <span>
                      {form.requireApprovalForAdjustments &&
                      form.requireApprovalForTransfers
                        ? "Enabled"
                        : "Review needed"}
                    </span>
                  </div>
                  <div>
                    <strong>Audit reason</strong>
                    <span>
                      {form.requireAuditReasonForSensitiveActions
                        ? "Required"
                        : "Optional"}
                    </span>
                  </div>
                  <div>
                    <strong>Maintenance</strong>
                    <span>
                      {form.globalMaintenanceMode ? "Enabled" : "Normal"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </main>
      </section>
    </div>
  );

  function renderSection() {
    switch (current.key) {
      case "company":
        return (
          <div className="sec-form-grid">
            <Field label="Company Name">
              <input
                className="sec-input"
                value={form.companyName}
                readOnly={!canManage}
                onChange={(event) => update("companyName", event.target.value)}
              />
            </Field>

            <Field label="Trade Name" hint="Optional public-facing business name.">
              <input
                className="sec-input"
                value={form.tradeName}
                readOnly={!canManage}
                placeholder="Optional"
                onChange={(event) => update("tradeName", event.target.value)}
              />
            </Field>

            <Field label="Default Currency">
              <input
                className="sec-input"
                value={form.defaultCurrency}
                readOnly={!canManage}
                onChange={(event) =>
                  update("defaultCurrency", event.target.value.toUpperCase())
                }
              />
            </Field>

            <Field label="Timezone">
              <input
                className="sec-input"
                value={form.timezone}
                readOnly={!canManage}
                onChange={(event) => update("timezone", event.target.value)}
              />
            </Field>

            <Field label="Country">
              <input
                className="sec-input"
                value={form.country}
                readOnly={!canManage}
                onChange={(event) => update("country", event.target.value)}
              />
            </Field>

            <Field label="City">
              <input
                className="sec-input"
                value={form.city}
                readOnly={!canManage}
                onChange={(event) => update("city", event.target.value)}
              />
            </Field>
          </div>
        );

      case "security":
        return (
          <>
            <div className="sec-form-grid">
              <Field label="Password Minimum Length">
                <input
                  className="sec-input"
                  type="number"
                  min={6}
                  max={32}
                  value={form.passwordMinLength}
                  readOnly={!canManage}
                  onChange={(event) =>
                    update("passwordMinLength", Number(event.target.value))
                  }
                />
              </Field>

              <Field label="Session Timeout Minutes">
                <input
                  className="sec-input"
                  type="number"
                  min={5}
                  max={720}
                  value={form.sessionTimeoutMinutes}
                  readOnly={!canManage}
                  onChange={(event) =>
                    update("sessionTimeoutMinutes", Number(event.target.value))
                  }
                />
              </Field>
            </div>

            <div className="sec-toggle-list">
              <Toggle
                label="Require MFA"
                checked={form.requireMfa}
                disabled={!canManage}
                onChange={(value) => update("requireMfa", value)}
                hint="Recommended for CompanyAdmin, finance, HR, and inventory approval roles."
              />

              <Toggle
                label="Allow CompanyAdmin User Management"
                checked={form.allowCompanyAdminUserManagement}
                disabled={!canManage}
                onChange={(value) =>
                  update("allowCompanyAdminUserManagement", value)
                }
                hint="Allows CompanyAdmin to create users, assign company roles, and activate/deactivate accounts."
              />
            </div>
          </>
        );

      case "inventory":
        return (
          <>
            <div className="sec-form-grid">
              <Field label="Default Cost Method">
                <select
                  className="sec-input"
                  value={form.defaultInventoryCostMethod}
                  disabled={!canManage}
                  onChange={(event) =>
                    update("defaultInventoryCostMethod", event.target.value)
                  }
                >
                  <option value="FIFO">FIFO</option>
                  <option value="WeightedAverage">Weighted Average</option>
                </select>
              </Field>
            </div>

            <div className="sec-toggle-list">
              <Toggle
                label="Require Adjustment Approval"
                checked={form.requireApprovalForAdjustments}
                disabled={!canManage}
                onChange={(value) =>
                  update("requireApprovalForAdjustments", value)
                }
              />

              <Toggle
                label="Require Transfer Approval"
                checked={form.requireApprovalForTransfers}
                disabled={!canManage}
                onChange={(value) => update("requireApprovalForTransfers", value)}
              />

              <Toggle
                label="Allow Negative Stock"
                checked={form.allowNegativeStock}
                disabled={!canManage}
                onChange={(value) => update("allowNegativeStock", value)}
                hint="High-risk option. Keep disabled for FIFO-controlled operations."
              />
            </div>
          </>
        );

      case "pos":
        return (
          <>
            <div className="sec-form-grid">
              <Field label="Default POS Location Policy">
                <input
                  className="sec-input"
                  value={form.defaultPosLocationPolicy}
                  readOnly={!canManage}
                  onChange={(event) =>
                    update("defaultPosLocationPolicy", event.target.value)
                  }
                />
              </Field>
            </div>

            <div className="sec-toggle-list">
              <Toggle
                label="Require Cashier Session Close"
                checked={form.requireCashierSessionClose}
                disabled={!canManage}
                onChange={(value) =>
                  update("requireCashierSessionClose", value)
                }
              />
            </div>
          </>
        );

      case "hr":
        return (
          <>
            <div className="sec-form-grid">
              <Field label="Attendance Mode">
                <select
                  className="sec-input"
                  value={form.hrAttendanceMode}
                  disabled={!canManage}
                  onChange={(event) =>
                    update("hrAttendanceMode", event.target.value)
                  }
                >
                  <option value="Telegram QR + Admin Review">
                    Telegram QR + Admin Review
                  </option>
                  <option value="Manual">Manual</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </Field>
            </div>

            <div className="sec-toggle-list">
              <Toggle
                label="Require Telegram Attendance"
                checked={form.requireTelegramAttendance}
                disabled={!canManage}
                onChange={(value) => update("requireTelegramAttendance", value)}
              />

              <Toggle
                label="Allow Manual Attendance Edit"
                checked={form.allowManualAttendanceEdit}
                disabled={!canManage}
                onChange={(value) => update("allowManualAttendanceEdit", value)}
              />
            </div>
          </>
        );

      case "integrations":
        return (
          <>
            <div className="sec-toggle-list">
              <Toggle
                label="Telegram Bot Enabled"
                checked={form.telegramBotEnabled}
                disabled={!canManage}
                onChange={(value) => update("telegramBotEnabled", value)}
              />
            </div>

            <div className="sec-form-grid">
              <Field label="Telegram Webhook URL">
                <input
                  className="sec-input"
                  value={form.telegramWebhookUrl}
                  readOnly={!canManage}
                  placeholder="https://api.example.com/api/telegram/webhook"
                  onChange={(event) =>
                    update("telegramWebhookUrl", event.target.value)
                  }
                />
              </Field>

              <Field label="SMTP Host">
                <input
                  className="sec-input"
                  value={form.smtpHost}
                  readOnly={!canManage}
                  placeholder="smtp.example.com"
                  onChange={(event) => update("smtpHost", event.target.value)}
                />
              </Field>

              <Field label="API Webhook Secret">
                <input
                  className="sec-input"
                  value={form.apiWebhookSecret}
                  readOnly={!canManage}
                  placeholder="Stored encrypted on backend"
                  onChange={(event) =>
                    update("apiWebhookSecret", event.target.value)
                  }
                />
              </Field>
            </div>
          </>
        );

      case "branding":
        return (
          <div className="sec-form-grid">
            <Field label="Logo URL">
              <input
                className="sec-input"
                value={form.logoUrl}
                readOnly={!canManage}
                placeholder="https://..."
                onChange={(event) => update("logoUrl", event.target.value)}
              />
            </Field>

            <Field label="Primary Color">
              <input
                className="sec-input"
                type="color"
                value={form.primaryColor}
                disabled={!canManage}
                onChange={(event) => update("primaryColor", event.target.value)}
              />
            </Field>

            <Field label="UI Density">
              <select
                className="sec-input"
                value={form.uiDensity}
                disabled={!canManage}
                onChange={(event) => update("uiDensity", event.target.value)}
              >
                <option value="Comfortable">Comfortable</option>
                <option value="Compact">Compact</option>
                <option value="Spacious">Spacious</option>
              </select>
            </Field>
          </div>
        );

      case "audit":
        return (
          <>
            <div className="sec-form-grid">
              <Field label="Audit Retention Days">
                <input
                  className="sec-input"
                  type="number"
                  min={30}
                  max={3650}
                  value={form.auditRetentionDays}
                  readOnly={!canManage}
                  onChange={(event) =>
                    update("auditRetentionDays", Number(event.target.value))
                  }
                />
              </Field>
            </div>

            <div className="sec-toggle-list">
              <Toggle
                label="Require Reason for Sensitive Actions"
                checked={form.requireAuditReasonForSensitiveActions}
                disabled={!canManage}
                onChange={(value) =>
                  update("requireAuditReasonForSensitiveActions", value)
                }
              />
            </div>
          </>
        );

      case "platform":
        return (
          <>
            <div className="sec-alert sec-alert--warning">
              Platform settings are available only to SystemAdmin.
            </div>

            <div className="sec-toggle-list">
              <Toggle
                label="Tenant Provisioning Enabled"
                checked={form.tenantProvisioningEnabled}
                disabled={!currentIsSystemAdmin}
                onChange={(value) =>
                  update("tenantProvisioningEnabled", value)
                }
              />

              <Toggle
                label="Global Maintenance Mode"
                checked={form.globalMaintenanceMode}
                disabled={!currentIsSystemAdmin}
                onChange={(value) => update("globalMaintenanceMode", value)}
              />
            </div>
          </>
        );
    }
  }
}