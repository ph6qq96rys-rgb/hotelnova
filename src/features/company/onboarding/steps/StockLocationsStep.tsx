// src/modules/company/onboarding/steps/StockLocationsStep.tsx

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";

import type {
  CreateStockLocationDto,
  StockLocation,
  StockLocationType,
} from "../../types/company.types";
import {
  stockLocationsApi,
  type BranchInventoryConfigurationDto,
  type UpsertBranchInventoryConfigurationDto,
} from "../../api/stockLocationsApi";
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

type Props = {
  companyId: string | null;
  branchId: string | null;
  branchName?: string;
  hasSalesOperations?: boolean;
  saving: boolean;
  dispatch: React.Dispatch<OnboardingAction>;
  onChanged?: () => Promise<void> | void;
};

type LocationForm = {
  name: string;
  code: string;
  locationType: StockLocationType;
  isActive: boolean;
  canReceive: boolean;
  canIssue: boolean;
  canSell: boolean;
  canProduce: boolean;
  canAdjust: boolean;
  isConsumptionLocation: boolean;
  isMainWarehouse: boolean;
  canReceiveGrn: boolean;
  isProductionCenter: boolean;
};

type BranchAssignmentOption = {
  branchStockLocationId: string;
  stockLocationId: string;
  name: string;
  code: string;
  locationType: string;
  isActive: boolean;

  canReceive: boolean;
  canIssue: boolean;
  canSell: boolean;
  canProduce: boolean;
  canAdjust: boolean;

  canRequestFrom: boolean;
  canReceiveTo: boolean;
  canConsumeFrom: boolean;
  canSellFrom: boolean;
  canTransferFrom: boolean;
  canTransferTo: boolean;

  isDefaultIssueSource: boolean;
  isDefaultReceivingTarget: boolean;
  isDefaultConsumptionLocation: boolean;
  isDefaultSalesLocation: boolean;

  isMainWarehouse: boolean;
  canReceiveGrn: boolean;
  isProductionCenter: boolean;
  isConsumptionLocation: boolean;
};

const PAGE_SIZE = 500;
const DEFAULT_TYPE = "Warehouse" as unknown as StockLocationType;

const DEFAULT_FORM: LocationForm = {
  name: "",
  code: "",
  locationType: DEFAULT_TYPE,
  isActive: true,
  canReceive: true,
  canIssue: true,
  canSell: false,
  canProduce: false,
  canAdjust: true,
  isConsumptionLocation: false,
  isMainWarehouse: true,
  canReceiveGrn: true,
  isProductionCenter: false,
};

const TYPE_OPTIONS = LOCATION_TYPES.map((x) => ({
  value: String((x as any).value ?? x),
  label: String((x as any).label ?? x),
}));

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeId(value: unknown): string {
  const id = text(value);
  if (!id || id === "00000000-0000-0000-0000-000000000000") return "";
  return id;
}

function stockLocationIdOf(value: any): string {
  return normalizeId(
    value?.stockLocationId ??
      value?.StockLocationId ??
      value?.locationId ??
      value?.LocationId ??
      value?.stockLocation?.id ??
      value?.StockLocation?.Id,
  );
}

function branchStockLocationIdOf(value: any): string {
  const explicit = normalizeId(
    value?.branchStockLocationId ??
      value?.BranchStockLocationId ??
      value?.assignmentId ??
      value?.AssignmentId ??
      value?.branchLocationId ??
      value?.BranchLocationId,
  );

  if (explicit) return explicit;

  // Branch assignment APIs commonly return the assignment id as `id` and the
  // company stock-location id as `stockLocationId`. In that shape, `id` is the
  // value the inventory-configuration API must save.
  const rawId = normalizeId(value?.id ?? value?.Id);
  const stockId = normalizeId(value?.stockLocationId ?? value?.StockLocationId);

  if (rawId && stockId && rawId !== stockId) return rawId;

  // Last-resort fallback keeps the UI usable for older endpoints. The backend
  // should still be updated to return branchStockLocationId explicitly.
  return rawId;
}

function nameOf(value: any): string {
  return text(
    value?.name ??
      value?.Name ??
      value?.stockLocationName ??
      value?.StockLocationName ??
      value?.locationName ??
      value?.LocationName,
  );
}

function codeOf(value: any): string {
  return text(value?.code ?? value?.Code ?? value?.stockLocationCode ?? value?.StockLocationCode).toUpperCase();
}

function activeOf(value: any): boolean {
  return value?.isActive !== false && value?.IsActive !== false && value?.active !== false;
}

function activeBranchAssignments(rows: StockLocation[]): StockLocation[] {
  return Array.isArray(rows) ? rows.filter(activeOf) : [];
}

function branchEligibleLocations(rows: StockLocation[], hasSalesOperations: boolean): StockLocation[] {
  return hasSalesOperations ? rows : rows.filter(x => !boolOf(x, ["canSell"]));
}

function boolOf(value: any, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    const pascal = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const raw = value?.[key] ?? value?.[pascal];
    if (raw === true) return true;
    if (raw === false) return false;
  }

  return fallback;
}

