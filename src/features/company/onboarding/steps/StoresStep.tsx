// src/modules/company/onboarding/steps/StoresStep.tsx
// ERP-grade POS/store setup.
// Company owns stock locations. Branch assigns stock locations.
// Stores/POS belong to a branch.
// UI selects BranchStockLocation.Id, backend validates it,
// then stores Store.IssueStockLocationId as StockLocation.Id.

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";

import type { StockLocation, StoreDto } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import { STORE_TYPES } from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction, StoreType } from "../state/onboarding.types";
import { extractApiError, trimOrNull } from "../utils/onboarding.utils";
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

type Props = {
  companyId: string | null;
  branchId: string | null;
  branchName?: string;
  saving: boolean;
  dispatch: React.Dispatch<OnboardingAction>;
  onChanged?: () => Promise<void> | void;
};

type StoreForm = {
  name: string;
  code: string;
  storeType: string;

  /**
   * UI-only BranchStockLocation.Id.
   * Backend validates this assignment and stores Store.IssueStockLocationId
   * as the company StockLocation.Id.
   */
  selectedBranchIssueLocationId: string;

  isActive: boolean;
};

type BranchStockLocation = StockLocation & {
  id?: string;
  Id?: string;
  branchStockLocationId?: string;
  BranchStockLocationId?: string;
  branchLocationId?: string;
  BranchLocationId?: string;
  stockLocationId?: string;
  StockLocationId?: string;
  locationId?: string;
  LocationId?: string;
  name?: string;
  code?: string;
  locationType?: string;
  type?: string;
  canIssue?: boolean;
  canSell?: boolean;
  isDefaultIssue?: boolean;
  isActive?: boolean;
  active?: boolean;
};

type SelectOption = { value: string; label: string };

const EMPTY_FORM: StoreForm = {
  name: "",
  code: "",
  storeType: "DineIn",
  selectedBranchIssueLocationId: "",
  isActive: true,
};

const STORE_TYPE_OPTIONS = STORE_TYPES.map((type) => ({ value: type, label: type }));

function arr<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  const x = value as any;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.results)) return x.results;
  if (Array.isArray(x?.stores)) return x.stores;
  if (Array.isArray(x?.stockLocations)) return x.stockLocations;

  return [];
}

function idOf(value: any): string {
  return String(value?.id ?? value?.Id ?? value?.storeId ?? value?.StoreId ?? "").trim();
}

function branchStockLocationIdOf(value: any): string {
  return String(
    value?.branchStockLocationId ??
      value?.BranchStockLocationId ??
      value?.branchLocationId ??
      value?.BranchLocationId ??
      value?.id ??
      value?.Id ??
      "",
  ).trim();
}

function companyStockLocationIdOf(value: any): string {
  return String(
    value?.stockLocationId ??
      value?.StockLocationId ??
      value?.locationId ??
      value?.LocationId ??
      value?.stockLocation?.id ??
      value?.StockLocation?.Id ??
      "",
  ).trim();
}

function isActive(value: any): boolean {
  return value?.isActive !== false && value?.active !== false;
}

function storeName(value: any): string {
  return String(value?.name ?? value?.storeName ?? "Unnamed POS");
}

function storeCode(value: any): string {
  return String(value?.code ?? value?.storeCode ?? "");
}

function storeTypeOf(value: any): string {
  return String(value?.storeType ?? value?.locationType ?? value?.type ?? "DineIn");
}

function storeIssueCompanyStockLocationIdOf(value: any): string {
  return String(
    value?.issueStockLocationId ??
      value?.IssueStockLocationId ??
      value?.defaultIssueStockLocationId ??
      value?.DefaultIssueStockLocationId ??
      value?.issueLocationId ??
      value?.stockLocationId ??
      value?.issueLocation?.id ??
      "",
  ).trim();
}

