// src/modules/company/onboarding/steps/StockLocationsStep.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";

import type {
  CreateStockLocationDto,
  StockLocation,
  StockLocationType,
} from "../../types/company.types";

import { stockLocationsApi } from "../../api/stockLocationsApi";
import { LOCATION_TYPES } from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction } from "../state/onboarding.types";
import { extractApiError } from "../utils/onboarding.utils";

import {
  Alert,
  Btn,
  EmptyState,
  Field,
  Input,
  SectionTitle,
  SelectInput,
  Spinner,
} from "../components/company.ui";

type Capability = {
  canReceive: boolean;
  canIssue: boolean;
  canSell: boolean;
  canProduce: boolean;
};

type LocationForm = Capability & {
  name: string;
  code: string;
  locationType: StockLocationType;
  isActive: boolean;
  isDefault: boolean;
  isDefaultReceiving: boolean;
  isDefaultIssue: boolean;
};

const DEFAULT_LOCATION_TYPE = "Warehouse" as unknown as StockLocationType;

const DEFAULT_FORM: LocationForm = {
  name: "",
  code: "",
  locationType: DEFAULT_LOCATION_TYPE,
  isActive: true,
  isDefault: false,
  isDefaultReceiving: false,
  isDefaultIssue: false,
  canReceive: true,
  canIssue: true,
  canSell: false,
  canProduce: false,
};

const LOCATION_TYPE_OPTIONS = LOCATION_TYPES.map((x) => ({
  value: String((x as any).value ?? x),
  label: String((x as any).label ?? x),
}));

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function locationId(location: StockLocation): string {
  const x = location as any;
  return asText(x.id ?? x.Id ?? x.locationId ?? x.stockLocationId);
}

function locationBranchId(location: StockLocation): string {
  const x = location as any;
  return asText(x.branchId ?? x.BranchId);
}

function isAssigned(location: StockLocation, branchId: string): boolean {
  return locationBranchId(location).toLowerCase() === branchId.toLowerCase();
}

function toLocationType(value: unknown): StockLocationType {
  return String(value ?? DEFAULT_LOCATION_TYPE) as unknown as StockLocationType;
}

function readLocationType(location: StockLocation): StockLocationType {
  const x = location as any;
  return toLocationType(x.locationType ?? x.type ?? DEFAULT_LOCATION_TYPE);
}

function normalizeType(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function defaultCapability(type: StockLocationType): Capability {
  switch (normalizeType(type)) {
    case "Warehouse":
    case "MainStore":
    case "KitchenStore":
    case "BarStore":
      return {
        canReceive: true,
        canIssue: true,
        canSell: false,
        canProduce: false,
      };

    case "Production":
    case "KitchenProduction":
      return {
        canReceive: true,
        canIssue: true,
        canSell: false,
        canProduce: true,
      };

    case "POS":
    case "SalesOutlet":
      return {
        canReceive: false,
        canIssue: false,
        canSell: true,
        canProduce: false,
      };

    case "Transit":
      return {
        canReceive: false,
        canIssue: false,
        canSell: false,
        canProduce: false,
      };

    default:
      return {
        canReceive: false,
        canIssue: false,
        canSell: false,
        canProduce: false,
      };
  }
}

function applyTypeDefaults(
  form: LocationForm,
  type: StockLocationType,
): LocationForm {
  const caps = defaultCapability(type);

  return {
    ...form,
    locationType: type,
    ...caps,
    isDefaultReceiving: caps.canReceive ? form.isDefaultReceiving : false,
    isDefaultIssue: caps.canIssue ? form.isDefaultIssue : false,
  };
}

function formFromLocation(location: StockLocation): LocationForm {
  const x = location as any;
  const type = readLocationType(location);
  const caps = defaultCapability(type);

  return {
    name: String(x.name ?? ""),
    code: String(x.code ?? ""),
    locationType: type,
    isActive: x.isActive ?? true,
    isDefault: x.isDefault ?? false,
    isDefaultReceiving: x.isDefaultReceiving ?? false,
    isDefaultIssue: x.isDefaultIssue ?? false,
    canReceive: x.canReceive ?? caps.canReceive,
    canIssue: x.canIssue ?? caps.canIssue,
    canSell: x.canSell ?? caps.canSell,
    canProduce: x.canProduce ?? caps.canProduce,
  };
}

function validateForm(
  form: LocationForm,
  setErrors: (errors: FieldErrors) => void,
): boolean {
  const errors: FieldErrors = {};

  if (!form.name.trim()) errors.name = "Location name is required.";
  if (!form.code.trim()) errors.code = "Location code is required.";
  if (!String(form.locationType).trim()) {
    errors.locationType = "Location type is required.";
  }

  if (!form.canReceive && !form.canIssue && !form.canSell && !form.canProduce) {
    errors.capabilities = "At least one capability is required.";
  }

  if (form.isDefaultReceiving && !form.canReceive) {
    errors.isDefaultReceiving =
      "Default receiving location must be able to receive.";
  }

  if (form.isDefaultIssue && !form.canIssue) {
    errors.isDefaultIssue = "Default issue location must be able to issue.";
  }

  setErrors(errors);
  return Object.keys(errors).length === 0;
}

function toPayload(form: LocationForm): CreateStockLocationDto {
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    locationType: form.locationType,
    isActive: form.isActive,
    isDefault: form.isDefault,
    isDefaultReceiving: form.isDefaultReceiving,
    isDefaultIssue: form.isDefaultIssue,
    canReceive: form.canReceive,
    canIssue: form.canIssue,
    canSell: form.canSell,
    canProduce: form.canProduce,
  } as CreateStockLocationDto;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function ValidationAlerts({ errors }: { errors: FieldErrors }) {
  return (
    <>
      {Object.values(errors)
        .filter(Boolean)
        .map((message, index) => (
          <Alert
            key={`${message}-${index}`}
            tone="danger"
            title="Validation"
            message={message!}
          />
        ))}
    </>
  );
}

function CheckboxField(props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: props.disabled ? "#94a3b8" : "#334155",
      }}
    >
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {props.label}
    </label>
  );
}