function typeOf(value: any): StockLocationType {
  return String(value?.locationType ?? value?.LocationType ?? value?.type ?? value?.Type ?? DEFAULT_TYPE) as any;
}

function norm(value: unknown): string {
  return String(value ?? "").replace(/[\s_-]+/g, "").toLowerCase();
}

function isWaste(type: unknown): boolean {
  return norm(type) === "waste";
}

function isTransit(type: unknown): boolean {
  return norm(type) === "transit";
}

function isProduction(type: unknown): boolean {
  return norm(type).includes("production");
}

function isWarehouse(type: unknown): boolean {
  const t = norm(type);
  return t.includes("warehouse") || t.includes("mainstore") || t.includes("store");
}

function isKitchenBarOrPos(type: unknown): boolean {
  const t = norm(type);
  return t.includes("kitchen") || t.includes("bar") || t.includes("retail") || t.includes("pos");
}

function defaultCaps(type: StockLocationType): Partial<LocationForm> {
  const t = norm(type);

  if (isWarehouse(t)) {
    return {
      canReceive: true,
      canIssue: true,
      canSell: false,
      canProduce: false,
      canAdjust: true,
      isConsumptionLocation: false,
      isMainWarehouse: true,
      canReceiveGrn: true,
      isProductionCenter: false,
    };
  }

  if (isProduction(t)) {
    return {
      canReceive: true,
      canIssue: true,
      canSell: false,
      canProduce: true,
      canAdjust: true,
      isConsumptionLocation: false,
      isMainWarehouse: false,
      canReceiveGrn: false,
      isProductionCenter: true,
    };
  }

  if (isKitchenBarOrPos(t)) {
    return {
      canReceive: true,
      canIssue: true,
      canSell: t.includes("bar") || t.includes("retail") || t.includes("pos"),
      canProduce: false,
      canAdjust: true,
      isConsumptionLocation: true,
      isMainWarehouse: false,
      canReceiveGrn: false,
      isProductionCenter: false,
    };
  }

  if (isWaste(t)) {
    return {
      canReceive: true,
      canIssue: false,
      canSell: false,
      canProduce: false,
      canAdjust: true,
      isConsumptionLocation: false,
      isMainWarehouse: false,
      canReceiveGrn: false,
      isProductionCenter: false,
    };
  }

  return {
    canReceive: false,
    canIssue: false,
    canSell: false,
    canProduce: false,
    canAdjust: false,
    isConsumptionLocation: false,
    isMainWarehouse: false,
    canReceiveGrn: false,
    isProductionCenter: false,
  };
}

function formFromLocation(location: StockLocation): LocationForm {
  const x = location as any;
  const locationType = typeOf(x);
  const caps = defaultCaps(locationType);

  const canReceive = boolOf(x, ["canReceive"], caps.canReceive ?? false);
  const canIssue = boolOf(x, ["canIssue"], caps.canIssue ?? false);
  const canSell = boolOf(x, ["canSell"], caps.canSell ?? false);
  const canProduce = boolOf(x, ["canProduce"], caps.canProduce ?? false);
  const canAdjust = boolOf(x, ["canAdjust"], caps.canAdjust ?? false);

  return {
    name: nameOf(x),
    code: codeOf(x),
    locationType,
    isActive: activeOf(x),
    canReceive,
    canIssue,
    canSell,
    canProduce,
    canAdjust,
    isConsumptionLocation: boolOf(
      x,
      ["isConsumptionLocation", "canConsume", "isDefaultConsumptionLocation"],
      caps.isConsumptionLocation ?? false,
    ),
    isMainWarehouse: boolOf(
      x,
      ["isMainWarehouse", "isMainWarehouseForProduction", "isDefaultIssueSource"],
      caps.isMainWarehouse ?? false,
    ),
    canReceiveGrn: boolOf(
      x,
      ["canReceiveGrn", "isDefaultReceiving", "isDefaultReceivingTarget"],
      caps.canReceiveGrn ?? false,
    ),
    isProductionCenter: boolOf(
      x,
      ["isProductionCenter", "isProductionLocation"],
      caps.isProductionCenter ?? false,
    ),
  };
}

function applyTypeDefaults(current: LocationForm, type: StockLocationType): LocationForm {
  return {
    ...current,
    locationType: type,
    ...defaultCaps(type),
  };
}

function validateLocation(form: LocationForm, setErrors: (e: FieldErrors) => void) {
  const errors: FieldErrors = {};

  if (!form.name.trim()) errors.name = "Location name is required.";
  if (!form.code.trim()) errors.code = "Location code is required.";
  if (!String(form.locationType).trim()) errors.locationType = "Location type is required.";

  if (!form.canReceive && !form.canIssue && !form.canSell && !form.canProduce && !form.canAdjust) {
    errors.capabilities = "At least one capability is required.";
  }

  if (form.isMainWarehouse && (!form.canReceive || !form.canIssue)) {
    errors.isMainWarehouse = "Main warehouse must be able to receive and issue.";
  }

  if (form.canReceiveGrn && !form.canReceive) {
    errors.canReceiveGrn = "GRN receiving location must be able to receive.";
  }

  if (form.isProductionCenter && !form.canProduce) {
    errors.isProductionCenter = "Production center must be able to produce.";
  }

  if (form.isConsumptionLocation && !form.canIssue) {
    errors.isConsumptionLocation = "Consumption location must be able to issue/consume.";
  }

  if (isWaste(form.locationType) && (form.canIssue || form.canSell || form.canProduce)) {
    errors.locationType = "Waste location can receive only. It cannot issue, sell, or produce.";
  }

  if (isTransit(form.locationType) && (form.canSell || form.canProduce)) {
    errors.locationType = "Transit location cannot sell or produce.";
  }

  setErrors(errors);
  return Object.keys(errors).length === 0;
}

