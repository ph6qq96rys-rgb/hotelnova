// src/modules/security/components/UserForm.tsx

import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { securityApi } from "../api/securityApi";
import type {
  CreateSecurityUserRequest,
  EmployeeOption,
  RoleDto,
  StockLocationOption,
  StoreOption,
  UpdateSecurityUserRequest,
  UserDto,
} from "../api/securityApi";

type Props = {
  mode: "create" | "edit";
  initial?: UserDto;
  onSubmit: (
    dto: CreateSecurityUserRequest | UpdateSecurityUserRequest
  ) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
};

const INVENTORY_ROLE_VALUES = new Set<string>([
  "CHEF",
  "BARMAN",
  "STOREKEEPER",
  "FNBCONTROLLER",
  "INVENTORYCONTROLLER",
  "WAREHOUSEMANAGER",
]);

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeRoleValue(value: unknown): string {
  return cleanText(value).toUpperCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function uniqueRoleValues(values: unknown[]): string[] {
  return [...new Set(values.map(normalizeRoleValue).filter(Boolean))];
}

function toArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => String(item ?? "")));
}

function getRoleValue(role: RoleDto): string {
  return normalizeRoleValue(
    (role as any).value ??
      (role as any).normalizedName ??
      ""
  );
}

function getRoleNameValue(role: RoleDto): string {
  return normalizeRoleValue((role as any).name);
}

function getRoleDisplayName(role: RoleDto): string {
  return cleanText(
    (role as any).displayName ??
      (role as any).name ??
      (role as any).normalizedName ??
      (role as any).value ??
      "Role"
  );
}

function getRoleDescription(role: RoleDto): string | null {
  const description = cleanText((role as any).description);
  return description || null;
}

function isRoleActive(role: RoleDto): boolean {
  return (role as any).isActive !== false;
}

function isSystemRole(role: RoleDto): boolean {
  const value = getRoleValue(role);
  return Boolean((role as any).isSystem) || value === "SYSTEMADMIN";
}

function hasRole(roles: string[], roleValue: string): boolean {
  const value = normalizeRoleValue(roleValue);
  return roles.some((role) => normalizeRoleValue(role) === value);
}

function mapInitialRoles(
  user: UserDto | undefined,
  availableRoles: RoleDto[]
): string[] {
  if (!user || availableRoles.length === 0) return [];

  const rawRoles = (user as any)?.roles ?? (user as any)?.roleNames ?? [];

  if (!Array.isArray(rawRoles)) return [];

  const lookup = new Map<string, string>();

  for (const role of availableRoles) {
    const value = getRoleValue(role);
    if (!value) continue;

    lookup.set(value, value);

    const nameValue = getRoleNameValue(role);
    if (nameValue) lookup.set(nameValue, value);
  }

  const mapped: string[] = [];

  for (const role of rawRoles) {
    if (typeof role === "string") {
      const match = lookup.get(normalizeRoleValue(role));

      if (match) {
        mapped.push(match);
      }

      continue;
    }

    const value = normalizeRoleValue(
      role?.value ??
        role?.normalizedName ??
        role?.name
    );

    const match = lookup.get(value);

    if (match) {
      mapped.push(match);
    }
  }

  return uniqueRoleValues(mapped);
}

function normalizeIds(value: unknown): string[] {
  return toArray(value);
}

function getInitialEmployeeId(user?: UserDto): string {
  return cleanText((user as any)?.employeeId);
}

function getInitialBranchIds(user?: UserDto): string[] {
  const branchIds = normalizeIds((user as any)?.branchIds);
  const branchId = cleanText((user as any)?.branchId);

  if (branchId && !branchIds.includes(branchId)) {
    return [branchId, ...branchIds];
  }

  return branchIds;
}

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

function getInitialStoreId(user?: UserDto): string {
  const id = cleanText((user as any)?.storeId);
  return id && id.toLowerCase() !== EMPTY_GUID ? id : "";
}

function getInitialStockLocationIds(user?: UserDto): string[] {
  return normalizeIds(
    (user as any)?.stockLocationIds ??
      (user as any)?.allowedStockLocationIds
  );
}

