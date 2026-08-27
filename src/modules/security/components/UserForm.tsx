// src/modules/security/components/UserForm.tsx

import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { securityApi } from "../api/securityApi";
import { branchApi } from "../../../features/hr/api/hrApi";
import { isStrongPassword } from "../utils/userManagement.utils";
import type {
  CreateSecurityUserRequest,
  EmployeeOption,
  RoleDto,
  StockLocationOption,
  StoreOption,
  UpdateSecurityUserRequest,
  UserDto,
} from "../api/securityApi";
import type { BranchDto } from "../../../features/hr/api/hrApi";

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
  return cleanText((user as any)?.companyEmployeeId ?? (user as any)?.employeeId ?? (user as any)?.employee?.id);
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

function getInitialScope(user?: UserDto): "Company" | "Branch" {
  return cleanText((user as any)?.scope).toLowerCase() === "company"
    ? "Company"
    : "Branch";
}

function getLinkedEmployeeLabel(user?: UserDto): string {
  const employee = (user as any)?.employee;
  const code = cleanText(
    (user as any)?.employeeCode ?? employee?.employeeCode ?? employee?.employeeNo
  );
  const name = cleanText(
    (user as any)?.employeeName ??
      (user as any)?.employeeFullName ??
      employee?.fullName
  );

  if (code && name) return `${code} - ${name}`;
  return name || code || "Not linked";
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
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedStockLocationIds, setSelectedStockLocationIds] = useState<
    string[]
  >([]);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [scope, setScope] = useState<"Company" | "Branch">("Branch");
  const [storeId, setStoreId] = useState("");

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
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
    setScope(getInitialScope(initial));
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

  const branchOptions = useMemo(
    () =>
      branches
        .filter((branch) => branch?.id && branch.isActive !== false)
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [branches]
  );

  const effectiveBranchIds = useMemo(() => {
    if (scope === "Company") {
      return unique([...selectedBranchIds]);
    }

    const employeeBranchId = cleanText(
      selectedEmployee?.branchId ?? (initial as any)?.employee?.branchId
    );

    return unique([
      ...selectedBranchIds,
      employeeBranchId,
      branchId ?? "",
    ]);
  }, [selectedBranchIds, selectedEmployee?.branchId, branchId, scope, initial]);

  const validRoleValues = useMemo(
    () => new Set(roleOptions.map(getRoleValue).filter(Boolean)),
    [roleOptions]
  );

  const requiresStockLocation = selectedRoleValues.some((roleValue) =>
    INVENTORY_ROLE_VALUES.has(normalizeRoleValue(roleValue))
  );
  const branchCount = effectiveBranchIds.length;
  const stockLocationCount = selectedStockLocationIds.length;
  const selectedRoleCount = selectedRoleValues.length;

  useEffect(() => {
    if (!companyId) return;

    const controller = new AbortController();

    async function loadBranches() {
      try {
        setBranchesLoading(true);
        const rows = await branchApi.list(companyId, { activeOnly: true });
        if (!controller.signal.aborted) setBranches(rows);
      } catch {
        if (!controller.signal.aborted) setBranches([]);
      } finally {
        if (!controller.signal.aborted) setBranchesLoading(false);
      }
    }

    void loadBranches();

    return () => controller.abort();
  }, [companyId]);

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

  function toggleBranch(id: string) {
    setSelectedBranchIds((current) =>
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

    if (isCreate && !isStrongPassword(cleanPassword)) {
      setError("Password must include upper and lower case letters, a number, and at least 8 characters.");
      return;
    }

    if (scope === "Branch" && finalBranchIds.length === 0) {
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
      companyEmployeeId: cleanEmployeeId,
      userName: cleanUserName,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      isActive,
      scope,
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
      <div className="lux-form__header userCreate__header">
        <div>
          <div className="lux-kicker">Identity & Operations Access</div>
          <h2 className="lux-form__title">
            {isCreate ? "Create ERP User" : "Edit ERP User"}
          </h2>
          <p className="lux-form__subtitle">
            Define the employee login, ERP role, and operational access scope.
          </p>
        </div>
        <div className="userCreate__summary" aria-label="User setup summary">
          <span>{scope} scope</span>
          <span>{selectedRoleCount} role{selectedRoleCount === 1 ? "" : "s"}</span>
          <span>{branchCount} branch{branchCount === 1 ? "" : "es"}</span>
          <span>{stockLocationCount} stock location{stockLocationCount === 1 ? "" : "s"}</span>
        </div>
      </div>

      {error && (
        <div className="lux-alert lux-alert--danger" role="alert">
          {error}
        </div>
      )}

      <div className="userCreate__identityGrid">
        {isCreate && (
          <section className="lux-panel userCreate__panel">
            <div className="userCreate__sectionHead">
              <div>
                <div className="lux-panel__title">Employee</div>
                <p>Select the employee this login belongs to.</p>
              </div>
              <span className="userCreate__step">1</span>
            </div>

            <label className="lux-label">
              Search employee
              <input
                className="lux-input"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder="Search by name, code, email..."
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
                    ? "Loading employees..."
                    : "- Select employee -"}
                </option>

                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeCode || employee.employeeNo
                      ? `${employee.employeeCode ?? employee.employeeNo} - `
                      : ""}
                    {employee.fullName}
                    {employee.departmentName
                      ? ` - ${employee.departmentName}`
                      : ""}
                    {employee.branchName ? ` - ${employee.branchName}` : ""}
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
                    "-"}{" "}
                  - {selectedEmployee.branchName ?? "No branch"} -{" "}
                  {selectedEmployee.departmentName ?? "No department"}
                </div>
                <div className="lux-employeeCard__meta">
                  Position: {selectedEmployee.positionName ?? "-"}
                </div>
              </div>
            )}
          </section>
        )}

        {!isCreate && (
          <section className="lux-panel userCreate__panel">
            <div className="userCreate__sectionHead">
              <div>
                <div className="lux-panel__title">Employee</div>
                <p>Linked HR record for this account.</p>
              </div>
              <span className="userCreate__step">1</span>
            </div>
            <div className="lux-employeeCard">
              <div className="lux-employeeCard__name">
                {getLinkedEmployeeLabel(initial)}
              </div>
              <div className="lux-employeeCard__meta">
                Employee linking is managed through the dedicated Employee action
                on the user list.
              </div>
            </div>
          </section>
        )}

        <section className="lux-panel userCreate__panel">
          <div className="userCreate__sectionHead">
            <div>
              <div className="lux-panel__title">Login</div>
              <p>Credentials and account status.</p>
            </div>
            <span className="userCreate__step">2</span>
          </div>

          <div className="userCreate__fieldGrid">
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
          </div>

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

      <section className="lux-panel userCreate__panel userCreate__panelBlock">
        <div className="userCreate__sectionHead">
          <div>
            <div className="lux-panel__title">Roles</div>
            <p>Choose what this user can do. Approval limits remain controlled by backend policy.</p>
          </div>
          <span className="userCreate__step">3</span>
        </div>

        {rolesLoading && <div className="lux-muted">Loading roles...</div>}

        {!rolesLoading && roleOptions.length === 0 && (
          <div className="lux-alert lux-alert--warning">
            No active company roles found. Configure roles before creating
            users.
          </div>
        )}

        <div className="lux-roleGrid userCreate__optionGrid userCreate__optionGrid--roles">
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

        <div className="lux-hint userCreate__footnote">
          Display names are shown for users, but only valid normalized backend
          role values are submitted.
        </div>
      </section>

      <section className="lux-panel userCreate__panel userCreate__panelBlock">
        <div className="userCreate__sectionHead">
          <div>
            <div className="lux-panel__title">Access Scope</div>
            <p>Define company, branch, POS store, and stock-location access.</p>
          </div>
          <span className="userCreate__step">4</span>
        </div>

        <div className="lux-hint userCreate__footnote">
          Choose whether this account can operate across the assigned company or
          only selected branches. Stock locations are only required for
          inventory-related roles.
        </div>

        <div className="userCreate__scopeGrid">
          <label className="userCreate__scopeCard">
            <input
              type="radio"
              name="user-scope"
              value="Branch"
              checked={scope === "Branch"}
              onChange={() => setScope("Branch")}
              disabled={busy}
            />
            <span>
              <strong>Branch scoped</strong>
              <small>Restrict work to selected branches.</small>
            </span>
          </label>
          <label className="userCreate__scopeCard">
            <input
              type="radio"
              name="user-scope"
              value="Company"
              checked={scope === "Company"}
              onChange={() => setScope("Company")}
              disabled={busy}
            />
            <span>
              <strong>Company scoped</strong>
              <small>Allow company-wide ERP access where permissions allow.</small>
            </span>
          </label>
        </div>

        <div className="lux-label">
          Branch Access {scope === "Branch" && <span className="lux-required">*</span>}
        </div>

        {branchesLoading && <div className="lux-muted">Loading branches...</div>}

        <div className="lux-roleGrid userCreate__optionGrid">
          {branchOptions.map((branch) => (
            <label key={branch.id} className="lux-rolePill">
              <input
                type="checkbox"
                value={branch.id}
                checked={selectedBranchIds.includes(branch.id)}
                onChange={() => toggleBranch(branch.id)}
                disabled={busy}
              />
              <span>{branch.code ? `${branch.code} - ` : ""}{branch.name}</span>
            </label>
          ))}
        </div>

        {!branchesLoading && branchOptions.length === 0 && (
          <div className="lux-hint" style={{ marginBottom: 16 }}>
            No active branches found for this company.
          </div>
        )}

        <label className="lux-label">
          Store / POS
          <select
            className="lux-input"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            disabled={busy || storesLoading}
          >
            <option value="">
              {storesLoading ? "Loading stores..." : "- Select Store / POS -"}
            </option>

            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.code ? `${store.code} - ` : ""}
                {store.name}
                {store.branchName ? ` - ${store.branchName}` : ""}
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
          <div className="lux-muted">Loading stock locations...</div>
        )}

        <div className="lux-roleGrid userCreate__optionGrid">
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
                {location.code ? `${location.code} - ` : ""}
                {location.name}
                {location.branchName ? ` - ${location.branchName}` : ""}
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
          {busy ? "Saving..." : isCreate ? "Create User" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
