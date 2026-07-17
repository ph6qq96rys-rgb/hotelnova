// src/modules/company/pages/Createbranchuserform.tsx

import type {
  BranchRole,
  CreateBranchUserFormValue,
} from "../types/company.types";

import { Field, Input, SelectInput } from "./components/company.ui";

type LocationOption = {
  id: string;
  name: string;
  code?: string | null;
  locationType?: string | null;
};

interface Props {
  value: CreateBranchUserFormValue & {
    roleNames?: string[];
    branchIds?: string[];
    stockLocationIds?: string[];
    defaultBranchId?: string | null;
    defaultStockLocationId?: string | null;
    canReceive?: boolean;
    canIssue?: boolean;
    canTransfer?: boolean;
    canSell?: boolean;
    canAdjust?: boolean;
  };
  onChange: (v: Props["value"]) => void;
  onSubmit: () => void;
  busy?: boolean;
  error?: string | null;

  branchId?: string | null;
  branchName?: string | null;
  stockLocations?: LocationOption[];
}

const ROLE_OPTIONS: { value: BranchRole; label: string; description: string }[] =
  [
    {
      value: "BranchAdmin",
      label: "Branch Admin",
      description: "Can manage branch users, sales, inventory, and operations.",
    },
    {
      value: "Staff",
      label: "Staff",
      description: "Standard branch user with limited operational access.",
    },
  ];

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter(Boolean).map(String).map((x) => x.trim()))]
    .filter(Boolean);
}

function roleNamesFor(role: BranchRole): string[] {
  switch (role) {
    case "BranchAdmin":
      return ["BranchAdmin"];
    case "Staff":
    default:
      return ["Staff"];
  }
}

function roleDescription(role: BranchRole): string {
  return (
    ROLE_OPTIONS.find((item) => item.value === role)?.description ??
    "Company-scoped branch role."
  );
}

