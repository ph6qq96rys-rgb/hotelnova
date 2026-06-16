// src/modules/security/components/UserForm.tsx

import { useEffect, useMemo, useState } from "react";
import { securityApi } from "../api/securityApi";
import type {
  CreateSecurityUserRequest,
  EmployeeOption,
  StockLocationOption,
  UpdateSecurityUserRequest,
  UserDto,
} from "../api/securityApi";
import { useAppScope } from "../../../app/useAppScope";

type Props = {
  mode: "create" | "edit";
  initial?: UserDto;
  onSubmit: (
    dto: CreateSecurityUserRequest | UpdateSecurityUserRequest
  ) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
};

const ROLE_OPTIONS = [
  "Admin",
  "CompanyAdmin",
  "Manager",
  "FNBController",
  "StoreKeeper",
  "Chef",
  "BarMan",
  "Cashier",
  "Waiter",
  "HR",
  "Finance",
  "SystemAdmin",
] as const;

const REQUESTER_ROLES = new Set<string>(["Chef", "BarMan"]);

const LOCATION_REQUIRED_ROLES = new Set<string>([
  "Chef",
  "BarMan",
  "StoreKeeper",
  "FNBController",
]);

function rolesOf(user?: UserDto): string[] {
  return (((user as any)?.roles ?? (user as any)?.roleNames ?? []) as string[])
    .filter(Boolean)
    .map(String);
}

function hasSystemAdmin(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === "systemadmin");
}

function normalizeIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter(Boolean).map(String))]
    : [];
}

function normalizeRole(role: string): string {
  return role.trim();
}

function autoUserName(employee?: EmployeeOption | null): string {
  if (!employee) return "";

  if (employee.employeeCode) {
    return employee.employeeCode.trim().toLowerCase();
  }

  return employee.fullName.trim().toLowerCase().replace(/\s+/g, ".");
}

function getInitialEmployeeId(user?: UserDto): string {
  return String((user as any)?.employeeId ?? "");
}

function getInitialStockLocationId(user?: UserDto): string {
  return String(
    (user as any)?.stockLocationId ??
      (user as any)?.defaultStockLocationId ??
      ""
  );
}

function getInitialAllowedStockLocationIds(user?: UserDto): string[] {
  return normalizeIds((user as any)?.allowedStockLocationIds);
}

function getInitialBranchId(user?: UserDto): string | null {
  return ((user as any)?.branchId ?? null) as string | null;
}

