import { useEffect, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { useI18n } from "../../../../i18n";
import {
  inventoryControlSettingsApi,
  type InventoryControlSettingsDto,
  type UpsertInventoryControlSettingsRequest,
} from "../api/inventoryControlSettingsApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import type { StockLocationDto } from "../../stock-locations/types";
import "./inventory-control-settings.css";

function getError(e: unknown) {
  const err = e as any;
  return (
    err?.response?.data?.message ??
    err?.response?.data?.title ??
    err?.message ??
    "Request failed."
  );
}

const defaults: UpsertInventoryControlSettingsRequest = {
  branchId: null,
  locationId: null,
  warningVariancePercent: 5,
  highVariancePercent: 10,
  criticalVariancePercent: 25,
  approvalThresholdPercent: 25,
  requireApprovalForHighVariance: true,
  blockPostingOnCriticalVariance: false,
  lockInventoryDuringCount: true,
  requireReasonOnVariance: true,
  allowNegativeInventory: false,
};

export default function InventoryControlSettingsPage() {
  const { tx } = useI18n();
  const { companyId, branchId, branchName } = useAppScope();
  const selectedBranchId = branchId ?? "";

  const [form, setForm] =
    useState<UpsertInventoryControlSettingsRequest>(defaults);
  const [current, setCurrent] = useState<InventoryControlSettingsDto | null>(
    null
  );
  const [scope, setScope] = useState<"company" | "branch" | "location">("branch");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    const effectiveBranchId =
      scope === "branch" || scope === "location" ? selectedBranchId || null : null;
    const effectiveLocationId =
      scope === "location" ? selectedLocationId || null : null;

    setLoading(true);
    setErr(null);

    inventoryControlSettingsApi
      .getEffective(companyId, {
        branchId: effectiveBranchId,
        locationId: effectiveLocationId,
      })
      .then((dto) => {
        setCurrent(dto);
        setForm({
          branchId: effectiveBranchId,
          locationId: effectiveLocationId,
          warningVariancePercent: dto.warningVariancePercent,
          highVariancePercent: dto.highVariancePercent,
          criticalVariancePercent: dto.criticalVariancePercent,
          approvalThresholdPercent: dto.approvalThresholdPercent,
          requireApprovalForHighVariance: dto.requireApprovalForHighVariance,
          blockPostingOnCriticalVariance: dto.blockPostingOnCriticalVariance,
          lockInventoryDuringCount: dto.lockInventoryDuringCount,
          requireReasonOnVariance: dto.requireReasonOnVariance,
          allowNegativeInventory: dto.allowNegativeInventory,
        });
      })
      .catch((e) => setErr(getError(e)))
      .finally(() => setLoading(false));
  }, [companyId, selectedBranchId, scope, selectedLocationId]);

  useEffect(() => {
    if (!companyId || !selectedBranchId) {
      setLocations([]);
      setSelectedLocationId("");
      return;
    }

    const controller = new AbortController();

    stockLocationsApi
      .list(companyId, selectedBranchId, undefined, controller.signal)
      .then((rows) => {
        const activeRows = rows.filter((x) => x.isActive !== false);
        setLocations(activeRows);

        if (
          selectedLocationId &&
          !activeRows.some((x) => x.id === selectedLocationId)
        ) {
          setSelectedLocationId("");
        }
      })
      .catch(() => setLocations([]));

    return () => controller.abort();
  }, [companyId, selectedBranchId, selectedLocationId]);

  function patch(p: Partial<UpsertInventoryControlSettingsRequest>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function validate(): string | null {
    if (form.warningVariancePercent < 0) return "Warning threshold cannot be negative.";
    if (form.highVariancePercent < 0) return "High threshold cannot be negative.";
    if (form.criticalVariancePercent < 0) return "Critical threshold cannot be negative.";
    if (form.approvalThresholdPercent < 0) return "Approval threshold cannot be negative.";

    if (form.warningVariancePercent > form.highVariancePercent) {
      return "Warning threshold cannot exceed high threshold.";
    }

    if (form.highVariancePercent > form.criticalVariancePercent) {
      return "High threshold cannot exceed critical threshold.";
    }

    if ((scope === "branch" || scope === "location") && !selectedBranchId) {
      return "Select a branch in the sidebar before saving a branch or location policy.";
    }

    if (scope === "location" && !selectedLocationId) {
      return "Select a stock location before saving a location policy.";
    }

    return null;
  }

  async function save() {
    if (!companyId) return;

    const validation = validate();
    if (validation) {
      setErr(validation);
      return;
    }

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const body: UpsertInventoryControlSettingsRequest = {
        ...form,
        branchId:
          scope === "branch" || scope === "location" ? selectedBranchId || null : null,
        locationId: scope === "location" ? selectedLocationId || null : null,
      };

      const dto = await inventoryControlSettingsApi.upsert(companyId, body);
      setCurrent(dto);
      setOk("Inventory control settings saved.");
    } catch (e) {
      setErr(getError(e));
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) {
    return <div className="ics-guard">{tx("Select a company first.")}</div>;
  }

  return (
    <div className="ics-page">
      <div className="ics-header">
        <div>
          <p className="ics-kicker">{tx("Inventory Administration")}</p>
          <h1 className="ics-title">{tx("Inventory Control Settings")}</h1>
          <p className="ics-subtitle">
            {tx("Configure stock count variance thresholds, approval rules, posting controls, and negative inventory policy.")}
          </p>
        </div>

        <button
          className="ics-btn ics-btn-primary"
          onClick={save}
          disabled={saving || loading}
        >
          {saving ? tx("Saving...") : tx("Save Settings")}
        </button>
      </div>

      {err && <div className="ics-alert ics-alert-error">{tx(err)}</div>}
      {ok && <div className="ics-alert ics-alert-success">{tx(ok)}</div>}

      <div className="ics-card">
        <div className="ics-card-head">
          <div>
            <h2>{tx("Settings Scope")}</h2>
            <p>{tx("Choose whether these settings apply company-wide, to a branch, or to one stock location.")}</p>
          </div>
        </div>

        <div className="ics-segment">
          <button
            className={scope === "company" ? "active" : ""}
            onClick={() => setScope("company")}
          >
            {tx("Company Default")}
          </button>

          <button
            className={scope === "branch" ? "active" : ""}
            onClick={() => setScope("branch")}
            disabled={!selectedBranchId}
          >
            Branch
          </button>

          <button
            className={scope === "location" ? "active" : ""}
            onClick={() => setScope("location")}
            disabled={!selectedBranchId}
          >
            {tx("Stock Location")}
          </button>
        </div>

        {(scope === "branch" || scope === "location") && (
          <label className="ics-field ics-location-field">
            <span>{tx("Branch")}</span>
            <input
              value={branchName || (selectedBranchId ? tx("Active sidebar branch") : tx("No branch selected"))}
              disabled
            />
          </label>
        )}

        {scope === "location" && (
          <label className="ics-field ics-location-field">
            <span>{tx("Stock Location")}</span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              <option value="">{tx("Select stock location...")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code
                    ? `${location.code} - ${location.name}`
                    : location.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="ics-scope-note">
          {tx("Current effective policy:")} {" "}
          <strong>
            {current?.locationId
              ? tx("Stock location override")
              : current?.branchId
                ? tx("Active branch override")
                : current
                  ? tx("Company default")
                  : tx("System default")}
          </strong>
        </div>
      </div>

      <div className="ics-grid">
        <div className="ics-card">
          <div className="ics-card-head">
            <div>
              <h2>{tx("Variance Thresholds")}</h2>
              <p>{tx("Used by stock count and inventory adjustment anomaly detection.")}</p>
            </div>
          </div>

          <NumberField
            label={tx("Warning Variance %")}
            value={form.warningVariancePercent}
            onChange={(v) => patch({ warningVariancePercent: v })}
          />

          <NumberField
            label={tx("High Variance %")}
            value={form.highVariancePercent}
            onChange={(v) => patch({ highVariancePercent: v })}
          />

          <NumberField
            label={tx("Critical Variance %")}
            value={form.criticalVariancePercent}
            onChange={(v) => patch({ criticalVariancePercent: v })}
          />

          <NumberField
            label={tx("Approval Threshold %")}
            value={form.approvalThresholdPercent}
            onChange={(v) => patch({ approvalThresholdPercent: v })}
          />
        </div>

        <div className="ics-card">
          <div className="ics-card-head">
            <div>
              <h2>{tx("Approval & Posting Rules")}</h2>
              <p>{tx("Controls workflow escalation and posting safety.")}</p>
            </div>
          </div>

          <Toggle
            label={tx("Require approval for high variance")}
            checked={form.requireApprovalForHighVariance}
            onChange={(v) => patch({ requireApprovalForHighVariance: v })}
          />

          <Toggle
            label={tx("Block posting on critical variance")}
            checked={form.blockPostingOnCriticalVariance}
            onChange={(v) => patch({ blockPostingOnCriticalVariance: v })}
          />

          <Toggle
            label={tx("Require reason on variance")}
            checked={form.requireReasonOnVariance}
            onChange={(v) => patch({ requireReasonOnVariance: v })}
          />
        </div>

        <div className="ics-card">
          <div className="ics-card-head">
            <div>
              <h2>{tx("Stock Count Controls")}</h2>
              <p>{tx("Controls count discipline during physical inventory.")}</p>
            </div>
          </div>

          <Toggle
            label={tx("Lock inventory during count")}
            checked={form.lockInventoryDuringCount}
            onChange={(v) => patch({ lockInventoryDuringCount: v })}
          />
        </div>

        <div className="ics-card">
          <div className="ics-card-head">
            <div>
              <h2>{tx("Costing Controls")}</h2>
              <p>{tx("Controls whether stock can go below zero.")}</p>
            </div>
          </div>

          <Toggle
            label={tx("Allow negative inventory")}
            checked={form.allowNegativeInventory}
            onChange={(v) => patch({ allowNegativeInventory: v })}
          />
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="ics-field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="ics-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
