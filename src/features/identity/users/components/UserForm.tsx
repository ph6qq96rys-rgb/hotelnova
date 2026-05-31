import { useEffect, useMemo, useState } from "react";
import type { CreateUserDto, UserDto } from "../types";
import { usersApi } from "../api/usersApi";
import { useAppScope } from "../../../../app/useAppScope";

type EmployeeOption = {
  id: string;
  employeeCode?: string | null;
  fullName: string;
  email?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  departmentName?: string | null;
  positionName?: string | null;
};

type Props = {
  mode: "create" | "edit";
  initial?: UserDto;
  onSubmit: (dto: any) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
};

const ROLE_OPTIONS = [
  "Admin",
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
];

function hasSystemAdmin(roles: string[]) {
  return roles.some((r) => r.toLowerCase() === "systemadmin");
}

export default function UserForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  busy = false,
}: Props) {
  const { companyId, branchId } = useAppScope();

  const [employeeId, setEmployeeId] = useState(
    (initial as any)?.employeeId ?? ""
  );
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [userName, setUserName] = useState(initial?.userName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [roles, setRoles] = useState<string[]>(
    ((initial as any)?.roles ?? (initial as any)?.roleNames ?? []) as string[]
  );

  const [error, setError] = useState("");

  const isCreate = mode === "create";
  const isSystemAdmin = hasSystemAdmin(roles);

  const selectedEmployee = useMemo(
    () => employees.find((x) => x.id === employeeId),
    [employees, employeeId]
  );

  useEffect(() => {
    if (!companyId || mode !== "create") return;

    let active = true;

    async function loadEmployees() {
      try {
        setEmployeesLoading(true);

        const res = await usersApi.getEmployeesAvailableForUser(companyId, {
          branchId: branchId || undefined,
          q: employeeSearch || undefined,
          page: 1,
          pageSize: 50,
        });

        const data = (res as any)?.data ?? res;
        const rows = Array.isArray(data)
          ? data
          : data?.items ?? data?.data ?? data?.results ?? [];

        if (active) setEmployees(rows);
      } finally {
        if (active) setEmployeesLoading(false);
      }
    }

    const t = setTimeout(() => void loadEmployees(), 300);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [companyId, branchId, employeeSearch, mode]);

  useEffect(() => {
    if (!selectedEmployee || !isCreate) return;

    if (!email && selectedEmployee.email) {
      setEmail(selectedEmployee.email);
    }

    if (!userName && selectedEmployee.employeeCode) {
      setUserName(selectedEmployee.employeeCode.toLowerCase());
    }
  }, [selectedEmployee, isCreate, email, userName]);

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role)
        ? prev.filter((x) => x !== role)
        : [...prev, role]
    );
  }

  async function submit() {
    setError("");

    if (isCreate && !isSystemAdmin && !employeeId) {
      setError("Employee selection is required.");
      return;
    }

    if (!userName.trim()) {
      setError("Username is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (isCreate && password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (roles.length === 0) {
      setError("At least one role is required.");
      return;
    }

    const dto: CreateUserDto = {
      employeeId: isSystemAdmin ? null : employeeId,
      userName: userName.trim(),
      email: email.trim(),
      password: isCreate ? password : undefined,
      roles,
      isActive,
      branchId: selectedEmployee?.branchId ?? branchId ?? null,
    } as any;

    await onSubmit(dto);
  }

  return (
    <div className="lux-form lux-userCreate">
      <div className="lux-form__header">
        <div>
          <div className="lux-kicker">Identity</div>
          <h2 className="lux-form__title">
            {isCreate ? "Create User Account" : "Edit User Account"}
          </h2>
          <p className="lux-form__subtitle">
            {isCreate
              ? "Select an employee first, then assign login credentials and roles."
              : "Update credentials, status, and access roles."}
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
              Search Employee
              <input
                className="lux-input"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search by name, code, email…"
                disabled={busy || isSystemAdmin}
              />
            </label>

            <label className="lux-label">
              Employee {!isSystemAdmin && <span className="lux-required">*</span>}
              <select
                className="lux-input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={busy || employeesLoading || isSystemAdmin}
              >
                <option value="">
                  {employeesLoading ? "Loading employees…" : "— Select employee —"}
                </option>

                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode ? `${e.employeeCode} · ` : ""}
                    {e.fullName}
                    {e.departmentName ? ` · ${e.departmentName}` : ""}
                    {e.branchName ? ` · ${e.branchName}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {selectedEmployee ? (
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
            ) : (
              <div className="lux-hint">
                Only active employees without user accounts are listed.
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
              onChange={(e) => setUserName(e.target.value)}
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
              onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                disabled={busy}
              />
            </label>
          )}

          <label className="lux-check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={busy}
            />
            Active account
          </label>
        </section>
      </div>

      <section className="lux-panel" style={{ marginTop: 16 }}>
        <div className="lux-panel__title">Roles & Access</div>

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

        {isSystemAdmin && (
          <div className="lux-hint" style={{ marginTop: 10 }}>
            SystemAdmin is treated as a technical account and does not require an employee.
          </div>
        )}
      </section>

      <div className="lux-form__actions">
        <button className="lux-btn" type="button" onClick={onCancel} disabled={busy}>
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