function isValidEmail(value: string): boolean {
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

  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [stockLocations, setStockLocations] = useState<StockLocationOption[]>(
    []
  );
  const [stockLocationsLoading, setStockLocationsLoading] = useState(false);
  const [stockLocationId, setStockLocationId] = useState("");
  const [allowedStockLocationIds, setAllowedStockLocationIds] = useState<
    string[]
  >([]);

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setEmployeeId(getInitialEmployeeId(initial));
    setStockLocationId(getInitialStockLocationId(initial));
    setAllowedStockLocationIds(getInitialAllowedStockLocationIds(initial));

    setUserName(initial?.userName ?? "");
    setEmail(initial?.email ?? "");
    setPassword("");
    setIsActive(initial?.isActive ?? true);
    setRoles(rolesOf(initial));
    setError("");
  }, [initial?.id, mode]);

  const isSystemAdmin = hasSystemAdmin(roles);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId) ?? null,
    [employees, employeeId]
  );

  const effectiveBranchId =
    selectedEmployee?.branchId ??
    getInitialBranchId(initial) ??
    branchId ??
    null;

  const requiresWarehouseLocation =
    !isSystemAdmin &&
    roles.some((role) => LOCATION_REQUIRED_ROLES.has(role));

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
            pageSize: 50,
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

    if (!email && selectedEmployee.email) {
      setEmail(selectedEmployee.email);
    }

    if (!userName) {
      setUserName(autoUserName(selectedEmployee));
    }
  }, [selectedEmployee, isCreate, email, userName]);

  useEffect(() => {
    if (!companyId) return;
    if (!effectiveBranchId && !isSystemAdmin) return;

    const controller = new AbortController();

    async function loadLocations() {
      try {
        setStockLocationsLoading(true);

        const rows = await securityApi.listStockLocations(
          companyId,
          {
            branchId: effectiveBranchId || undefined,
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

    void loadLocations();

    return () => controller.abort();
  }, [companyId, effectiveBranchId, isSystemAdmin]);

  useEffect(() => {
    if (!stockLocationId) return;

    setAllowedStockLocationIds((current) =>
      current.includes(stockLocationId)
        ? current
        : [...current, stockLocationId]
    );
  }, [stockLocationId]);

  function toggleRole(role: string) {
    const normalized = normalizeRole(role);

    setRoles((current) => {
      if (normalized === "SystemAdmin") {
        return current.includes("SystemAdmin") ? [] : ["SystemAdmin"];
      }

      const withoutSystemAdmin = current.filter(
        (item) => item !== "SystemAdmin"
      );

      return withoutSystemAdmin.includes(normalized)
        ? withoutSystemAdmin.filter((item) => item !== normalized)
        : [...withoutSystemAdmin, normalized];
    });
  }

  function toggleAllowedLocation(id: string) {
    setAllowedStockLocationIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function submit() {
    setError("");

    const cleanUserName = userName.trim();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!companyId) {
      setError("Company context is missing.");
      return;
    }

    if (isCreate && !isSystemAdmin && !employeeId) {
      setError("Employee selection is required.");
      return;
    }

    if (!cleanUserName) {
      setError("Username is required.");
      return;
    }

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (isCreate && cleanPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (roles.length === 0) {
      setError("At least one role is required.");
      return;
    }

    if (requiresWarehouseLocation && !stockLocationId) {
      setError(
        "Default stock location is required for warehouse request users."
      );
      return;
    }

    const finalEmployeeId = isSystemAdmin
      ? null
      : employeeId || getInitialEmployeeId(initial) || null;

    const finalStockLocationId = isSystemAdmin
      ? null
      : stockLocationId || getInitialStockLocationId(initial) || null;

    const finalBranchId = isSystemAdmin ? null : effectiveBranchId;

    const finalAllowedLocations = isSystemAdmin
      ? []
      : [
          ...new Set(
            [
              finalStockLocationId,
              ...allowedStockLocationIds,
            ].filter(Boolean) as string[]
          ),
        ];

    const commonPayload = {
      employeeId: finalEmployeeId,
      userName: cleanUserName,
      email: cleanEmail,
      roles,
      roleNames: roles,
      isActive,
      branchId: finalBranchId,
      stockLocationId: finalStockLocationId,
      allowedStockLocationIds: finalAllowedLocations,
      canSubmitWarehouseRequests:
        !isSystemAdmin && roles.some((role) => REQUESTER_ROLES.has(role)),
      canApproveWarehouseRequests:
        !isSystemAdmin && roles.includes("FNBController"),
      canIssueStock: !isSystemAdmin && roles.includes("StoreKeeper"),
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
            Link login access to employee context, branch scope, stock
            location, and warehouse authority.
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
                disabled={busy || isSystemAdmin}
              />
            </label>

            <label className="lux-label">
              Employee{" "}
              {!isSystemAdmin && <span className="lux-required">*</span>}
              <select
                className="lux-input"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                disabled={busy || employeesLoading || isSystemAdmin}
              >
                <option value="">
                  {employeesLoading
                    ? "Loading employees…"
                    : "— Select employee —"}
                </option>

                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeCode
                      ? `${employee.employeeCode} · `
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

            {selectedEmployee && (
              <div className="lux-employeeCard">
                <div className="lux-employeeCard__name">
                  {selectedEmployee.fullName}
                </div>

                <div className="lux-employeeCard__meta">
                  {selectedEmployee.employeeCode ?? "—"} ·{" "}
                  {selectedEmployee.branchName ?? "No branch"} ·{" "}
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
            Email <span className="lux-required">*</span>
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
                placeholder="Minimum 6 characters"
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

        <div className="lux-roleGrid">
          {ROLE_OPTIONS.map((role) => (
            <label key={role} className="lux-rolePill">
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={() => toggleRole(role)}
                disabled={busy}
              />
              <span>{role}</span>
            </label>
          ))}
        </div>

        <div className="lux-hint" style={{ marginTop: 10 }}>
          Chef/BarMan submit requests. FNBController approves. StoreKeeper
          issues stock. SystemAdmin is a technical platform account.
        </div>
      </section>

      {!isSystemAdmin && (
        <section className="lux-panel" style={{ marginTop: 16 }}>
          <div className="lux-panel__title">Warehouse Request Access</div>

          <label className="lux-label">
            Default Stock Location{" "}
            {requiresWarehouseLocation && (
              <span className="lux-required">*</span>
            )}
            <select
              className="lux-input"
              value={stockLocationId}
              onChange={(event) => setStockLocationId(event.target.value)}
              disabled={busy || stockLocationsLoading}
            >
              <option value="">
                {stockLocationsLoading
                  ? "Loading stock locations…"
                  : "— Select default stock location —"}
              </option>

              {stockLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code ? `${location.code} · ` : ""}
                  {location.name}
                  {location.branchName ? ` · ${location.branchName}` : ""}
                  {location.locationType ? ` · ${location.locationType}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="lux-label">Allowed Stock Locations</div>

          <div className="lux-roleGrid">
            {stockLocations.map((location) => (
              <label key={location.id} className="lux-rolePill">
                <input
                  type="checkbox"
                  checked={allowedStockLocationIds.includes(location.id)}
                  onChange={() => toggleAllowedLocation(location.id)}
                  disabled={busy}
                />
                <span>
                  {location.code ? `${location.code} · ` : ""}
                  {location.name}
                </span>
              </label>
            ))}
          </div>

          <div className="lux-hint" style={{ marginTop: 10 }}>
            Allowed locations control where this user can request, approve, or
            issue stock.
          </div>
        </section>
      )}

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
          disabled={busy}
        >
          {busy ? "Saving…" : isCreate ? "Create User" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}