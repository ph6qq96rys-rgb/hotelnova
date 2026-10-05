import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useAppScope } from "../../../app/useAppScope";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { posTipsApi, type SaveTipSettingsRequest, type TipSettingsDto } from "../api/posTipsApi";
import { extractApiError } from "../utils/posUtils";
import { tipFromPercent } from "../utils/posTips";
import { money } from "../components/posUi";
import "../pos-service.css";

const MAX_PERCENTS = 6;

type Draft = Omit<SaveTipSettingsRequest, "suggestedPercents"> & { suggestedPercents: string[] };

const toDraft = (x: TipSettingsDto): Draft => ({
  isEnabled: x.isEnabled,
  suggestedPercents: x.suggestedPercents.length ? x.suggestedPercents.map(String) : ["5", "10", "15"],
  allowCustom: x.allowCustom,
  allowNoTip: true,
  basis: x.basis,
  distribution: "individual",
  poolingEnabled: false,
  trackCashTips: x.trackCashTips,
  enabledForDineIn: x.enabledForDineIn,
  enabledForTakeAway: x.enabledForTakeAway,
  enabledForDelivery: x.enabledForDelivery,
  enabledForRoomService: x.enabledForRoomService,
  version: x.version ?? null,
});

function Toggle({ checked, disabled, label, hint, onChange }: { checked: boolean; disabled?: boolean; label: string; hint?: string; onChange: (value: boolean) => void }) {
  return (
    <label className="rpos-check rpos-tip-toggle">
      <Checkbox checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

/**
 * Tips & gratuity configuration for dine-in settlement. A branch can override the company
 * default. There is never a preselected tip: guests always choose, including "No tip".
 */
export function PosTipSettingsPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const scope = useMemo(() => ({ companyId: companyId ?? "", branchId: branchId ?? "" }), [companyId, branchId]);
  const canEdit = useHasPermission("settings.update");
  const [current, setCurrent] = useState<TipSettingsDto | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [level, setLevel] = useState<"branch" | "company">("branch");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scope.companyId || !scope.branchId) { setLoading(false); return; }
    setLoading(true);
    try {
      const settings = await posTipsApi.settings(scope);
      setCurrent(settings);
      setDraft(toDraft(settings));
      setLevel(settings.source === "company" ? "company" : "branch");
      setError(null);
    } catch (err) {
      setError(extractApiError(err, tx("Tip settings could not be loaded.")));
    } finally {
      setLoading(false);
    }
  }, [scope, tx]);

  useEffect(() => { void load(); }, [load]);

  const percents = (draft?.suggestedPercents ?? []).map(Number);
  const percentProblem = !draft ? null
    : percents.some((x) => !(x > 0 && x <= 100)) ? "Each suggested percentage must be greater than 0 and at most 100."
    : new Set(percents).size !== percents.length ? "Suggested percentages must be different."
    : draft.isEnabled && percents.length === 0 && !draft.allowCustom ? "Offer at least one suggested percentage or allow a custom tip."
    : null;
  const dirty = !!draft && !!current && JSON.stringify(draft) !== JSON.stringify(toDraft(current));

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });

  const save = async () => {
    if (!draft || percentProblem) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      // The version only guards the row being edited; a branch override starts from the company row's values.
      const sameRow = (level === "branch" && current?.source === "branch") || (level === "company" && current?.source === "company");
      const saved = await posTipsApi.saveSettings(scope, {
        ...draft, suggestedPercents: percents, version: sameRow ? draft.version ?? null : null,
      } as SaveTipSettingsRequest, level);
      setCurrent(saved);
      setDraft(toDraft(saved));
      setNotice(tx(level === "company" ? "Company default saved." : "Branch tip settings saved."));
    } catch (err) {
      setError(extractApiError(err, tx("The change could not be saved.")));
      if ((err as { response?: { status?: number } })?.response?.status === 409) await load();
    } finally {
      setBusy(false);
    }
  };

  const sourceText = current?.source === "branch" ? "This branch uses its own tip settings."
    : current?.source === "company" ? "This branch uses the company default."
    : "Tips have not been set up yet.";
  const locked = !canEdit || busy;
  const example = 1000;

  return (
    <main className="rpos-page rpos-setup ui-page">
      <PageHeader title={tx("Tips & Gratuity")}
        subtitle={tx("Tips are offered at dine-in settlement and belong to the server of the table. They are kept apart from sales revenue.")} />
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {!canEdit ? <StateMessage tone="info">{tx("You can view tip settings. Changing them requires the settings update permission.")}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">{tx("Loading tip settings...")}</StateMessage> : null}

      {draft ? (
        <form className="rpos-setup-area rpos-tip-settings" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <p className="rpos-muted">
            {tx(sourceText)}
            {current?.updatedAtUtc ? ` ${tx("Last changed {time}.", { time: formatAppDateTime(current.updatedAtUtc) })}` : ""}
          </p>

          <Toggle checked={draft.isEnabled} disabled={locked} label={tx("Offer tips at settlement")}
            hint={tx("When off, the payment screen shows no tip options.")} onChange={(isEnabled) => set({ isEnabled })} />

          <fieldset className="rpos-tip-group" disabled={locked || !draft.isEnabled}>
            <legend>{tx("Service types")}</legend>
            <Toggle checked={draft.enabledForDineIn} label={tx("Dine In")} onChange={(v) => set({ enabledForDineIn: v })} />
            <Toggle checked={draft.enabledForTakeAway} label={tx("Take Away")} onChange={(v) => set({ enabledForTakeAway: v })} />
            <Toggle checked={draft.enabledForDelivery} label={tx("Delivery")} onChange={(v) => set({ enabledForDelivery: v })} />
            <Toggle checked={draft.enabledForRoomService} label={tx("Room Service")} onChange={(v) => set({ enabledForRoomService: v })} />
          </fieldset>

          <fieldset className="rpos-tip-group" disabled={locked || !draft.isEnabled}>
            <legend>{tx("Suggested percentages")}</legend>
            <p className="rpos-muted">{tx("Shown as buttons on the payment screen and printed on the guest check. None is ever preselected.")}</p>
            <div className="rpos-chip-row">
              {draft.suggestedPercents.map((value, index) => (
                <span key={index} className="rpos-tip-percent">
                  <Input type="number" min={0.5} max={100} step="0.5" value={value} aria-label={tx("Suggested percentage {number}", { number: index + 1 })}
                    onChange={(e) => set({ suggestedPercents: draft.suggestedPercents.map((x, i) => (i === index ? e.target.value : x)) })} />
                  <span>%</span>
                  <Button type="button" size="sm" variant="ghost" aria-label={tx("Remove")}
                    onClick={() => set({ suggestedPercents: draft.suggestedPercents.filter((_, i) => i !== index) })}>
                    <X size={14} aria-hidden="true" />
                  </Button>
                </span>
              ))}
              {draft.suggestedPercents.length < MAX_PERCENTS ? (
                <Button type="button" size="sm" variant="outline" onClick={() => set({ suggestedPercents: [...draft.suggestedPercents, ""] })}>
                  <Plus size={14} aria-hidden="true" /> {tx("Add percentage")}
                </Button>
              ) : null}
            </div>
            {percentProblem ? <p className="rpos-alert" role="alert">{tx(percentProblem)}</p> : (
              <p className="rpos-muted">
                {tx("On {amount} of the chosen basis:", { amount: money(example) })}{" "}
                {percents.map((p) => `${p}% = ${money(tipFromPercent(example, p))}`).join(" · ")}
              </p>
            )}
            <Toggle checked={draft.allowCustom} label={tx("Allow a custom tip amount")} onChange={(allowCustom) => set({ allowCustom })} />
            <Toggle checked label={tx("Always allow No tip")} hint={tx("Required: a guest can always decline to tip.")} disabled onChange={() => undefined} />
            <label className="rpos-field">
              <span>{tx("Calculate percentages on")}</span>
              <Select value={draft.basis} onChange={(e) => set({ basis: e.target.value as Draft["basis"] })}>
                <option value="afterTax">{tx("Bill including tax")}</option>
                <option value="beforeTax">{tx("Bill before tax")}</option>
              </Select>
            </label>
          </fieldset>

          <fieldset className="rpos-tip-group" disabled={locked || !draft.isEnabled}>
            <legend>{tx("Recipients and cash")}</legend>
            <label className="rpos-field">
              <span>{tx("Distribution")}</span>
              <Select value="individual" disabled>
                <option value="individual">{tx("Individual: the assigned server keeps the tip")}</option>
              </Select>
            </label>
            <p className="rpos-muted">{tx("Tip pooling and custom distribution rules are planned. Until then every tip goes to the assigned server.")}</p>
            <Toggle checked={draft.trackCashTips} label={tx("Record cash tips through the drawer")}
              hint={tx("Cash tips go into the drawer, count in expected cash, and are paid to servers later. When off, cash tips are handed over directly and not recorded.")}
              onChange={(trackCashTips) => set({ trackCashTips })} />
            <p className="rpos-muted">{tx("Card and mobile tips are always recorded.")}</p>
          </fieldset>

          {canEdit ? (
            <div className="rpos-tip-save">
              <label className="rpos-field">
                <span>{tx("Save for")}</span>
                <Select value={level} disabled={busy} onChange={(e) => setLevel(e.target.value as "branch" | "company")}>
                  <option value="branch">{tx("This branch only")}</option>
                  <option value="company">{tx("Company default (branches without their own settings)")}</option>
                </Select>
              </label>
              <Button type="submit" disabled={busy || !!percentProblem || (!dirty && current?.source === level)}>
                {busy ? tx("Saving...") : tx("Save tip settings")}
              </Button>
            </div>
          ) : null}
        </form>
      ) : null}
    </main>
  );
}