function locationPayload(form: LocationForm): CreateStockLocationDto {
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    locationType: form.locationType,
    isActive: form.isActive,

    canReceive: form.canReceive,
    canIssue: form.canIssue,
    canSell: form.canSell,
    canProduce: form.canProduce,
    canAdjust: form.canAdjust,

    isDefault: form.isMainWarehouse,
    isDefaultReceiving: form.canReceiveGrn || form.isMainWarehouse,
    isDefaultIssue: form.isMainWarehouse,

    isMainWarehouse: form.isMainWarehouse,
    canReceiveGrn: form.canReceiveGrn,
    isProductionCenter: form.isProductionCenter,
    isConsumptionLocation: form.isConsumptionLocation,
  } as any;
}

function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function unique<T>(items: T[], key: (x: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    if (id && !map.has(id)) map.set(id, item);
  }
  return [...map.values()];
}

function toAssignmentOption(location: StockLocation): BranchAssignmentOption {
  const x = location as any;
  const locationType = String(x.locationType ?? x.LocationType ?? x.type ?? x.Type ?? "");

  const caps = defaultCaps(locationType as any);

  const canReceive = boolOf(x, ["canReceive"], caps.canReceive ?? false);
  const canIssue = boolOf(x, ["canIssue"], caps.canIssue ?? false);
  const canSell = boolOf(x, ["canSell"], caps.canSell ?? false);
  const canProduce = boolOf(x, ["canProduce"], caps.canProduce ?? false);
  const canAdjust = boolOf(x, ["canAdjust"], caps.canAdjust ?? false);

  const isMainWarehouse = boolOf(
    x,
    ["isMainWarehouse", "isMainWarehouseForProduction", "isDefaultIssueSource"],
    caps.isMainWarehouse ?? false,
  );
  const canReceiveGrn = boolOf(
    x,
    ["canReceiveGrn", "isDefaultReceiving", "isDefaultReceivingTarget"],
    caps.canReceiveGrn ?? false,
  );
  const isProductionCenter = boolOf(
    x,
    ["isProductionCenter", "isProductionLocation"],
    caps.isProductionCenter ?? false,
  );
  const isConsumptionLocation = boolOf(
    x,
    ["isConsumptionLocation", "canConsume", "isDefaultConsumptionLocation"],
    caps.isConsumptionLocation ?? false,
  );

  const canTransferFrom = boolOf(x, ["canTransferFrom"], canIssue);
  const canTransferTo = boolOf(x, ["canTransferTo"], canReceive);
  const canRequestFrom = boolOf(x, ["canRequestFrom"], canIssue || canTransferFrom);
  const canReceiveTo = boolOf(x, ["canReceiveTo"], canReceive || canTransferTo);
  const canConsumeFrom = boolOf(x, ["canConsumeFrom"], canIssue && isConsumptionLocation);
  const canSellFrom = boolOf(x, ["canSellFrom"], canSell);

     return {
      branchStockLocationId: branchStockLocationIdOf(x),
      stockLocationId: stockLocationIdOf(x),
      name: nameOf(x),
      code: codeOf(x),
      locationType,
      isActive: activeOf(x),

      canReceive,
      canIssue,
      canSell,
      canProduce,
      canAdjust,

      canRequestFrom,
      canReceiveTo,
      canConsumeFrom,
      canSellFrom,
      canTransferFrom,
      canTransferTo,

      isDefaultIssueSource: boolOf(x, ["isDefaultIssueSource", "isDefaultIssue"], isMainWarehouse),
      isDefaultReceivingTarget: boolOf(
        x,
        ["isDefaultReceivingTarget", "isDefaultReceiving"],
        canReceiveGrn || isMainWarehouse,
      ),
      isDefaultConsumptionLocation: boolOf(
        x,
        ["isDefaultConsumptionLocation"],
        isConsumptionLocation,
      ),
      isDefaultSalesLocation: boolOf(x, ["isDefaultSalesLocation"], canSell),

      isMainWarehouse,
      canReceiveGrn,
      isProductionCenter,
      isConsumptionLocation,
    };
}


function optionLabel(x: BranchAssignmentOption): string {
  const label = x.name || x.code || x.stockLocationId || x.branchStockLocationId;
  return `${label}${x.code && x.name ? ` (${x.code})` : ""}`;
}