export default function CreateBranchUserForm({
  value,
  onChange,
  onSubmit,
  busy,
  error,
  branchId,
  branchName,
  stockLocations = [],
}: Props) {
  const selectedBranchIds = unique([
    ...(value.branchIds ?? []),
    value.defaultBranchId,
    branchId,
  ]);

  const selectedStockLocationIds = unique(value.stockLocationIds ?? []);

  const defaultBranchId =
    value.defaultBranchId && selectedBranchIds.includes(value.defaultBranchId)
      ? value.defaultBranchId
      : selectedBranchIds[0] ?? branchId ?? null;

  const defaultStockLocationId =
    value.defaultStockLocationId &&
    selectedStockLocationIds.includes(value.defaultStockLocationId)
      ? value.defaultStockLocationId
      : selectedStockLocationIds[0] ?? null;

  const effectiveRoleNames = unique([
    ...(value.roleNames ?? []),
    ...roleNamesFor(value.role),
  ]);

  const set = <K extends keyof Props["value"]>(
    key: K,
    nextValue: Props["value"][K]
  ) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  function setRole(role: BranchRole) {
    onChange({
      ...value,
      role,
      roleNames: roleNamesFor(role),
    });
  }

  function toggleStockLocation(locationId: string) {
    const exists = selectedStockLocationIds.includes(locationId);

    const nextStockLocationIds = exists
      ? selectedStockLocationIds.filter((id) => id !== locationId)
      : [...selectedStockLocationIds, locationId];

    onChange({
      ...value,
      stockLocationIds: nextStockLocationIds,
      defaultStockLocationId:
        value.defaultStockLocationId &&
        nextStockLocationIds.includes(value.defaultStockLocationId)
          ? value.defaultStockLocationId
          : nextStockLocationIds[0] ?? null,
    });
  }

  function toggleCapability(
    key: "canReceive" | "canIssue" | "canTransfer" | "canSell" | "canAdjust"
  ) {
    onChange({
      ...value,
      [key]: !Boolean(value[key]),
    });
  }

  function submit() {
    onChange({
      ...value,
      roleNames: effectiveRoleNames,
      branchIds: selectedBranchIds,
      defaultBranchId,
      stockLocationIds: selectedStockLocationIds,
      defaultStockLocationId,
      canReceive: value.canReceive ?? true,
      canIssue: value.canIssue ?? true,
      canTransfer: value.canTransfer ?? true,
      canSell: value.canSell ?? value.role === "BranchAdmin",
      canAdjust: value.canAdjust ?? false,
    });

    window.setTimeout(onSubmit, 0);
  }

  return (
    <div className="ob-inner-card">
      <div className="ob-inner-card-header">
        <div>
          <div className="ob-inner-card-title">Create branch user</div>
          <div className="ob-inner-card-sub">
            Create a company-scoped login and preserve branch, role, and stock
            location access.
          </div>
        </div>

        <div className="ob-pill">
          {branchName || "Current branch"}
        </div>
      </div>

      <div className="ob-inner-card-body">
        {error && (
          <div className="ob-alert ob-alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="ob-section-title">Identity</div>

        <div className="ob-grid-2">
          <Field label="First name">
            <Input
              value={value.firstName}
              onChange={(next) => set("firstName", next)}
              placeholder="e.g. Hana"
              disabled={busy}
            />
          </Field>

          <Field label="Last name">
            <Input
              value={value.lastName}
              onChange={(next) => set("lastName", next)}
              placeholder="e.g. Tesfaye"
              disabled={busy}
            />
          </Field>

          <Field label="Username" required>
            <Input
              value={value.userName}
              onChange={(next) => set("userName", next)}
              placeholder="e.g. hana.t"
              disabled={busy}
            />
          </Field>

          <Field label="Email" required>
            <Input
              value={value.email}
              onChange={(next) => set("email", next)}
              placeholder="hana@company.com"
              type="email"
              disabled={busy}
            />
          </Field>

          <Field label="Password" required>
            <Input
              value={value.password}
              onChange={(next) => set("password", next)}
              type="password"
              placeholder="Minimum 8 characters"
              disabled={busy}
            />
          </Field>

          <Field label="Primary role">
            <SelectInput
              value={value.role}
              onChange={(next) => setRole(next as BranchRole)}
              options={ROLE_OPTIONS.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
              disabled={busy}
            />
          </Field>
        </div>

        <div className="ob-role-preview">
          <div>
            <strong>{ROLE_OPTIONS.find((item) => item.value === value.role)?.label}</strong>
            <span>{roleDescription(value.role)}</span>
          </div>

          <div className="ob-chip-list">
            {effectiveRoleNames.map((roleName) => (
              <span key={roleName} className="ob-chip">
                {roleName}
              </span>
            ))}
          </div>
        </div>

        <div className="ob-section-title">Branch assignment</div>

        <div className="ob-scope-panel">
          <div>
            <strong>{branchName || "Selected branch"}</strong>
            <span>
              This user will be assigned to the branch currently being
              configured.
            </span>
          </div>

          <div className="ob-chip-list">
            {selectedBranchIds.map((id) => (
              <span key={id} className="ob-chip">
                {id === branchId && branchName ? branchName : id}
              </span>
            ))}
          </div>
        </div>

        <div className="ob-section-title">Stock location access</div>

        {stockLocations.length === 0 ? (
          <div className="ob-empty-soft">
            No stock locations were provided to this form. The backend should
            still assign branch-level defaults if available.
          </div>
        ) : (
          <div className="ob-location-list">
            {stockLocations.map((location) => {
              const checked = selectedStockLocationIds.includes(location.id);
              const isDefault = defaultStockLocationId === location.id;

              return (
                <label
                  key={location.id}
                  className={`ob-location-row${checked ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() => toggleStockLocation(location.id)}
                  />

                  <span>
                    <strong>{location.name}</strong>
                    <small>
                      {[location.code, location.locationType]
                        .filter(Boolean)
                        .join(" · ") || "Stock location"}
                    </small>
                  </span>

                  {checked && (
                    <button
                      type="button"
                      className="ob-link-btn"
                      disabled={busy}
                      onClick={(event) => {
                        event.preventDefault();
                        set("defaultStockLocationId", location.id);
                      }}
                    >
                      {isDefault ? "Default" : "Set default"}
                    </button>
                  )}
                </label>
              );
            })}
          </div>
        )}

        <div className="ob-section-title">Operational permissions</div>

        <div className="ob-permission-grid">
          {[
            ["canReceive", "Can receive stock"],
            ["canIssue", "Can issue stock"],
            ["canTransfer", "Can transfer stock"],
            ["canSell", "Can sell from POS"],
            ["canAdjust", "Can adjust stock"],
          ].map(([key, label]) => (
            <label key={key} className="ob-check-card">
              <input
                type="checkbox"
                checked={Boolean((value as any)[key])}
                disabled={busy}
                onChange={() => toggleCapability(key as any)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="ob-inner-card-footer">
        <div className="ob-footer-hint">
          User will be created with company-scoped role and operational access.
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="ob-btn ob-btn--primary"
        >
          {busy ? "Creating…" : "Create user"}
        </button>
      </div>
    </div>
  );
}