function autoUserName(employee?: EmployeeOption | null): string {
  if (!employee) return "";

  const code = cleanText(employee.employeeCode ?? employee.employeeNo);

  if (code) return code.toLowerCase();

  return employee.fullName.trim().toLowerCase().replace(/\s+/g, ".");
}

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function UserForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  busy = false,
}: Props) {
  const { companyId, branchId } = useAppScope();
  const isCreate = mode === "create";

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [roleOptions, setRoleOptions] = useState<RoleDto[]>([]);
  const [selectedRoleValues, setSelectedRoleValues] = useState<string[]>([]);

  const [stockLocations, setStockLocations] = useState<StockLocationOption[]>(
    []
  );
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStockLocationIds, setSelectedStockLocationIds] = useState<
    string[]
  >([]);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [storeId, setStoreId] = useState("");

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [stockLocationsLoading, setStockLocationsLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEmployeeId(getInitialEmployeeId(initial));
    setUserName(initial?.userName ?? "");
    setEmail(initial?.email ?? "");
    setPassword("");
    setIsActive(initial?.isActive ?? true);
    setSelectedRoleValues([]);
    setSelectedBranchIds(getInitialBranchIds(initial));
    setStoreId(getInitialStoreId(initial));
    setSelectedStockLocationIds(getInitialStockLocationIds(initial));
    setError("");
  }, [initial?.id, mode]);

  useEffect(() => {
    if (roleOptions.length === 0) return;

    setSelectedRoleValues(mapInitialRoles(initial, roleOptions));
  }, [initial?.id, roleOptions]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId) ?? null,
    [employees, employeeId]
  );

  const effectiveBranchIds = useMemo(() => {
    const employeeBranchId = cleanText(selectedEmployee?.branchId);

    return unique([
      ...selectedBranchIds,
      employeeBranchId,
      branchId ?? "",
    ]);
  }, [selectedBranchIds, selectedEmployee?.branchId, branchId]);

  const validRoleValues = useMemo(
    () => new Set(roleOptions.map(getRoleValue).filter(Boolean)),
    [roleOptions]
  );

  const requiresStockLocation = selectedRoleValues.some((roleValue) =>
    INVENTORY_ROLE_VALUES.has(normalizeRoleValue(roleValue))
  );

  useEffect(() => {
    if (!companyId) return;

    const controller = new AbortController();

    async function loadRoles() {
      try {
        setRolesLoading(true);

        const rows = await securityApi.listRoles(companyId, controller.signal);

        if (controller.signal.aborted) return;

        const companyRoles = rows
          .filter(isRoleActive)
          .filter((role) => !isSystemRole(role))
          .filter((role) => Boolean(getRoleValue(role)));

        setRoleOptions(companyRoles);
      } catch {
        if (!controller.signal.aborted) {
          setRoleOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setRolesLoading(false);
        }
      }
    }

    void loadRoles();

    return () => controller.abort();
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !isCreate) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        setEmployeesLoading(true);

        const rows = await securityApi.searchEmployees(
          companyId,
          {
            branchId: branchId || undefined,
            q: employeeSearch || undefined,
            page: 1,
            pageSize: 100,
          },
          controller.signal
        );

        if (!controller.signal.aborted) {
          setEmployees(rows);
        }
      } catch {
        if (!controller.signal.aborted) {
          setEmployees([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setEmployeesLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [companyId, branchId, employeeSearch, isCreate]);

  useEffect(() => {
    if (!selectedEmployee || !isCreate) return;

    const employeeEmail = selectedEmployee.email ?? selectedEmployee.workEmail;

    if (!email && employeeEmail) {
      setEmail(employeeEmail);
    }

    if (!userName) {
      setUserName(autoUserName(selectedEmployee));
    }

    if (selectedEmployee.branchId) {
      setSelectedBranchIds((current) =>
        unique([...current, selectedEmployee.branchId!])
      );
    }
  }, [selectedEmployee, isCreate, email, userName]);

  useEffect(() => {
    if (!companyId) return;

    const controller = new AbortController();

    async function loadStores() {
      try {
        setStoresLoading(true);

        const rows = await securityApi.listStores(
          companyId,
          {
            branchId:
              effectiveBranchIds.length === 1
                ? effectiveBranchIds[0]
                : undefined,
            isActive: true,
            page: 1,
            pageSize: 100,
          },
          controller.signal
        );

        if (!controller.signal.aborted) {
          setStores(rows);

          setStoreId((current) => {
            if (!current) return "";
            return rows.some((store) => store.id === current) ? current : "";
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setStores([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setStoresLoading(false);
        }
      }
    }

    void loadStores();

    return () => controller.abort();
  }, [companyId, effectiveBranchIds.join("|")]);

  useEffect(() => {
    if (!companyId) return;

    const controller = new AbortController();

    async function loadStockLocations() {
      try {
        setStockLocationsLoading(true);

        const rows = await securityApi.listStockLocations(
          companyId,
          {
            branchId:
              effectiveBranchIds.length === 1
                ? effectiveBranchIds[0]
                : undefined,
            isActive: true,
            page: 1,
            pageSize: 100,
          },
          controller.signal
        );

        if (!controller.signal.aborted) {
          setStockLocations(rows);
        }
      } catch {
        if (!controller.signal.aborted) {
          setStockLocations([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setStockLocationsLoading(false);
        }
      }
    }

    void loadStockLocations();

    return () => controller.abort();
  }, [companyId, effectiveBranchIds.join("|")]);

  function toggleRole(role: RoleDto) {
    const value = getRoleValue(role);

    if (!value || value === "SYSTEMADMIN") return;

    setSelectedRoleValues((current) => {
      const exists = hasRole(current, value);

      return exists
        ? uniqueRoleValues(
            current.filter(
              (item) => normalizeRoleValue(item) !== normalizeRoleValue(value)
            )
          )
        : uniqueRoleValues([...current, value]);
    });
  }

  function toggleStockLocation(id: string) {
    setSelectedStockLocationIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : unique([...current, id])
    );
  }

  async function submit() {
    setError("");

    if (!companyId) {
      setError("Company context is missing.");
      return;
    }

    const cleanEmployeeId = employeeId || getInitialEmployeeId(initial);
    const cleanUserName = userName.trim();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    const finalBranchIds = unique(effectiveBranchIds);
    const finalStockLocationIds = unique(selectedStockLocationIds);

    const finalRoles = uniqueRoleValues(selectedRoleValues).filter((role) =>
      validRoleValues.has(role)
    );

    if (isCreate && !cleanEmployeeId) {
      setError("Employee selection is required.");
      return;
    }

    if (!cleanUserName) {
      setError("Username is required.");
      return;
    }

    if (cleanEmail && !isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (isCreate && cleanPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (finalBranchIds.length === 0) {
      setError("At least one branch assignment is required.");
      return;
    }

    if (finalRoles.length === 0) {
      setError("At least one valid role is required.");
      return;
    }

    if (requiresStockLocation && finalStockLocationIds.length === 0) {
      setError("At least one stock location is required for the selected role.");
      return;
    }

    const commonPayload: UpdateSecurityUserRequest = {
      employeeId: cleanEmployeeId,
      userName: cleanUserName,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      isActive,
      ...(storeId ? { storeId } : {}),
      branchIds: finalBranchIds,
      stockLocationIds: finalStockLocationIds,
      roles: finalRoles,
    };

    const dto: CreateSecurityUserRequest | UpdateSecurityUserRequest = isCreate
      ? {
          ...commonPayload,
          password: cleanPassword,
        }
      : commonPayload;

    await onSubmit(dto);
  }

  return (
    <div className="lux-form lux-userCreate">
      <div className="lux-form__header">
        <div>
          <div className="lux-kicker">Identity & Operations Access</div>
          <h2 className="lux-form__title">
            {isCreate ? "Create ERP User" : "Edit ERP User"}
          </h2>
          <p className="lux-form__subtitle">
            Link the login account to employee context, branches, stock
            locations, and ERP roles.
          </p>
        </div>
      </div>

      {error && (
        <div className="lux-alert lux-alert--danger" role="alert">
          {error}
        </div>
      )}

      <div className="lux-grid lux-grid--2">
        {isCreate && (
          <section className="lux-panel">
            <div className="lux-panel__title">Employee Context</div>

            <label className="lux-label">
              Search employee
              <input
                className="lux-input"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder="Search by name, code, email…"
                disabled={busy}
              />
            </label>

            <label className="lux-label">
              Employee <span className="lux-required">*</span>
              <select
                className="lux-input"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                disabled={busy || employeesLoading}
              >
                <option value="">
                  {employeesLoading
                    ? "Loading employees…"
                    : "— Select employee —"}
                </option>

                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeCode || employee.employeeNo
                      ? `${employee.employeeCode ?? employee.employeeNo} · `
                      : ""}
                    {employee.fullName}
                    {employee.departmentName
                      ? ` · ${employee.departmentName}`
                      : ""}
                    {employee.branchName ? ` · ${employee.branchName}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {!employeesLoading && employees.length === 0 && (
              <div className="lux-hint">
                No available employees found. Employees already linked to users
                may not appear here.
              </div>
            )}

            {selectedEmployee && (
              <div className="lux-employeeCard">
                <div className="lux-employeeCard__name">
                  {selectedEmployee.fullName}
                </div>
                <div className="lux-employeeCard__meta">
                  {selectedEmployee.employeeCode ??
                    selectedEmployee.employeeNo ??
                    "—"}{" "}
                  · {selectedEmployee.branchName ?? "No branch"} ·{" "}
                  {selectedEmployee.departmentName ?? "No department"}
                </div>
                <div className="lux-employeeCard__meta">
                  Position: {selectedEmployee.positionName ?? "—"}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="lux-panel">
          <div className="lux-panel__title">Login Credentials</div>

          <label className="lux-label">
            Username <span className="lux-required">*</span>
            <input
              className="lux-input"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder="e.g. emp001"
              disabled={busy}
            />
          </label>

          <label className="lux-label">
            Email
            <input
              className="lux-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@company.com"
              disabled={busy}
            />
          </label>

          {isCreate && (
            <label className="lux-label">
              Temporary Password <span className="lux-required">*</span>
              <input
                className="lux-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
                disabled={busy}
              />
            </label>
          )}

          <label className="lux-check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={busy}
            />
            Active account
          </label>
        </section>
      </div>

      <section className="lux-panel" style={{ marginTop: 16 }}>
        <div className="lux-panel__title">Roles & Approval Authority</div>

        {rolesLoading && <div className="lux-muted">Loading roles…</div>}

        {!rolesLoading && roleOptions.length === 0 && (
          <div className="lux-alert lux-alert--warning">
            No active company roles found. Configure roles before creating
            users.
          </div>
        )}

        <div className="lux-roleGrid">
          {roleOptions.map((role) => {
            const value = getRoleValue(role);
            const displayName = getRoleDisplayName(role);
            const description = getRoleDescription(role);

            return (
              <label key={(role as any).id ?? value} className="lux-rolePill">
                <input
                  type="checkbox"
                  value={value}
                  checked={hasRole(selectedRoleValues, value)}
                  onChange={() => toggleRole(role)}
                  disabled={busy || rolesLoading}
                />
                <span title={description ?? value}>{displayName}</span>
              </label>
            );
          })}
        </div>

        <div className="lux-hint" style={{ marginTop: 10 }}>
          Display names are shown for users, but only valid normalized backend
          role values are submitted.
        </div>
      </section>

      <section className="lux-panel" style={{ marginTop: 16 }}>
        <div className="lux-panel__title">Organization & Stock Access</div>

        <div className="lux-hint" style={{ marginBottom: 10 }}>
          Branch assignments are derived from the selected employee and active
          company scope. Stock locations are only required for inventory-related
          roles.
        </div>

        <label className="lux-label">
          Store / POS
          <select
            className="lux-input"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            disabled={busy || storesLoading}
          >
            <option value="">
              {storesLoading ? "Loading stores…" : "— Select Store / POS —"}
            </option>

            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.code ? `${store.code} · ` : ""}
                {store.name}
                {store.branchName ? ` · ${store.branchName}` : ""}
              </option>
            ))}
          </select>
        </label>

        {!storesLoading && stores.length === 0 && (
          <div className="lux-hint">
            No active Store / POS records found for the current company or branch.
          </div>
        )}

        <div className="lux-label">
          Stock Locations{" "}
          {requiresStockLocation && <span className="lux-required">*</span>}
        </div>

        {stockLocationsLoading && (
          <div className="lux-muted">Loading stock locations…</div>
        )}

        <div className="lux-roleGrid">
          {stockLocations.map((location) => (
            <label key={location.id} className="lux-rolePill">
              <input
                type="checkbox"
                value={location.name}
                checked={selectedStockLocationIds.includes(location.id)}
                onChange={() => toggleStockLocation(location.id)}
                disabled={busy}
              />
              <span>
                {location.code ? `${location.code} · ` : ""}
                {location.name}
                {location.branchName ? ` · ${location.branchName}` : ""}
              </span>
            </label>
          ))}
        </div>

        {!stockLocationsLoading && stockLocations.length === 0 && (
          <div className="lux-hint">
            No active stock locations found for the current company or branch.
          </div>
        )}
      </section>

      <div className="lux-form__actions">
        <button
          className="lux-btn"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>

        <button
          className="lux-btn lux-btn--primary"
          type="button"
          onClick={submit}
          disabled={busy || rolesLoading}
        >
          {busy ? "Saving…" : isCreate ? "Create User" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}