function isReceivingOption(x: BranchAssignmentOption): boolean {
  return (
    x.isActive &&
    x.canReceive &&
    x.canReceiveTo &&
    (x.canReceiveGrn || x.isDefaultReceivingTarget || x.isMainWarehouse || isWarehouse(x.locationType)) &&
    !isWaste(x.locationType) &&
    !isTransit(x.locationType)
  );
}

function isIssueOption(x: BranchAssignmentOption): boolean {
  return (
    x.isActive &&
    x.canIssue &&
    x.canRequestFrom &&
    (x.isMainWarehouse || x.isDefaultIssueSource || isWarehouse(x.locationType)) &&
    !x.isConsumptionLocation &&
    !x.isProductionCenter &&
    !isWaste(x.locationType) &&
    !isTransit(x.locationType)
  );
}

function isProductionOption(x: BranchAssignmentOption): boolean {
  return (
    x.isActive &&
    x.canProduce &&
    x.isProductionCenter &&
    !x.isMainWarehouse &&
    !x.isConsumptionLocation &&
    !isWaste(x.locationType) &&
    !isTransit(x.locationType)
  );
}

function isConsumptionOption(x: BranchAssignmentOption): boolean {
  return (
    x.isActive &&
    x.canIssue &&
    x.canConsumeFrom &&
    x.isConsumptionLocation &&
    !x.isMainWarehouse &&
    !x.isProductionCenter &&
    !x.canReceiveGrn &&
    !isWaste(x.locationType) &&
    !isTransit(x.locationType)
  );
}

function isAdjustmentOption(x: BranchAssignmentOption): boolean {
  return x.isActive && x.canAdjust && !isTransit(x.locationType);
}

function keepCurrentIfStillValid(
  currentId: string | null | undefined,
  options: BranchAssignmentOption[],
): string | null {
  if (currentId && options.some((x) => x.branchStockLocationId === currentId)) return currentId;
  return options[0]?.branchStockLocationId ?? null;
}

const Check = memo(function Check(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  help?: string;
}) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
        style={{ marginTop: 2 }}
      />
      <span>
        {props.label}
        {props.help && (
          <span style={{ display: "block", color: "#64748b", fontWeight: 500, marginTop: 2 }}>
            {props.help}
          </span>
        )}
      </span>
    </label>
  );
});

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

const LocationFormView = memo(function LocationFormView(props: {
  form: LocationForm;
  errors: FieldErrors;
  onChange: React.Dispatch<React.SetStateAction<LocationForm>>;
}) {
  const f = props.form;

  const set = useCallback(
    (patch: Partial<LocationForm>) => props.onChange((current) => ({ ...current, ...patch })),
    [props.onChange],
  );

  return (
    <>
      {Object.values(props.errors)
        .filter(Boolean)
        .map((message) => (
          <Alert key={message} tone="danger" title="Validation" message={message!} />
        ))}

      <div className="ob-grid-2">
        <Field label="Location name" required error={props.errors.name}>
          <Input value={f.name} onChange={(v) => set({ name: v })} placeholder="Main Warehouse" />
        </Field>

        <Field label="Code" required error={props.errors.code}>
          <Input value={f.code} onChange={(v) => set({ code: v.toUpperCase() })} placeholder="MAIN-WH" />
        </Field>

        <Field label="Location type" required error={props.errors.locationType}>
          <SelectInput
            value={String(f.locationType)}
            onChange={(v) => props.onChange((current) => applyTypeDefaults(current, v as any))}
            options={TYPE_OPTIONS as any}
          />
        </Field>
      </div>

      <SectionTitle
        title="ERP capabilities"
        subtitle="These flags control GRN, SIV, POS, production, transfer, consumption, and stock adjustment behavior."
      />

      <div className="ob-grid-2">
        <Check label="Can receive" checked={f.canReceive} onChange={(v) => set({ canReceive: v })} />
        <Check
          label="Can issue"
          checked={f.canIssue}
          onChange={(v) =>
            set({
              canIssue: v,
              isConsumptionLocation: v ? f.isConsumptionLocation : false,
              isMainWarehouse: v && f.canReceive ? f.isMainWarehouse : false,
            })
          }
        />
        <Check label="Can sell" checked={f.canSell} onChange={(v) => set({ canSell: v })} />
        <Check
          label="Can adjust"
          checked={f.canAdjust}
          onChange={(v) => set({ canAdjust: v })}
          help="Allows stock count, waste, damage, variance, and manual inventory adjustment documents."
        />
        <Check label="Can produce" checked={f.canProduce} onChange={(v) => set({ canProduce: v })} />
        <Check label="Active" checked={f.isActive} onChange={(v) => set({ isActive: v })} />

        <Check
          label="Main warehouse / issue source"
          checked={f.isMainWarehouse}
          disabled={!f.canReceive || !f.canIssue}
          help="Primary receiving and issue source. Used as Default Issue."
          onChange={(v) =>
            set({
              isMainWarehouse: v,
              canReceive: v ? true : f.canReceive,
              canIssue: v ? true : f.canIssue,
              canReceiveGrn: v ? true : f.canReceiveGrn,
              isConsumptionLocation: v ? false : f.isConsumptionLocation,
              isProductionCenter: v ? false : f.isProductionCenter,
            })
          }
        />

        <Check
          label="GRN receiving target"
          checked={f.canReceiveGrn}
          disabled={!f.canReceive}
          help="Allowed as default receiving location for supplier receipts."
          onChange={(v) => set({ canReceiveGrn: v, canReceive: v ? true : f.canReceive })}
        />

        <Check
          label="Production center"
          checked={f.isProductionCenter}
          disabled={!f.canProduce}
          help="Used for production output, not normal consumption."
          onChange={(v) =>
            set({
              isProductionCenter: v,
              canProduce: v ? true : f.canProduce,
              isMainWarehouse: v ? false : f.isMainWarehouse,
              isConsumptionLocation: v ? false : f.isConsumptionLocation,
            })
          }
        />

        <Check
          label="Consumption location"
          checked={f.isConsumptionLocation}
          disabled={!f.canIssue || f.isMainWarehouse || f.isProductionCenter}
          help="Kitchen, Bar, or POS consumption destination."
          onChange={(v) =>
            set({
              isConsumptionLocation: v,
              canIssue: v ? true : f.canIssue,
              isMainWarehouse: v ? false : f.isMainWarehouse,
              isProductionCenter: v ? false : f.isProductionCenter,
              canReceiveGrn: v ? false : f.canReceiveGrn,
            })
          }
        />
      </div>
    </>
  );
});

