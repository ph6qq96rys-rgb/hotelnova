// src/modules/company/pages/CompanySettingsPage.tsx
// CompanyAdmin: configure company-wide operational defaults.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import { companyApi } from "../api/companyApi";
import type { CompanySettingsDto } from "../types/company.types";
import {
  PageShell, Card, Btn, Alert, Field, Input, Toggle, Spinner, InfoRow,
} from "./components/company.ui";
import { extractApiError } from "../utils/company.utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DEFAULT_SETTINGS: CompanySettingsDto = {
  vatEnabled: true,
  vatRate: 15,
  serviceChargeRate: 10,
  contingencyRate: 10,
  pricesIncludeVat: false,
  invoicePrefix: "INV",
  receiptPrefix: "RCPT",
  grnPrefix: "GRN",
  sivPrefix: "SIV",
  transferPrefix: "TRF",
  adjustmentPrefix: "ADJ",
  productionPrefix: "PRD",
  allowNegativeStock: false,
  requireApprovalForSiv: true,
  autoPostGrn: false,
  autoPostSiv: false,
  enforceIssueLocationMapping: true,
  costingMethod: "FIFO",
  fiscalYearStartMonth: 1,
  baseCurrency: "ETB",
  defaultLanguage: "en",
  attendanceEnabled: true,
  overtimeEnabled: false,
  telegramEnabled: false,
  telegramAttendanceEnabled: false,
  telegramStockRequestsEnabled: false,
  auditInventoryTransactions: true,
  auditFinancialTransactions: true,
};

