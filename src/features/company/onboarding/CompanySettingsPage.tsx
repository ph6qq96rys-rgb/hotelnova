// src/modules/company/pages/CompanySettingsPage.tsx
// CompanyAdmin: configure company-wide operational defaults.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { companyApi } from "../api/companyApi";
import type { CompanySettingsDto } from "../types/company.types";
import {
  PageShell, Card, Btn, Alert, Field, Input, Toggle, Spinner, InfoRow,
} from "./components/company.ui";
import { extractApiError } from "../utils/company.utils";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function CompanySettingsPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [value,   setValue]   = useState<CompanySettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [notice,  setNotice]  = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true); setError(null);
    companyApi.getSettings(companyId)
      .then(setValue)
      .catch((e) => setError(extractApiError(e, "Failed to load settings")))
      .finally(() => setLoading(false));
  }, [companyId]);

  async function save() {
    if (!companyId || !value) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const saved = await companyApi.updateSettings(companyId, value);
      setValue(saved); setNotice("Settings saved successfully.");
    } catch (e) {
      setError(extractApiError(e, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof CompanySettingsDto>(k: K, v: CompanySettingsDto[K]) =>
    setValue((s) => s ? { ...s, [k]: v } : s);

  if (!companyId) return <div style={{ padding: 24 }}>Missing company ID.</div>;
  if (loading)    return <div style={{ padding: 24, display: "flex", gap: 10, alignItems: "center" }}><Spinner /> Loading settings…</div>;
  if (!value)     return <div style={{ padding: 24 }}>{error ? <Alert tone="danger" title="Error" message={error} /> : "No settings found."}</div>;

  return (
    <PageShell
      title="Company settings"
      subtitle="Applies to all branches and stores under this company."
      action={<Btn variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Btn>}
    >
      {notice && <Alert tone="ok"     title="Saved"  message={notice} />}
      {error  && <Alert tone="danger" title="Error"  message={error}  />}

      {/* VAT */}
      <Card title="Tax & VAT" subtitle="Value added tax configuration" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>VAT enabled</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Apply VAT to sales and invoices</div>
            </div>
            <Toggle checked={value.vatEnabled} onChange={(v) => set("vatEnabled", v)} />
          </div>

          {value.vatEnabled && (
            <>
              <Field label="VAT rate (%)" hint="Enter as a percentage, e.g. 15 for 15%">
                <Input
                  value={String(value.vatRate)}
                  onChange={(v) => set("vatRate", parseFloat(v) || 0)}
                  placeholder="e.g. 15"
                  type="number"
                />
              </Field>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Prices include VAT</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Displayed prices are VAT-inclusive</div>
                </div>
                <Toggle checked={value.pricesIncludeVat} onChange={(v) => set("pricesIncludeVat", v)} />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Documents */}
      <Card title="Document numbering" subtitle="Prefix used for generated invoice and receipt numbers" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <Field label="Invoice prefix" hint="e.g. INV-2024-">
            <Input value={value.invoicePrefix} onChange={(v) => set("invoicePrefix", v)} placeholder="INV" />
          </Field>
          <Field label="Receipt prefix" hint="e.g. RCPT-">
            <Input value={value.receiptPrefix} onChange={(v) => set("receiptPrefix", v)} placeholder="RCPT" />
          </Field>
        </div>
      </Card>

      {/* Inventory */}
      <Card title="Inventory" subtitle="Stock management rules" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Allow negative stock</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Permit stock levels to go below zero</div>
          </div>
          <Toggle checked={value.allowNegativeStock} onChange={(v) => set("allowNegativeStock", v)} />
        </div>
      </Card>

      {/* Fiscal year */}
      <Card title="Fiscal year" subtitle="Defines the start of the financial reporting period">
        <Field label="Fiscal year start month">
          <select
            value={String(value.fiscalYearStartMonth)}
            onChange={(e) => set("fiscalYearStartMonth", Number(e.target.value))}
            style={{
              width: "100%", boxSizing: "border-box", fontFamily: "var(--font-sans)",
              padding: "8px 12px", borderRadius: "var(--border-radius-md)", fontSize: 13,
              border: "1px solid var(--color-border-tertiary)",
              background: "var(--color-background-primary)", color: "var(--color-text-primary)", outline: "none",
            }}
          >
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </Field>
        <div style={{ marginTop: 12 }}>
          <InfoRow label="Current selection" value={MONTHS[(value.fiscalYearStartMonth ?? 1) - 1]} />
        </div>
      </Card>
    </PageShell>
  );
}