import { useEffect, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
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
  const { companyId, branchId } = useAppScope();

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
      scope === "branch" || scope === "location" ? branchId : null;
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
  }, [companyId, branchId, scope, selectedLocationId]);

  useEffect(() => {
    if (!companyId || !branchId) {
      setLocations([]);
      setSelectedLocationId("");
      return;
    }

    const controller = new AbortController();

    stockLocationsApi
      .list(companyId, branchId, undefined, controller.signal)
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
  }, [companyId, branchId, selectedLocationId]);

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
          scope === "branch" || scope === "location" ? branchId ?? null : null,
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
    return <div className="ics-guard">Select a company first.</div>;
  }

  return (
    <div className="ics-page">
      <div className="ics-header">
        <div>
          <p className="ics-kicker">Inventory Administration</p>
          <h1 className="ics-title">Inventory Control Settings</h1>
          <p className="ics-subtitle">
            Configure stock count variance thresholds, approval rules, posting
            controls, and negative inventory policy.
          </p>
        </div>

        <button
          className="ics-btn ics-btn-primary"
          onClick={save}
          disabled={saving || loading}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {err && <div className="ics-alert ics-alert-error">{err}</div>}
      {ok && <div className="ics-alert ics-alert-success">{ok}</div>}

      <div className="ics-card">
        <div className="ics-card-head">
          <div>
            <h2>Settings Scope</h2>
            <p>Choose whether these settings apply company-wide or only to the active branch.</p>
          </div>
        </div>

        <div className="ics-segment">
          <button
            className={scope === "company" ? "active" : ""}
            onClick={() => setScope("company")}
          >
            Company Default
          </button>

          <button
            className={scope === "branch" ? "active" : ""}
            onClick={() => setScope("branch")}
            disabled={!branchId}
          >
            Active Branch
          </button>

          <button
            className={scope === "location" ? "active" : ""}
            onClick={() => setScope("location")}
            disabled={!branchId}
          >
            Stock Location
          </button>
        </div>

        {scope === "location" && (
          <label className="ics-field ics-location-field">
            <span>Stock Location</span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              <option value="">Select stock location...</option>
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
          Current effective policy:{" "}
          <strong>
            {current?.locationId
              ? "Stock location override"
              : current?.branchId
                ? "Active branch override"
                : current
                  ? "Company default"
                  : "System default"}
          </strong>
        </div>
      </div>

      <div className="ics-grid">
        <div className="ics-card">
          <div className="ics-card-head">
            <div>
              <h2>Variance Thresholds</h2>
              <p>Used by stock count and inventory adjustment anomaly detection.</p>
            </div>
          </div>

          <NumberField
            label="Warning Variance %"
            value={form.warningVariancePercent}
            onChange={(v) => patch({ warningVariancePercent: v })}
          />

          <NumberField
            label="High Variance %"
            value={form.highVariancePercent}
            onChange={(v) => patch({ highVariancePercent: v })}
          />

          <NumberField
            label="Critical Variance %"
            value={form.criticalVariancePercent}
            onChange={(v) => patch({ criticalVariancePercent: v })}
          />

          <NumberField
            label="Approval Threshold %"
            value={form.approvalThresholdPercent}
            onChange={(v) => patch({ approvalThresholdPercent: v })}
          />
        </div>

        <div className="ics-card">
          <div className="ics-card-head">
            <div>
              <h2>Approval & Posting Rules</h2>
              <p>Controls workflow escalation and posting safety.</p>
            </div>
          </div>

          <Toggle
            label="Require approval for high variance"
            checked={form.requireApprovalForHighVariance}
            onChange={(v) => patch({ requireApprovalForHighVariance: v })}
          />

          <Toggle
            label="Block posting on critical variance"
            checked={form.blockPostingOnCriticalVariance}
            onChange={(v) => patch({ blockPostingOnCriticalVariance: v })}
          />

          <Toggle
            label="Require reason on variance"
            checked={form.requireReasonOnVariance}
            onChange={(v) => patch({ requireReasonOnVariance: v })}
          />
        </div>

        <div className="ics-card">
          <div className="ics-card-head">
            <div>
              <h2>Stock Count Controls</h2>
              <p>Controls count discipline during physical inventory.</p>
            </div>
          </div>

          <Toggle
            label="Lock inventory during count"
            checked={form.lockInventoryDuringCount}
            onChange={(v) => patch({ lockInventoryDuringCount: v })}
          />
        </div>

        <div className="ics-card">
          <div className="ics-card-head">
            <div>
              <h2>Costing Controls</h2>
              <p>Controls whether stock can go below zero.</p>
            </div>
          </div>

          <Toggle
            label="Allow negative inventory"
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