function SelectConfigField(props: {
  label: string;
  value?: string | null;
  options: BranchAssignmentOption[];
  disabled?: boolean;
  onChange: (id: string | null) => void;
  hint?: string;
}) {
  return (
    <Field label={props.label}>
      <SelectInput
        value={props.value ?? ""}
        disabled={props.disabled}
        onChange={(v) => props.onChange(v ? String(v) : null)}
        options={[
          { value: "", label: "Not configured" },
          ...props.options.map((x) => ({
            value: x.branchStockLocationId,
            label: optionLabel(x),
          })),
        ]}
      />
      {props.hint && <div style={{ color: "#64748b", fontSize: 11, marginTop: 6 }}>{props.hint}</div>}
    </Field>
  );
}

function InventoryConfigurationPanel(props: {
  companyId: string | null;
  branchId: string | null;
  branchAssignments: StockLocation[];
  config: BranchInventoryConfigurationDto | null;
  saving: boolean;
  dispatch: React.Dispatch<OnboardingAction>;
  onSaved: () => Promise<void>;
}) {
  const options = useMemo(
    () =>
      unique(props.branchAssignments.map(toAssignmentOption), (x) => x.branchStockLocationId)
        .filter((x) => x.branchStockLocationId && x.isActive)
        .sort((a, b) => optionLabel(a).localeCompare(optionLabel(b))),
    [props.branchAssignments],
  );

  const receivingOptions = useMemo(() => options.filter(isReceivingOption), [options]);
  const issueOptions = useMemo(() => options.filter(isIssueOption), [options]);
  const productionOptions = useMemo(() => options.filter(isProductionOption), [options]);
  const consumptionOptions = useMemo(() => options.filter(isConsumptionOption), [options]);
  const adjustmentOptions = useMemo(() => options.filter(isAdjustmentOption), [options]);

  const [form, setForm] = useState<UpsertBranchInventoryConfigurationDto>({
    defaultReceivingBranchStockLocationId: null,
    defaultIssueBranchStockLocationId: null,
    productionBranchStockLocationId: null,
    consumptionBranchStockLocationId: null,
  });

  useEffect(() => {
    setForm({
      defaultReceivingBranchStockLocationId:
        props.config?.defaultReceivingBranchStockLocationId ?? null,
      defaultIssueBranchStockLocationId:
        props.config?.defaultIssueBranchStockLocationId ?? null,
      productionBranchStockLocationId:
        props.config?.productionBranchStockLocationId ?? null,
      consumptionBranchStockLocationId:
        props.config?.consumptionBranchStockLocationId ?? null,
    });
  }, [props.config]);

  useEffect(() => {
    setForm((current) => ({
      defaultReceivingBranchStockLocationId: keepCurrentIfStillValid(
        current.defaultReceivingBranchStockLocationId,
        receivingOptions,
      ),
      defaultIssueBranchStockLocationId: keepCurrentIfStillValid(
        current.defaultIssueBranchStockLocationId,
        issueOptions,
      ),
      productionBranchStockLocationId:
        current.productionBranchStockLocationId &&
        productionOptions.some((x) => x.branchStockLocationId === current.productionBranchStockLocationId)
          ? current.productionBranchStockLocationId
          : productionOptions[0]?.branchStockLocationId ?? null,
      consumptionBranchStockLocationId: keepCurrentIfStillValid(
        current.consumptionBranchStockLocationId,
        consumptionOptions,
      ),
    }));
  }, [receivingOptions, issueOptions, productionOptions, consumptionOptions]);

  const validation = useMemo(() => {
    const errors: string[] = [];

    const receiving = options.find(
      (x) => x.branchStockLocationId === form.defaultReceivingBranchStockLocationId,
    );
    const issue = options.find((x) => x.branchStockLocationId === form.defaultIssueBranchStockLocationId);
    const production = options.find(
      (x) => x.branchStockLocationId === form.productionBranchStockLocationId,
    );
    const consumption = options.find(
      (x) => x.branchStockLocationId === form.consumptionBranchStockLocationId,
    );

    if (!receiving) errors.push("Default receiving location is required.");
    else if (!isReceivingOption(receiving)) {
      errors.push("Default receiving must be a warehouse/GRN receiving target.");
    }

    if (!issue) errors.push("Default issue location is required.");
    else if (!isIssueOption(issue)) {
      errors.push("Default issue must be Main Warehouse or a warehouse issue source.");
    }

    if (production && !isProductionOption(production)) {
      errors.push("Production location must be a production center.");
    }

    if (!consumption) errors.push("Consumption location is required.");
    else if (!isConsumptionOption(consumption)) {
      errors.push("Consumption location must be Kitchen, Bar, or POS consumption location.");
    }

    if (issue && consumption && issue.branchStockLocationId === consumption.branchStockLocationId) {
      errors.push("Default issue and consumption locations cannot be the same.");
    }

    if (adjustmentOptions.length === 0) {
      errors.push("At least one branch stock location must allow stock adjustment.");
    }

    return errors;
  }, [form, options, adjustmentOptions.length]);

  const save = useCallback(async () => {
    if (!props.companyId || !props.branchId) return;

    if (validation.length > 0) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: validation.join(" "),
      });
      return;
    }

    props.dispatch({ type: "SAVE_START" });

    try {
      await stockLocationsApi.configuration.save(props.companyId, props.branchId, form);
      await props.onSaved();
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Branch inventory configuration saved." });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to save branch inventory configuration."),
      });
    }
  }, [form, props, validation]);

  const disabled = props.saving || !props.companyId || !props.branchId || options.length === 0;

  return (
    <div className="ob-inner-card">
      <div className="ob-inner-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionTitle
          title="Branch inventory configuration"
          subtitle="ERP defaults are saved against branch stock-location assignments. Invalid flows are blocked."
        />

        {options.length === 0 && (
          <Alert
            tone="warn"
            title="No branch assignments"
            message="Assign stock locations to the branch before setting inventory defaults."
          />
        )}

        {options.length > 0 && validation.length > 0 && (
          <Alert tone="warn" title="Configuration needs attention" message={validation.join(" ")} />
        )}

        {options.length > 0 && adjustmentOptions.length > 0 && (
          <Alert
            tone="success"
            title="Adjustment locations configured"
            message={`${adjustmentOptions.length} branch location${adjustmentOptions.length === 1 ? "" : "s"} can be used for stock adjustments.`}
          />
        )}

        <div className="ob-grid-2">
          <SelectConfigField
            label="Default receiving"
            value={form.defaultReceivingBranchStockLocationId}
            options={receivingOptions}
            disabled={disabled}
            hint="Normally Main Warehouse. Used for GRN receiving."
            onChange={(id) => setForm((x) => ({ ...x, defaultReceivingBranchStockLocationId: id }))}
          />

          <SelectConfigField
            label="Default issue"
            value={form.defaultIssueBranchStockLocationId}
            options={issueOptions}
            disabled={disabled}
            hint="Must be Main Warehouse / issue source. Kitchen/POS are blocked."
            onChange={(id) => setForm((x) => ({ ...x, defaultIssueBranchStockLocationId: id }))}
          />

          <SelectConfigField
            label="Production location"
            value={form.productionBranchStockLocationId}
            options={productionOptions}
            disabled={disabled}
            hint="Used only for production output. Optional if this branch does not produce items."
            onChange={(id) => setForm((x) => ({ ...x, productionBranchStockLocationId: id }))}
          />

          <SelectConfigField
            label="Consumption location"
            value={form.consumptionBranchStockLocationId}
            options={consumptionOptions}
            disabled={disabled}
            hint="Kitchen, Bar, or POS. Used as SIV/recipe consumption destination."
            onChange={(id) => setForm((x) => ({ ...x, consumptionBranchStockLocationId: id }))}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="primary" disabled={disabled || validation.length > 0} onClick={() => void save()}>
            Save configuration
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function StockLocationsStep(props: Props) {
  const [companyLocations, setCompanyLocations] = useState<StockLocation[]>([]);
  const [branchLocations, setBranchLocations] = useState<StockLocation[]>([]);
  const [config, setConfig] = useState<BranchInventoryConfigurationDto | null>(null);

  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LocationForm>({ ...DEFAULT_FORM });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editSaving, setEditSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<LocationForm>({ ...DEFAULT_FORM });
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createSaving, setCreateSaving] = useState(false);

  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const canManage = Boolean(props.companyId && props.branchId);

  const dirtyAssignments = useMemo(
    () => !sameSet(assignedIds, originalAssignedIds),
    [assignedIds, originalAssignedIds],
  );

  const branchAssignmentOptions = useMemo(
    () => branchLocations.map(toAssignmentOption).filter((x) => x.branchStockLocationId),
    [branchLocations],
  );

  const hasReceiving = branchAssignmentOptions.some(isReceivingOption);
  const hasIssue = branchAssignmentOptions.some(isIssueOption);
  const hasConsumption = branchAssignmentOptions.some(isConsumptionOption);
  const hasAdjustment = branchAssignmentOptions.some(isAdjustmentOption);

  const fetchData = useCallback(async () => {
    if (!props.companyId || !props.branchId) {
      setCompanyLocations([]);
      setBranchLocations([]);
      setAssignedIds(new Set());
      setOriginalAssignedIds(new Set());
      setConfig(null);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [companyRows, branchRows, branchConfig] = await Promise.all([
        stockLocationsApi.company.list(props.companyId, {
          activeOnly: false,
          page: 1,
          pageSize: PAGE_SIZE,
        }),
        stockLocationsApi.branchAssignments.list(props.companyId, props.branchId, {
          activeOnly: false,
          page: 1,
          pageSize: PAGE_SIZE,
        }),
        stockLocationsApi.configuration.get(props.companyId, props.branchId),
      ]);

      const safeCompanyRows = Array.isArray(companyRows) ? companyRows : [];
      const safeBranchRows = branchEligibleLocations(activeBranchAssignments(branchRows), props.hasSalesOperations !== false);

      const branchAssignedStockLocationIds = new Set(
        safeBranchRows.map(stockLocationIdOf).filter(Boolean),
      );

      setCompanyLocations(safeCompanyRows);
      setBranchLocations(safeBranchRows);
      setAssignedIds(branchAssignedStockLocationIds);
      setOriginalAssignedIds(new Set(branchAssignedStockLocationIds));
      setConfig(branchConfig);
    } catch (err) {
      setCompanyLocations([]);
      setBranchLocations([]);
      setAssignedIds(new Set());
      setOriginalAssignedIds(new Set());
      setConfig(null);
      setLoadError(extractApiError(err, "Failed to load stock locations."));
    } finally {
      setLoading(false);
    }
  }, [props.companyId, props.branchId, props.hasSalesOperations]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loading && canManage && companyLocations.length === 0) setShowCreate(true);
  }, [loading, canManage, companyLocations.length]);

  const setAssigned = useCallback((id: string, value: boolean) => {
    setAssignedIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const saveAssignments = useCallback(async () => {
    if (!props.companyId || !props.branchId) return;

    setAssignmentSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      await stockLocationsApi.branchAssignments.assignMany(props.companyId, props.branchId, {
        stockLocationIds: [...assignedIds],
      });

      await fetchData();
      await props.onChanged?.();

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "Branch stock-location assignments saved.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to save branch stock-location assignments."),
      });
    } finally {
      setAssignmentSaving(false);
    }
  }, [assignedIds, fetchData, props]);

  const createLocation = useCallback(async () => {
    if (!props.companyId || !props.branchId || !validateLocation(createForm, setCreateErrors)) return;

    if (props.hasSalesOperations === false && createForm.canSell) {
      setCreateErrors({ canSell: "Sales locations cannot be assigned to a branch with sales disabled." });
      return;
    }

    setCreateSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      const created = await stockLocationsApi.company.create(props.companyId, locationPayload(createForm));
      const createdId = stockLocationIdOf(created);

      if (createdId) {
        await stockLocationsApi.branchAssignments.assignOne(props.companyId, props.branchId, createdId);
      }

      await fetchData();
      await props.onChanged?.();

      setCreateForm({ ...DEFAULT_FORM });
      setCreateErrors({});
      setShowCreate(false);

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "Stock location created and assigned to branch.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to create stock location."),
      });
    } finally {
      setCreateSaving(false);
    }
  }, [createForm, fetchData, props]);

  const saveLocation = useCallback(
    async (id: string) => {
      if (!props.companyId || !validateLocation(editForm, setEditErrors)) return;

      if (props.hasSalesOperations === false && assignedIds.has(id) && editForm.canSell) {
        setEditErrors({ canSell: "Sales locations cannot be assigned to a branch with sales disabled." });
        return;
      }

      setEditSaving(true);
      props.dispatch({ type: "SAVE_START" });

      try {
        await stockLocationsApi.company.update(props.companyId, id, locationPayload(editForm) as any);

        if (props.branchId && assignedIds.has(id)) {
          await stockLocationsApi.branchAssignments.assignOne(props.companyId, props.branchId, id);
        }

        await fetchData();
        await props.onChanged?.();

        setExpandedId(null);

        props.dispatch({
          type: "SAVE_SUCCESS",
          notice: "Stock location updated.",
        });
      } catch (err) {
        props.dispatch({
          type: "SAVE_ERROR",
          error: extractApiError(err, "Failed to update stock location."),
        });
      } finally {
        setEditSaving(false);
      }
    },
    [assignedIds, editForm, fetchData, props],
  );

  const sortedCompanyLocations = useMemo(
    () =>
      [...branchEligibleLocations(companyLocations, props.hasSalesOperations !== false)].sort(
        (a, b) =>
          Number(!assignedIds.has(stockLocationIdOf(a))) - Number(!assignedIds.has(stockLocationIdOf(b))) ||
          nameOf(a).localeCompare(nameOf(b)),
      ),
    [companyLocations, assignedIds, props.hasSalesOperations],
  );

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "24px 0", color: "#64748b" }}>
        <Spinner /> Loading stock locations...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!canManage && (
        <Alert
          tone="warn"
          title="Select branch first"
          message="Stock locations are company-owned, then assigned to a branch."
        />
      )}

      {loadError && <Alert tone="danger" title="Unable to load stock locations" message={loadError} />}

      {canManage && (
        <div className="ob-grid-3">
          <Summary label="Company locations" value={companyLocations.length} />
          <Summary label="Assigned to branch" value={assignedIds.size} />
          <Summary label="ERP ready" value={hasReceiving && hasIssue && hasConsumption && hasAdjustment ? "Yes" : "No"} />
        </div>
      )}

      {canManage && (!hasReceiving || !hasIssue || !hasConsumption || !hasAdjustment) && (
        <Alert
          tone="warn"
          title="Branch inventory setup incomplete"
          message="Branch needs receiving, warehouse issue source, consumption location, and at least one stock-adjustment-enabled location before ERP inventory workflows can work correctly."
        />
      )}

      {canManage && (
        <div className="ob-inner-card">
          <div
            className="ob-inner-card-body"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>Branch stock-location assignments</strong>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {assignedIds.size} selected for {props.branchName ?? "this branch"}.
              </div>
            </div>

            <Btn
              variant="primary"
              disabled={!dirtyAssignments || assignmentSaving || props.saving}
              onClick={() => void saveAssignments()}
            >
              {assignmentSaving ? "Saving..." : "Save assignments"}
            </Btn>
          </div>
        </div>
      )}

      {sortedCompanyLocations.length === 0 && (
        <EmptyState title="No stock locations" sub="Create a company stock location and assign it to this branch." />
      )}

      {sortedCompanyLocations.map((location) => {
        const id = stockLocationIdOf(location);
        const form = formFromLocation(location);
        const assigned = assignedIds.has(id);
        const expanded = expandedId === id;

        return (
          <div key={id} className="ob-inner-card" style={{ borderColor: assigned ? "#22c55e" : undefined }}>
            <div
              className="ob-inner-card-body"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <input
                type="checkbox"
                aria-label={`Assign ${form.name} to ${props.branchName ?? "this branch"}`}
                checked={assigned}
                onChange={(e) => setAssigned(id, e.target.checked)}
                disabled={!canManage || assignmentSaving || props.saving || !form.isActive}
              />

              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <strong>{form.name}</strong>
                  <span className="ob-badge">{form.code}</span>
                  <span className="ob-badge">{String(form.locationType)}</span>
                  {assigned && <span className="ob-badge ob-badge--success">Assigned</span>}
                  {form.isMainWarehouse && <span className="ob-badge ob-badge--info">Issue source</span>}
                  {form.canReceiveGrn && <span className="ob-badge ob-badge--info">GRN receiving</span>}
                  {form.isProductionCenter && <span className="ob-badge ob-badge--info">Production</span>}
                  {form.isConsumptionLocation && <span className="ob-badge ob-badge--info">Consumption</span>}
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {form.canReceive && <span className="ob-badge ob-badge--success">Receive</span>}
                  {form.canIssue && <span className="ob-badge ob-badge--success">Issue</span>}
                  {form.canSell && <span className="ob-badge ob-badge--success">Sell</span>}
                  {form.canProduce && <span className="ob-badge ob-badge--success">Produce</span>}
                  {form.canAdjust && <span className="ob-badge ob-badge--success">Adjust</span>}
                </div>
              </div>

              <Btn
                variant="ghost"
                onClick={() => {
                  setExpandedId(expanded ? null : id);
                  setEditForm(form);
                  setEditErrors({});
                }}
              >
                {expanded ? "Close" : "Configure"}
              </Btn>
            </div>

            {expanded && (
              <div
                className="ob-inner-card-body"
                style={{
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <LocationFormView form={editForm} errors={editErrors} onChange={setEditForm} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Btn variant="primary" disabled={editSaving || props.saving} onClick={() => void saveLocation(id)}>
                    {editSaving ? "Saving..." : "Save location"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <InventoryConfigurationPanel
        companyId={props.companyId}
        branchId={props.branchId}
        branchAssignments={branchLocations}
        config={config}
        saving={props.saving}
        dispatch={props.dispatch}
        onSaved={async () => {
          await fetchData();
          await props.onChanged?.();
        }}
      />

      <div className="ob-inner-card">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          style={{
            width: "100%",
            padding: 14,
            background: "transparent",
            border: "none",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <strong>{showCreate ? "Close stock-location form" : "+ Create stock location"}</strong>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
            Creates a company-owned stock location and assigns it to the current branch.
          </div>
        </button>

        {showCreate && (
          <div className="ob-inner-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LocationFormView form={createForm} errors={createErrors} onChange={setCreateForm} />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="primary" disabled={!canManage || createSaving || props.saving} onClick={() => void createLocation()}>
                {createSaving ? "Creating..." : "Create and assign"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
