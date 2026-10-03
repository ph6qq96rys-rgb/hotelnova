import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { purchasingSetupApi, type PurchasingSettings } from "../api/purchasingApi";
import { apiError, dateTime, useCompanyId } from "../components/p2pShared";

type NumericKey =
  | "poFinanceApprovalThreshold"
  | "requisitionFinanceApprovalThreshold"
  | "receiptOverTolerancePercent"
  | "invoiceQtyTolerancePercent"
  | "invoicePriceTolerancePercent"
  | "defaultVatRatePercent"
  | "withholdingRatePercent"
  | "withholdingGoodsThreshold";

export default function PurchasingSettingsPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const canManage = useHasPermission("purchasing.manage");
  const [settings, setSettings] = useState<PurchasingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    purchasingSetupApi.getSettings(companyId).then(setSettings).catch((e) => setError(apiError(e, "Unable to load purchasing settings.")));
  }, [companyId]);

  const set = <K extends keyof PurchasingSettings>(key: K, value: PurchasingSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  function numberField(key: NumericKey, label: string, help?: string, step = "0.01", disabled = false) {
    return (
      <FormField
        label={tx(label)}
        help={help ? tx(help) : undefined}
        type="number"
        min={0}
        step={step}
        disabled={disabled}
        value={settings?.[key] ?? 0}
        onChange={(e) => set(key, Number(e.target.value || 0))}
      />
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { companyId: _c, isDefault: _d, updatedAtUtc: _u, ...body } = settings;
      setSettings(await purchasingSetupApi.updateSettings(companyId, body));
      setNotice(tx("Purchasing settings saved."));
    } catch (err) {
      setError(apiError(err, "Unable to save purchasing settings."));
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <main className="p2p-page">{error ? <StateMessage tone="error">{tx(error)}</StateMessage> : <StateMessage tone="loading">{tx("Loading purchasing settings...")}</StateMessage>}</main>;

  return (
    <main className="p2p-page">
      <PageHeader
        title={tx("Purchasing Settings")}
        subtitle={settings.isDefault ? tx("Defaults are in effect. Save to set company-specific values.") : `${tx("Last updated")}: ${dateTime(settings.updatedAtUtc)}`}
      />
      {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
      {notice && <StateMessage tone="success">{notice}</StateMessage>}
      {!canManage && <StateMessage tone="info">{tx("You can view these settings. Changing them requires the purchasing manage permission.")}</StateMessage>}

      <form onSubmit={save}>
        <fieldset disabled={!canManage || saving} className="p2p-fieldset p2p-grid">
          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("Approvals")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              {numberField("poFinanceApprovalThreshold", `${tx("PO finance approval above")} (${settings.defaultCurrencyCode})`, "Purchase orders above this total also need finance approval.")}
              {numberField("requisitionFinanceApprovalThreshold", `${tx("Requisition finance approval above")} (${settings.defaultCurrencyCode})`, "0 = every requisition needs finance approval.")}
              <label className="p2p-check"><Checkbox checked={settings.requireRequisitionForPo} onChange={(e) => set("requireRequisitionForPo", e.target.checked)} />{tx("Purchase orders must come from an approved requisition")}</label>
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("Tolerances")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              {numberField("receiptOverTolerancePercent", "Over-receipt tolerance %", "How much more than ordered a goods receipt may accept.")}
              {numberField("invoiceQtyTolerancePercent", "Invoice quantity tolerance %")}
              {numberField("invoicePriceTolerancePercent", "Invoice price tolerance %", "Invoices priced further from the PO go on hold.")}
            </CardContent>
          </Card>

          <Card className="p2p-span-all">
            <CardHeader><CardTitle>{tx("Tax")}</CardTitle></CardHeader>
            <CardContent className="p2p-grid">
              {numberField("defaultVatRatePercent", "Default VAT %")}
              <FormField label={tx("Default currency")} maxLength={3} value={settings.defaultCurrencyCode} onChange={(e) => set("defaultCurrencyCode", e.target.value.toUpperCase())} />
              <label className="p2p-check"><Checkbox checked={settings.withholdingEnabled} onChange={(e) => set("withholdingEnabled", e.target.checked)} />{tx("Apply withholding tax on supplier invoices")}</label>
              {numberField("withholdingRatePercent", "Withholding rate %", undefined, "0.01", !settings.withholdingEnabled)}
              {numberField("withholdingGoodsThreshold", "Withholding applies above", "Invoice amount before VAT.", "0.01", !settings.withholdingEnabled)}
              <div className="p2p-span-all">
                <StateMessage tone="warning">{tx("Confirm the withholding rate and threshold with your tax advisor before enabling withholding.")}</StateMessage>
              </div>
            </CardContent>
          </Card>
        </fieldset>
        {canManage && (
          <div className="p2p-actions p2p-mt">
            <Button type="submit" disabled={saving}>{saving ? tx("Saving...") : tx("Save settings")}</Button>
          </div>
        )}
      </form>
    </main>
  );
}
