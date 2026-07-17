import type { Dispatch, SetStateAction } from "react";
import type { UserFilter } from "../types/userManagement.types";
import { DEFAULT_PAGE_SIZE, ROLE_FILTERS } from "../utils/userManagement.utils";

export function UsersFilters({
  filter,
  setFilter,
  disabled,
  hasActiveFilters,
  onReset,
}: {
  filter: UserFilter;
  setFilter: Dispatch<SetStateAction<UserFilter>>;
  disabled: boolean;
  hasActiveFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div className="lux-card">
      <div className="lux-card__header">
        <div>
          <div className="lux-card__title">Filters</div>
          <div className="lux-card__hint">
            Branch is optional. By default, this page shows all company users.
          </div>
        </div>
        <button
          className="lux-btn lux-btn--soft"
          onClick={onReset}
          disabled={disabled || !hasActiveFilters}
          type="button"
        >
          Clear filters
        </button>
      </div>

      <div className="lux-filterGrid">
        <label className="lux-label">
          Status
          <select
            className="lux-input"
            value={filter.isActive === undefined ? "" : filter.isActive ? "active" : "inactive"}
            onChange={(event) => {
              const value = event.target.value;
              setFilter((current) => ({
                ...current,
                page: 1,
                isActive: value === "" ? undefined : value === "active",
              }));
            }}
            disabled={disabled}
          >
            <option value="">All statuses</option>
            <option value="active">Active users</option>
            <option value="inactive">Inactive users</option>
          </select>
        </label>

        <label className="lux-label">
          Role
          <select
            className="lux-input"
            value={filter.role ?? ""}
            onChange={(event) =>
              setFilter((current) => ({
                ...current,
                page: 1,
                role: event.target.value || undefined,
              }))
            }
            disabled={disabled}
          >
            {ROLE_FILTERS.map((role) => (
              <option key={role.value || "all"} value={role.value}>{role.label}</option>
            ))}
          </select>
        </label>

        {(["branchId", "stockLocationId", "storeId"] as const).map((key) => (
          <label className="lux-label" key={key}>
            {key === "branchId" ? "Branch ID" : key === "storeId" ? "Store/POS ID" : "Stock location ID"}
            <input
              className="lux-input"
              placeholder="Optional id…"
              value={filter[key] ?? ""}
              onChange={(event) =>
                setFilter((current) => ({
                  ...current,
                  page: 1,
                  [key]: event.target.value.trim() || undefined,
                }))
              }
              disabled={disabled}
            />
          </label>
        ))}

        <label className="lux-label">
          Page size
          <select
            className="lux-input"
            value={filter.pageSize}
            onChange={(event) =>
              setFilter((current) => ({
                ...current,
                page: 1,
                pageSize: Number(event.target.value) || DEFAULT_PAGE_SIZE,
              }))
            }
            disabled={disabled}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>{size} rows</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
