import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { useI18n } from "../../../i18n";
import { requestCopilotApi, type CopilotSettings } from "../api/requestCopilotApi";
import { apiError } from "./p2pShared";

type NumberKey = "consumptionLookbackDays" | "defaultCoverageDays" | "duplicateWindowDays" | "priceLookbackDays" | "priceIncreaseThresholdPercent" | "returnBelowPercent" | "analysisMaxAgeHours";
const fields: { key: NumberKey; label: string; hint: string }[] = [
  { key: "consumptionLookbackDays", label: "Consumption period (days)", hint: "Posted usage used for the average daily consumption." },
  { key: "defaultCoverageDays", label: "Default coverage (days)", hint: "Coverage after the required date when no replenishment rule sets one. Safety stock comes from replenishment rules." },
  { key: "duplicateWindowDays", label: "Duplicate window (± days)", hint: "Open requests for the same item and destination this close are flagged." },
  { key: "priceLookbackDays", label: "Price history (days)", hint: "Used when no Price rule applies." },
  { key: "priceIncreaseThresholdPercent", label: "Price increase threshold (%)", hint: "Used when no Price rule applies." },
  { key: "returnBelowPercent", label: "Suggest return when suggested ≤ (% of request)", hint: "Below this share the copilot suggests returning the request for revision." },
  { key: "analysisMaxAgeHours", label: "Analysis valid for (hours)", hint: "Older analyses must be refreshed before approval." },
];

/** Company settings for the purchase request approval copilot (PR-FNB-001). Exception actions are set with Request evaluation rules. */
export default function CopilotSettingsPanel({ companyId }: { companyId: string }) {
  const { tx } = useI18n();
  const [settings, setSettings] = useState<CopilotSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (companyId) void requestCopilotApi.settings(companyId).then(setSettings).catch(e => setError(apiError(e, "Unable to load copilot settings.")));
  }, [companyId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings || busy) return;
    setBusy(true); setError(""); setNotice("");
    try { setSettings(await requestCopilotApi.saveSettings(companyId, settings)); setNotice("Copilot settings saved. Existing analyses become outdated and must be refreshed."); }
    catch (err) { setError(apiError(err, "Unable to save copilot settings.")); }
    finally { setBusy(false); }
  }

  if (!settings) return error ? <StateMessage tone="error">{tx(error)}</StateMessage> : null;
  const set = <K extends keyof CopilotSettings>(key: K, value: CopilotSettings[K]) => setSettings(s => s ? { ...s, [key]: value } : s);
  return <section className="prq-panel">
    <h2>{tx("Purchase request approval copilot")}</h2>
    <p className="p2p-muted">{tx("Choose whether each exception is informational, requires justification or blocks approval with Request evaluation rules above (Warn, Review, Block).")}</p>
    <form className="prq-form-grid" onSubmit={e => void save(e)}>
      {fields.map(f => <label key={f.key}>{tx(f.label)}
        <Input type="number" min={0} value={settings[f.key]} onChange={e => set(f.key, Number(e.target.value))} />
        <span className="p2p-muted">{tx(f.hint)}</span>
      </label>)}
      <label><Checkbox checked={settings.requireReviewAtApproval} onChange={e => set("requireReviewAtApproval", e.target.checked)} /> {tx("Require a current, reviewed analysis for F&B approval")}</label>
      <label><Checkbox checked={settings.assistantEnabled} onChange={e => set("assistantEnabled", e.target.checked)} /> {tx("Enable the question assistant")}
        <span className="p2p-muted">{tx("Questions and the request's analysis evidence are sent to the configured AI model provider. The server also needs a provider key.")}</span></label>
      <div className="prq-actions"><Button type="submit" disabled={busy}>{tx(busy ? "Saving..." : "Save copilot settings")}</Button></div>
    </form>
    {notice && <StateMessage tone="success">{tx(notice)}</StateMessage>}
    {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
  </section>;
}