export default function CompanySettingsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { hasPermission, user } = useAuth() as any;
  const canUpdateSettings = Boolean(hasPermission?.("settings.update") || hasAnyRole(user, ["CompanyAdmin", "SystemAdmin", "SysAdmin"]));

  const [value, setValue] = useState<CompanySettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    setError(null);
    companyApi.getSettings(companyId)
      .then((settings) => setValue({ ...DEFAULT_SETTINGS, ...settings }))
      .catch((e) => setError(extractApiError(e, "Company settings could not be loaded.")))
      .finally(() => setLoading(false));
  }, [companyId]);

  async function save() {
    if (!companyId || !value) return;
    if (!canUpdateSettings) {
      setError("You can view company settings, but you do not have permission to update them.");
      return;
    }

    if ([value.vatRate, value.serviceChargeRate ?? 0, value.contingencyRate ?? 0]
      .some(rate => !Number.isFinite(rate) || rate < 0 || rate > 100 || Math.abs(rate * 10000 - Math.round(rate * 10000)) > 0.000001)) {
      setError("Rates must be between 0 and 100 with at most four decimal places.");
      return;
    }
    const normalized = normalize(value);
    if (requiresOperationalConfirmation(normalized) && !window.confirm("These settings can affect stock posting, audit controls, or financial behavior across the company. Continue saving?")) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await companyApi.updateSettings(companyId, normalized);
      setValue({ ...DEFAULT_SETTINGS, ...saved });
      setNotice("Company settings saved and applied to related modules.");
    } catch (e) {
      setError(extractApiError(e, "Company settings could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof CompanySettingsDto>(k: K, v: CompanySettingsDto[K]) =>
    setValue((s) => s ? { ...s, [k]: v } : s);

  if (!companyId) return <div style={{ padding: 24 }}>Missing company ID.</div>;
  if (loading) return <LoadingState />;
  if (!value) return <div style={{ padding: 24 }}>{error ? <Alert tone="danger" title="Error" message={error} /> : "No settings found."}</div>;

  return (
    <PageShell
      title="Company settings"
      subtitle="Company-wide defaults used by tax, documents, inventory, HR, Telegram, and audit modules."
      action={<Btn variant="primary" onClick={save} disabled={saving || !canUpdateSettings}>{saving ? "Saving..." : canUpdateSettings ? "Save settings" : "View only"}</Btn>}
    >
      {notice && <Alert tone="ok" title="Saved" message={notice} />}
      {error && <Alert tone="danger" title="Action required" message={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card title="Tax" subtitle="VAT behavior for sales, receipts, and invoices.">
          <ToggleRow title="VAT enabled" subtitle="Apply VAT rules to taxable sales documents." checked={value.vatEnabled} onChange={(v) => set("vatEnabled", v)} />
          <Field label="VAT rate (%)">
            <Input value={String(value.vatRate ?? 0)} onChange={(v) => set("vatRate", Number(v) || 0)} type="number" />
          </Field>
          <ToggleRow title="Prices include VAT" subtitle="Treat displayed sale prices as VAT-inclusive." checked={value.pricesIncludeVat} onChange={(v) => set("pricesIncludeVat", v)} />
          <Field label="Service charge (%)">
            <Input type="number" value={String(value.serviceChargeRate ?? 0)} onChange={v => set("serviceChargeRate", Number(v))} />
          </Field>
          <Field label="Recipe contingency (%)">
            <Input type="number" value={String(value.contingencyRate ?? 0)} onChange={v => set("contingencyRate", Number(v))} />
          </Field>
          <InfoRow label="Service charge VAT" value="Not taxable" />
          <InfoRow label="Contingency" value="Recipe-cost allowance only" />
          <Btn disabled={!canUpdateSettings || saving} onClick={() => setValue(previous => previous ? ({ ...previous,
            vatEnabled: true, vatRate: 15, pricesIncludeVat: false, serviceChargeRate: 10, contingencyRate: 10,
          }) : previous)}>Set 15% VAT / 10% service / 10% contingency</Btn>
        </Card>

        <Card title="Fiscal defaults" subtitle="Financial year and base reporting currency.">
          <Field label="Base currency">
            <Input value={value.baseCurrency ?? "ETB"} onChange={(v) => set("baseCurrency", v.toUpperCase())} placeholder="ETB" />
          </Field>
          <Field label="Default language">
            <select className="ob-select" value={value.defaultLanguage ?? "en"} onChange={(e) => set("defaultLanguage", normalizeLanguage(e.target.value))}>
              <option value="en">English</option>
              <option value="am">አማርኛ</option>
            </select>
          </Field>
          <Field label="Fiscal year start month">
            <select className="ob-select" value={String(value.fiscalYearStartMonth ?? 1)} onChange={(e) => set("fiscalYearStartMonth", Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <InfoRow label="Current period starts" value={MONTHS[(value.fiscalYearStartMonth ?? 1) - 1]} />
        </Card>

        <Card title="Document numbering" subtitle="Prefixes used when operational documents are generated.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <PrefixField label="Invoice" value={value.invoicePrefix} onChange={(v) => set("invoicePrefix", v)} />
            <PrefixField label="Receipt" value={value.receiptPrefix} onChange={(v) => set("receiptPrefix", v)} />
            <PrefixField label="GRN" value={value.grnPrefix} onChange={(v) => set("grnPrefix", v)} />
            <PrefixField label="SIV" value={value.sivPrefix} onChange={(v) => set("sivPrefix", v)} />
            <PrefixField label="Transfer" value={value.transferPrefix} onChange={(v) => set("transferPrefix", v)} />
            <PrefixField label="Adjustment" value={value.adjustmentPrefix} onChange={(v) => set("adjustmentPrefix", v)} />
            <PrefixField label="Production" value={value.productionPrefix} onChange={(v) => set("productionPrefix", v)} />
          </div>
        </Card>

        <Card title="Inventory workflow" subtitle="Controls applied to stock movement and posting modules.">
          <Field label="Costing method">
            <select className="ob-select" value={value.costingMethod ?? "FIFO"} onChange={(e) => set("costingMethod", e.target.value)}>
              <option value="FIFO">FIFO</option>
              <option value="WeightedAverage">Weighted average</option>
            </select>
          </Field>
          <ToggleRow title="Allow negative stock" subtitle="Also updates company-level Inventory Control Settings." checked={value.allowNegativeStock} onChange={(v) => set("allowNegativeStock", v)} />
          <ToggleRow title="Require SIV approval" subtitle="SIVs must be approved before issue/posting when enabled." checked={value.requireApprovalForSiv} onChange={(v) => set("requireApprovalForSiv", v)} />
          <ToggleRow title="Auto-post GRN" subtitle="New GRN documents may be posted without a separate posting step when supported." checked={value.autoPostGrn} onChange={(v) => set("autoPostGrn", v)} />
          <ToggleRow title="Auto-post SIV" subtitle="Approved SIV documents may be posted without a separate posting step when supported." checked={value.autoPostSiv} onChange={(v) => set("autoPostSiv", v)} />
          <ToggleRow title="Enforce issue location mapping" subtitle="SIV, POS, and production consumption must use assigned issue locations." checked={value.enforceIssueLocationMapping} onChange={(v) => set("enforceIssueLocationMapping", v)} />
        </Card>

        <Card title="HR and attendance" subtitle="Attendance availability and payroll-related time policy.">
          <ToggleRow title="Attendance enabled" subtitle="Attendance screens and QR attendance can be used by HR." checked={value.attendanceEnabled} onChange={(v) => set("attendanceEnabled", v)} />
          <ToggleRow title="Overtime enabled" subtitle="Payroll can include overtime once payroll rules are configured." checked={value.overtimeEnabled} onChange={(v) => set("overtimeEnabled", v)} />
        </Card>

        <Card title="Telegram" subtitle="Telegram Mini App capabilities for employees and operations.">
          <ToggleRow title="Telegram enabled" subtitle="Allows tenant Telegram features to be activated." checked={value.telegramEnabled} onChange={(v) => set("telegramEnabled", v)} />
          <ToggleRow title="Telegram attendance" subtitle="Employees can check in through Telegram QR flows." checked={value.telegramAttendanceEnabled} onChange={(v) => set("telegramAttendanceEnabled", v)} />
          <ToggleRow title="Telegram stock requests" subtitle="Telegram Mini App can create inventory requests." checked={value.telegramStockRequestsEnabled} onChange={(v) => set("telegramStockRequestsEnabled", v)} />
        </Card>

        <Card title="Audit" subtitle="Governance switches for operational and financial records.">
          <ToggleRow title="Audit inventory transactions" subtitle="Record inventory movement audit metadata." checked={value.auditInventoryTransactions} onChange={(v) => set("auditInventoryTransactions", v)} />
          <ToggleRow title="Audit financial transactions" subtitle="Record financial posting audit metadata." checked={value.auditFinancialTransactions} onChange={(v) => set("auditFinancialTransactions", v)} />
        </Card>
      </div>
    </PageShell>
  );
}

function LoadingState() {
  return <div style={{ padding: 24, display: "flex", gap: 10, alignItems: "center" }}><Spinner /> Loading settings...</div>;
}

function ToggleRow({ title, subtitle, checked, onChange }: { title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "10px 0" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{subtitle}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function PrefixField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <Input value={value ?? ""} onChange={(v) => onChange(v.toUpperCase())} />
    </Field>
  );
}

function hasAnyRole(user: any, allowedRoles: string[]) {
  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.roleNames) ? user.roleNames : []),
    user?.role,
  ]
    .filter(Boolean)
    .map((role: string) => role.toLowerCase());

  return allowedRoles.some((role) => roles.includes(role.toLowerCase()));
}

function requiresOperationalConfirmation(value: CompanySettingsDto) {
  return Boolean(
    value.allowNegativeStock ||
    value.autoPostGrn ||
    value.autoPostSiv ||
    !value.auditInventoryTransactions ||
    !value.auditFinancialTransactions
  );
}
function normalize(value: CompanySettingsDto): CompanySettingsDto {
  const prefix = (v: string | undefined, fallback: string) => (v || fallback).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20) || fallback;

  return {
    ...DEFAULT_SETTINGS,
    ...value,
    vatRate: Math.min(100, Math.max(0, Number(value.vatRate) || 0)),
    fiscalYearStartMonth: value.fiscalYearStartMonth >= 1 && value.fiscalYearStartMonth <= 12 ? value.fiscalYearStartMonth : 1,
    baseCurrency: (value.baseCurrency || "ETB").trim().toUpperCase().slice(0, 10) || "ETB",
    defaultLanguage: normalizeLanguage(value.defaultLanguage),
    costingMethod: value.costingMethod === "WeightedAverage" ? "WeightedAverage" : "FIFO",
    invoicePrefix: prefix(value.invoicePrefix, "INV"),
    receiptPrefix: prefix(value.receiptPrefix, "RCPT"),
    grnPrefix: prefix(value.grnPrefix, "GRN"),
    sivPrefix: prefix(value.sivPrefix, "SIV"),
    transferPrefix: prefix(value.transferPrefix, "TRF"),
    adjustmentPrefix: prefix(value.adjustmentPrefix, "ADJ"),
    productionPrefix: prefix(value.productionPrefix, "PRD"),
  };
}
function normalizeLanguage(language: string | undefined): "en" | "am" {
  const normalized = (language || "en").trim().toLowerCase();
  return normalized === "am" || normalized === "am-et" ? "am" : "en";
}