function CapabilityBadges({ caps }: { caps: Capability }) {
  const items = [
    ["Receive", caps.canReceive],
    ["Issue", caps.canIssue],
    ["Sell", caps.canSell],
    ["Produce", caps.canProduce],
  ] as const;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {items.map(([label, enabled]) => (
        <span
          key={label}
          className={enabled ? "ob-badge ob-badge--success" : "ob-badge"}
        >
          {enabled ? "✓" : "—"} {label}
        </span>
      ))}
    </div>
  );
}

function CapabilitiesEditor(props: {
  form: LocationForm;
  setForm: React.Dispatch<React.SetStateAction<LocationForm>>;
}) {
  return (
    <div className="ob-grid-2">
      <CheckboxField
        label="Can receive stock"
        checked={props.form.canReceive}
        onChange={(checked) =>
          props.setForm((form) => ({
            ...form,
            canReceive: checked,
            isDefaultReceiving: checked ? form.isDefaultReceiving : false,
          }))
        }
      />

      <CheckboxField
        label="Can issue stock"
        checked={props.form.canIssue}
        onChange={(checked) =>
          props.setForm((form) => ({
            ...form,
            canIssue: checked,
            isDefaultIssue: checked ? form.isDefaultIssue : false,
          }))
        }
      />

      <CheckboxField
        label="Can sell"
        checked={props.form.canSell}
        onChange={(checked) =>
          props.setForm((form) => ({ ...form, canSell: checked }))
        }
      />

      <CheckboxField
        label="Can produce"
        checked={props.form.canProduce}
        onChange={(checked) =>
          props.setForm((form) => ({ ...form, canProduce: checked }))
        }
      />

      <CheckboxField
        label="Active"
        checked={props.form.isActive}
        onChange={(checked) =>
          props.setForm((form) => ({ ...form, isActive: checked }))
        }
      />

      <CheckboxField
        label="Default for branch"
        checked={props.form.isDefault}
        onChange={(checked) =>
          props.setForm((form) => ({ ...form, isDefault: checked }))
        }
      />

      <CheckboxField
        label="Default receiving"
        checked={props.form.isDefaultReceiving}
        disabled={!props.form.canReceive}
        onChange={(checked) =>
          props.setForm((form) => ({
            ...form,
            isDefaultReceiving: checked,
            canReceive: checked ? true : form.canReceive,
          }))
        }
      />

      <CheckboxField
        label="Default issue"
        checked={props.form.isDefaultIssue}
        disabled={!props.form.canIssue}
        onChange={(checked) =>
          props.setForm((form) => ({
            ...form,
            isDefaultIssue: checked,
            canIssue: checked ? true : form.canIssue,
          }))
        }
      />
    </div>
  );
}