function canIssue(location: BranchStockLocation): boolean {
  const type = String(location.locationType ?? location.type ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return (
    isActive(location) &&
    (location.canIssue === true ||
      location.canSell === true ||
      location.isDefaultIssue === true ||
      ["warehouse", "mainwarehouse", "kitchenstore", "barstore", "production", "consumption"].includes(type))
  );
}

function locationLabel(location: BranchStockLocation): string {
  return `${location?.name ?? "Stock location"}${location?.code ? ` (${location.code})` : ""}`;
}

function validate(form: StoreForm, setErrors: (errors: FieldErrors) => void): boolean {
  const errors: FieldErrors = {};

  if (!form.name.trim()) {
    errors.name = "POS/store name is required.";
  }

  setErrors(errors);
  return Object.keys(errors).length === 0;
}

function formFromStore(store: StoreDto, issueLocations: BranchStockLocation[]): StoreForm {
  const x = store as any;
  const companyIssueId = storeIssueCompanyStockLocationIdOf(x);

  const selectedBranchIssueLocationId = branchStockLocationIdOf(
    issueLocations.find((location) => companyStockLocationIdOf(location) === companyIssueId),
  );

  return {
    name: storeName(x),
    code: storeCode(x),
    storeType: storeTypeOf(x),
    selectedBranchIssueLocationId,
    isActive: x.isActive !== false,
  };
}

const Summary = memo(function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ob-inner-card">
      <div className="ob-inner-card-body">
        <div style={{ color: "#64748b", fontSize: 11 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      </div>
    </div>
  );
});

const StoreFields = memo(function StoreFields(props: {
  value: StoreForm;
  errors: FieldErrors;
  onChange: React.Dispatch<React.SetStateAction<StoreForm>>;
  locationOptions: SelectOption[];
  issueLocationsCount: number;
}) {
  const f = props.value;

  const set = useCallback(
    (patch: Partial<StoreForm>) => {
      props.onChange((current) => ({ ...current, ...patch }));
    },
    [props],
  );

  return (
    <>
      {Object.values(props.errors)
        .filter(Boolean)
        .map((message) => (
          <Alert key={message} tone="danger" title="Validation" message={message!} />
        ))}

      <SectionTitle
        title="POS / Store"
        subtitle="A branch supports one or more POS. Fallback issue location is optional when item/category rules or branch defaults exist."
      />

      <div className="ob-grid-2">
        <Field label="POS/store name" required error={props.errors.name}>
          <Input value={f.name} onChange={(v) => set({ name: v })} placeholder="Main POS" />
        </Field>

        <Field label="Code">
          <Input value={f.code} onChange={(v) => set({ code: v.toUpperCase() })} placeholder="POS-01" />
        </Field>

        <Field label="POS/store type">
          <SelectInput
            value={f.storeType}
            onChange={(v) => set({ storeType: v as StoreType })}
            options={STORE_TYPE_OPTIONS as any}
          />
        </Field>

        <Field
          label="Fallback issue stock location"
          hint="Select a branch-assigned stock location. Leave blank to use branch default."
        >
          <SelectInput
            value={f.selectedBranchIssueLocationId}
            onChange={(v) => set({ selectedBranchIssueLocationId: v })}
            options={props.locationOptions}
            disabled={props.issueLocationsCount === 0}
          />
        </Field>
      </div>
    </>
  );
});

export function StoresStep(props: Props) {
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [locations, setLocations] = useState<BranchStockLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StoreForm>({ ...EMPTY_FORM });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editSaving, setEditSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<StoreForm>({ ...EMPTY_FORM });
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createSaving, setCreateSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!props.companyId || !props.branchId) {
      setStores([]);
      setLocations([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [storeRows, assignedLocations] = await Promise.all([
        onboardingApi.listStores(props.companyId, props.branchId),
        onboardingApi.listStockLocations(props.companyId, props.branchId),
      ]);

      setStores(arr<StoreDto>(storeRows).filter(isActive).sort((a, b) => storeName(a).localeCompare(storeName(b))));
      setLocations(arr<BranchStockLocation>(assignedLocations).filter(isActive));
    } catch (err) {
      setStores([]);
      setLocations([]);
      setShowCreate(true);
      setLoadError(extractApiError(err, "Failed to load POS/stores."));
    } finally {
      setLoading(false);
    }
  }, [props.companyId, props.branchId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!loading && props.companyId && props.branchId && stores.length === 0) {
      setShowCreate(true);
    }
  }, [loading, props.companyId, props.branchId, stores.length]);

  const issueLocations = useMemo(() => locations.filter(canIssue), [locations]);

  const defaultIssueLocation = useMemo(
    () => issueLocations.find((location) => location.isDefaultIssue === true) ?? null,
    [issueLocations],
  );

  const locationOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: "",
        label: defaultIssueLocation
          ? `Use branch default — ${locationLabel(defaultIssueLocation)}`
          : "Use branch default",
      },
      ...issueLocations.map((location) => ({
        value: branchStockLocationIdOf(location),
        label: locationLabel(location),
      })),
    ],
    [issueLocations, defaultIssueLocation],
  );

  const mappedName = useCallback(
    (store: StoreDto): string => {
      const companyIssueId = storeIssueCompanyStockLocationIdOf(store as any);

      if (!companyIssueId) {
        return defaultIssueLocation ? `Branch default: ${locationLabel(defaultIssueLocation)}` : "No issue fallback";
      }

      const matched = issueLocations.find(
        (location) => companyStockLocationIdOf(location) === companyIssueId,
      );

      return matched ? locationLabel(matched) : companyIssueId;
    },
    [defaultIssueLocation, issueLocations],
  );

  const saveStore = useCallback(
    async (storeId: string) => {
      if (!props.companyId || !props.branchId || !validate(editForm, setEditErrors)) return;

      setEditSaving(true);
      props.dispatch({ type: "SAVE_START" });

      try {
        const selectedBranchIssueLocationId = editForm.selectedBranchIssueLocationId;

        await onboardingApi.updateStore(props.companyId, props.branchId, storeId, {
          name: editForm.name.trim(),
          code: trimOrNull(editForm.code),
          storeType: editForm.storeType,
          locationType: editForm.storeType,
          isActive: editForm.isActive,
          issueStockLocationId: selectedBranchIssueLocationId || null,
        } as any);

        if (selectedBranchIssueLocationId) {
          await onboardingApi.mapStoreIssueLocation(
            props.companyId,
            props.branchId,
            storeId,
            selectedBranchIssueLocationId,
          );
        }

        await fetchAll();
        await props.onChanged?.();

        setExpandedId(null);
        props.dispatch({ type: "SAVE_SUCCESS", notice: "POS/store updated." });
      } catch (err) {
        props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update POS/store.") });
      } finally {
        setEditSaving(false);
      }
    },
    [editForm, fetchAll, props],
  );

  const createStore = useCallback(async () => {
    if (!props.companyId || !props.branchId || !validate(createForm, setCreateErrors)) return;

    setCreateSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      const selectedBranchIssueLocationId = createForm.selectedBranchIssueLocationId;

      const created = await onboardingApi.createStore(props.companyId, props.branchId, {
        name: createForm.name.trim(),
        code: trimOrNull(createForm.code),
        storeType: createForm.storeType,
        locationType: createForm.storeType,
        isActive: createForm.isActive,
        issueStockLocationId: selectedBranchIssueLocationId || null,
      } as any);

      const storeId = idOf((created as any)?.data ?? created);

      if (storeId && selectedBranchIssueLocationId) {
        await onboardingApi.mapStoreIssueLocation(
          props.companyId,
          props.branchId,
          storeId,
          selectedBranchIssueLocationId,
        );
      }

      await fetchAll();
      await props.onChanged?.();

      setCreateForm({ ...EMPTY_FORM });
      setCreateErrors({});
      setShowCreate(false);

      props.dispatch({ type: "SAVE_SUCCESS", notice: "POS/store added." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to create POS/store.") });
    } finally {
      setCreateSaving(false);
    }
  }, [createForm, fetchAll, props]);

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "24px 0", color: "#64748b" }}>
        <Spinner /> Loading POS/stores…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!props.companyId || !props.branchId ? (
        <Alert tone="warn" title="Select branch first" message="POS/stores are configured per branch." />
      ) : null}

      {loadError && <Alert tone="danger" title="Unable to load POS/stores" message={loadError} />}

      {issueLocations.length === 0 && props.branchId && (
        <Alert
          tone="warn"
          title="No issue-capable stock locations"
          message="Assign at least one issue-capable branch stock location before POS sales can consume inventory."
        />
      )}

      <div className="ob-grid-3">
        <Summary label="POS/stores" value={stores.length} />
        <Summary label="Issue-capable locations" value={issueLocations.length} />
        <Summary label="Branch default issue" value={defaultIssueLocation ? "Configured" : "Missing"} />
      </div>

      {stores.length === 0 && !showCreate && (
        <EmptyState
          title="No POS/stores configured"
          sub="Add at least one POS for a sales-enabled branch. One or more POS are supported."
        />
      )}

      {stores.map((store) => {
        const id = idOf(store);
        const expanded = expandedId === id;
        const f = formFromStore(store, issueLocations);

        return (
          <div key={id} className="ob-inner-card">
            <div
              className="ob-inner-card-body"
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}
            >
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <strong>{f.name}</strong>
                  {f.code && <span className="ob-badge">{f.code}</span>}
                  <span className="ob-badge">{f.storeType}</span>
                  {f.isActive && <span className="ob-badge ob-badge--success">Active</span>}
                </div>

                <div style={{ fontSize: 12, color: "#64748b", marginTop: 5 }}>
                  Fallback issue: {mappedName(store)}
                </div>
              </div>

              <Btn
                variant="ghost"
                onClick={() => {
                  setExpandedId(expanded ? null : id);
                  setEditForm(f);
                  setEditErrors({});
                }}
              >
                {expanded ? "Close" : "Configure"}
              </Btn>
            </div>

            {expanded && (
              <div
                className="ob-inner-card-body"
                style={{ borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 16 }}
              >
                <StoreFields
                  value={editForm}
                  errors={editErrors}
                  onChange={setEditForm}
                  locationOptions={locationOptions}
                  issueLocationsCount={issueLocations.length}
                />

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Btn variant="primary" disabled={editSaving || props.saving} onClick={() => void saveStore(id)}>
                    {editSaving ? "Saving…" : "Save POS/store"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="ob-inner-card">
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          style={{
            width: "100%",
            padding: 14,
            background: "transparent",
            border: "none",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <strong>{showCreate ? "Close POS/store form" : "+ Add POS/store"}</strong>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
            Use one POS for a simple branch or multiple POS for restaurant, bar, delivery, retail, or room service.
          </div>
        </button>

        {showCreate && (
          <div className="ob-inner-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <StoreFields
              value={createForm}
              errors={createErrors}
              onChange={setCreateForm}
              locationOptions={locationOptions}
              issueLocationsCount={issueLocations.length}
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn
                variant="primary"
                disabled={!props.companyId || !props.branchId || createSaving || props.saving}
                onClick={() => void createStore()}
              >
                {createSaving ? "Adding…" : "Add POS/store"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}