export function StockLocationsStep(props: {
  companyId: string | null;
  branchId: string | null;
  branchName?: string;
  saving: boolean;
  dispatch: React.Dispatch<OnboardingAction>;
  onChanged?: () => Promise<void> | void;
}) {
  const [items, setItems] = useState<StockLocation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [originalSelectedIds, setOriginalSelectedIds] = useState<Set<string>>(
    new Set(),
  );

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LocationForm>({ ...DEFAULT_FORM });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editSaving, setEditSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<LocationForm>({
    ...DEFAULT_FORM,
  });
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createSaving, setCreateSaving] = useState(false);

  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const canManage = Boolean(props.companyId && props.branchId);

  const assignmentDirty = useMemo(
    () => !sameSet(selectedIds, originalSelectedIds),
    [selectedIds, originalSelectedIds],
  );

  const selectedCount = selectedIds.size;

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aSelected = selectedIds.has(locationId(a)) ? 0 : 1;
      const bSelected = selectedIds.has(locationId(b)) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;

      const af = formFromLocation(a);
      const bf = formFromLocation(b);

      const aDefault = af.isDefaultReceiving || af.isDefaultIssue ? 0 : 1;
      const bDefault = bf.isDefaultReceiving || bf.isDefaultIssue ? 0 : 1;
      if (aDefault !== bDefault) return aDefault - bDefault;

      return af.name.localeCompare(bf.name);
    });
  }, [items, selectedIds]);

  const fetchLocations = useCallback(async () => {
    if (!props.companyId || !props.branchId) {
      setItems([]);
      setSelectedIds(new Set());
      setOriginalSelectedIds(new Set());
      setLoadError(
        "Company and branch are required before stock locations can be loaded.",
      );
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const data = await stockLocationsApi.list(props.companyId, {
        activeOnly: false,
        page: 1,
        pageSize: 500,
      });

      const nextItems = Array.isArray(data) ? data : [];

      const assigned = new Set(
        nextItems
          .filter((item) => isAssigned(item, props.branchId!))
          .map(locationId)
          .filter(Boolean),
      );

      setItems(nextItems);
      setSelectedIds(assigned);
      setOriginalSelectedIds(new Set(assigned));
    } catch (err) {
      setItems([]);
      setSelectedIds(new Set());
      setOriginalSelectedIds(new Set());
      setLoadError(extractApiError(err, "Failed to load stock locations."));
    } finally {
      setLoading(false);
    }
  }, [props.companyId, props.branchId]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (!loading && canManage && items.length === 0) {
      setShowCreate(true);
    }
  }, [loading, canManage, items.length]);

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function openEdit(location: StockLocation) {
    setExpandedId(locationId(location));
    setEditForm(formFromLocation(location));
    setEditErrors({});
  }

  function closeEdit() {
    setExpandedId(null);
    setEditErrors({});
  }

  async function refreshAfterSave() {
    await fetchLocations();
    await props.onChanged?.();
  }

  async function saveAssignments() {
  if (!props.companyId || !props.branchId) return;

  setAssignmentSaving(true);
  props.dispatch({ type: "SAVE_START" });

  try {
    const selectedLocationIds = [...selectedIds];

    await stockLocationsApi.assignManyToBranch(
      props.companyId,
      props.branchId,
      {
        stockLocationIds: selectedLocationIds,
      },
    );

    await fetchLocations();
    await props.onChanged?.();

    props.dispatch({
      type: "SAVE_SUCCESS",
      notice: "Stock locations assigned to branch successfully.",
    });
  } catch (err) {
    props.dispatch({
      type: "SAVE_ERROR",
      error: extractApiError(
        err,
        "Failed to assign stock locations to this branch.",
      ),
    });
  } finally {
    setAssignmentSaving(false);
  }
}

  async function saveConfiguration(id: string) {
    if (!props.companyId) return;
    if (!validateForm(editForm, setEditErrors)) return;

    const current = items.find((item) => locationId(item) === id);
    const branchId = selectedIds.has(id)
      ? props.branchId
      : current
        ? locationBranchId(current) || null
        : null;

    setEditSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      await stockLocationsApi.update(props.companyId, id, {
        ...toPayload(editForm),
        branchId,
      });

      await refreshAfterSave();
      closeEdit();

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "Stock location configuration updated.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to update stock location."),
      });
    } finally {
      setEditSaving(false);
    }
  }

  async function setDefault(id: string, type: "receiving" | "issue") {
    if (!props.companyId || !props.branchId) return;

    props.dispatch({ type: "SAVE_START" });

    try {
      await stockLocationsApi.assignToBranch(props.companyId, id, props.branchId);

      if (type === "receiving") {
        await stockLocationsApi.setDefaultReceiving(
          props.companyId,
          id,
          props.branchId,
        );
      } else {
        await stockLocationsApi.setDefaultIssue(
          props.companyId,
          id,
          props.branchId,
        );
      }

      await refreshAfterSave();

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: `Default ${type} location set.`,
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to set default stock location."),
      });
    }
  }

  async function createLocation() {
    if (!props.companyId || !props.branchId) return;
    if (!validateForm(createForm, setCreateErrors)) return;

    setCreateSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      const created = await stockLocationsApi.create(
        props.companyId,
        toPayload(createForm),
        props.branchId,
      );

      const id = locationId(created);

      if (id) {
        await stockLocationsApi.assignToBranch(
          props.companyId,
          id,
          props.branchId,
        );
      }

      await refreshAfterSave();

      setCreateForm({ ...DEFAULT_FORM });
      setCreateErrors({});
      setShowCreate(false);

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "Stock location added and assigned to branch.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to create stock location."),
      });
    } finally {
      setCreateSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "24px 0",
          color: "#64748b",
        }}
      >
        <Spinner /> Loading stock locations…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {loadError && (
        <Alert
          tone="danger"
          title="Unable to load stock locations"
          message={loadError}
        />
      )}

      {!canManage && (
        <Alert
          tone="warn"
          title="Select company and branch first"
          message="Stock locations are company-owned records and can be assigned to a branch during setup."
        />
      )}

      {canManage && (
        <div className="ob-inner-card">
          <div className="ob-inner-card-body">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                  Branch stock-location assignment
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                  {selectedCount} selected for{" "}
                  {props.branchName ?? "this branch"}.
                </div>
              </div>

              <Btn
                variant="primary"
                onClick={() => void saveAssignments()}
                disabled={!assignmentDirty || assignmentSaving || props.saving}
              >
                {assignmentSaving ? "Saving…" : "Save selected locations"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && !showCreate && !loadError && canManage && (
        <EmptyState
          title="No stock locations yet"
          sub={`Add warehouse, store, production, sales, or transit locations for ${
            props.branchName ?? "this branch"
          }.`}
        />
      )}

      {sortedItems.map((location) => {
        const id = locationId(location);
        const x = location as any;
        const form = formFromLocation(location);
        const selected = selectedIds.has(id);
        const expanded = expandedId === id;

        return (
          <div
            key={id}
            style={{
              border: selected ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
              borderRadius: 12,
              background: selected ? "#f5f3ff" : "#fff",
              overflow: "hidden",
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
              <input
                type="checkbox"
                checked={selected}
                disabled={!canManage || assignmentSaving}
                onChange={(event) => toggleSelected(id, event.target.checked)}
                title="Assign this stock location to this branch"
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
                    style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                  >
                    {x.name ?? "—"}
                  </span>

                  {x.code && (
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: "#64748b",
                        background: "#f1f5f9",
                        padding: "1px 6px",
                        borderRadius: 5,
                      }}
                    >
                      {x.code}
                    </span>
                  )}

                  <span className="ob-badge">
                    {String(form.locationType)}
                  </span>

                  {selected && (
                    <span className="ob-badge ob-badge--success">
                      Assigned
                    </span>
                  )}

                  {form.isDefaultReceiving && (
                    <span className="ob-badge ob-badge--success">
                      Default Receiving
                    </span>
                  )}

                  {form.isDefaultIssue && (
                    <span className="ob-badge ob-badge--info">
                      Default Issue
                    </span>
                  )}

                  {!form.isActive && (
                    <span className="ob-badge ob-badge--warn">Inactive</span>
                  )}
                </div>

                <CapabilityBadges caps={form} />
              </div>

              <Btn
                variant="ghost"
                onClick={() => (expanded ? closeEdit() : openEdit(location))}
                disabled={editSaving}
                style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}
              >
                {expanded ? "Close" : "Configure"}
              </Btn>
            </div>

            {expanded && (
              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  padding: "20px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <ValidationAlerts errors={editErrors} />

                <SectionTitle
                  title="Location configuration"
                  subtitle="This updates the stock-location master record. Branch assignment is saved separately."
                />

                <div className="ob-grid-2">
                  <Field label="Name" required>
                    <Input
                      value={editForm.name}
                      onChange={(value) =>
                        setEditForm((form) => ({ ...form, name: value }))
                      }
                      placeholder="Main Warehouse"
                    />
                  </Field>

                  <Field label="Code" required>
                    <Input
                      value={editForm.code}
                      onChange={(value) =>
                        setEditForm((form) => ({
                          ...form,
                          code: value.toUpperCase(),
                        }))
                      }
                      placeholder="WH-01"
                    />
                  </Field>

                  <Field label="Type" required>
                    <SelectInput
                      value={String(editForm.locationType)}
                      options={LOCATION_TYPE_OPTIONS}
                      onChange={(value) =>
                        setEditForm((form) =>
                          applyTypeDefaults(form, toLocationType(value)),
                        )
                      }
                    />
                  </Field>
                </div>

                <SectionTitle
                  title="Capabilities"
                  subtitle="These capabilities control inventory movement behavior."
                />

                <CapabilitiesEditor form={editForm} setForm={setEditForm} />

                <SectionTitle
                  title="Default assignments"
                  subtitle="Setting a default will assign this location to the branch first."
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Btn
                    variant={form.isDefaultReceiving ? "primary" : "ghost"}
                    onClick={() => void setDefault(id, "receiving")}
                    disabled={form.isDefaultReceiving || editSaving}
                    style={{ fontSize: 12 }}
                  >
                    {form.isDefaultReceiving
                      ? "✓ Default Receiving"
                      : "Set as Default Receiving"}
                  </Btn>

                  <Btn
                    variant={form.isDefaultIssue ? "primary" : "ghost"}
                    onClick={() => void setDefault(id, "issue")}
                    disabled={form.isDefaultIssue || editSaving}
                    style={{ fontSize: 12 }}
                  >
                    {form.isDefaultIssue
                      ? "✓ Default Issue"
                      : "Set as Default Issue"}
                  </Btn>
                </div>

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
                    onClick={() => void saveConfiguration(id)}
                    disabled={editSaving}
                  >
                    {editSaving ? "Saving…" : "Save configuration"}
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
          onClick={() => setShowCreate((value) => !value)}
          disabled={!canManage}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "none",
            border: "none",
            cursor: canManage ? "pointer" : "not-allowed",
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
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                Add stock location
              </div>

              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                Warehouse, store, production, sales outlet, or transit location.
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
              gap: 16,
            }}
          >
            <ValidationAlerts errors={createErrors} />

            <SectionTitle
              title="New stock location"
              subtitle="Create a company stock location and assign it to this branch."
            />

            <div className="ob-grid-2">
              <Field label="Name" required>
                <Input
                  value={createForm.name}
                  onChange={(value) =>
                    setCreateForm((form) => ({ ...form, name: value }))
                  }
                  placeholder="Main Warehouse"
                />
              </Field>

              <Field label="Code" required>
                <Input
                  value={createForm.code}
                  onChange={(value) =>
                    setCreateForm((form) => ({
                      ...form,
                      code: value.toUpperCase(),
                    }))
                  }
                  placeholder="WH-01"
                />
              </Field>

              <Field label="Type" required>
                <SelectInput
                  value={String(createForm.locationType)}
                  options={LOCATION_TYPE_OPTIONS}
                  onChange={(value) =>
                    setCreateForm((form) =>
                      applyTypeDefaults(form, toLocationType(value)),
                    )
                  }
                />
              </Field>
            </div>

            <SectionTitle
              title="Capabilities"
              subtitle="These capabilities control inventory movement behavior."
            />

            <CapabilitiesEditor form={createForm} setForm={setCreateForm} />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn
                variant="primary"
                onClick={() => void createLocation()}
                disabled={createSaving || !canManage}
              >
                {createSaving ? "Adding…" : "Add and assign location"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}