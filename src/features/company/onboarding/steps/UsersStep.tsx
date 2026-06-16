// src/modules/company/onboarding/steps/UsersStep.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import type { StockLocation } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import type {
  CompanyUserDto,
  EmployeeLookupDto,
  FieldErrors,
  OnboardingAction,
} from "../state/onboarding.types";
import { extractApiError, isEmail } from "../utils/onboarding.utils";
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

const ROLE_OPTIONS = [
  { value: "SystemAdmin", label: "System Admin" },
  { value: "CompanyAdmin", label: "Company Admin" },
  { value: "BranchAdmin", label: "Branch Admin" },
  { value: "StoreManager", label: "Store Manager" },
  { value: "StoreKeeper", label: "Store Keeper" },
  { value: "WarehouseManager", label: "Warehouse Manager" },
  { value: "FnbController", label: "F&B Controller" },
  { value: "KitchenManager", label: "Kitchen Manager" },
  { value: "BarManager", label: "Bar Manager" },
  { value: "PurchasingOfficer", label: "Purchasing Officer" },
  { value: "ProductionManager", label: "Production Manager" },
  { value: "Cashier", label: "Cashier" },
  { value: "InventoryClerk", label: "Inventory Clerk" },
] as const;

type FormState = {
  employeeId: string;
  userName: string;
  email: string;
  password: string;
  role: string;
  stockLocationId: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  employeeId: "",
  userName: "",
  email: "",
  password: "",
  role: "CompanyAdmin",
  stockLocationId: "",
  isActive: true,
};

function getId(x: any): string {
  return String(x?.id ?? x?.Id ?? x?.userId ?? x?.employeeId ?? "");
}

function getRoles(x: any): string[] {
  if (Array.isArray(x?.roles)) {
    return x.roles.filter(Boolean).map(String);
  }

  if (typeof x?.roles === "string") {
    return x.roles
      .split(",")
      .map((r: string) => r.trim())
      .filter(Boolean);
  }

  return [x?.role, x?.roleName, x?.primaryRole].filter(Boolean).map(String);
}

function hasRole(x: any, roleName: string): boolean {
  const expected = roleName.trim().toLowerCase();

  return getRoles(x).some((role) => {
    const current = role.trim().toLowerCase();

    if (expected === "companyadmin") {
      return (
        current === "companyadmin" ||
        current === "companyadministrator" ||
        current === "admin"
      );
    }

    return current === expected;
  });
}

function isCompanyAdmin(x: any): boolean {
  return hasRole(x, "CompanyAdmin");
}

function isSystemAdminRole(role: string): boolean {
  return role.trim().toLowerCase() === "systemadmin";
}

function isCompanyAdminRole(role: string): boolean {
  const value = role.trim().toLowerCase();
  return value === "companyadmin" || value === "companyadministrator" || value === "admin";
}

function isBranchScopedRole(role: string): boolean {
  return !isSystemAdminRole(role);
}

function displayName(x: any): string {
  return (
    x?.employeeName ??
    x?.employee?.fullName ??
    x?.fullName ??
    x?.name ??
    x?.userName ??
    x?.email ??
    "—"
  );
}

function employeeLabel(e: EmployeeLookupDto): string {
  return `${e.employeeCode ? `${e.employeeCode} — ` : ""}${
    e.fullName ?? e.workEmail ?? e.id
  }`;
}

function isActiveUser(x: any): boolean {
  return x?.isActive === true || x?.isActive === undefined;
}

function normalizeRole(role: string): string {
  if (isCompanyAdminRole(role)) return "CompanyAdmin";
  return role;
}

export function UsersStep(props: Props) {
  const [members, setMembers] = useState<CompanyUserDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeLookupDto[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<CompanyUserDto | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStockLocationId, setEditStockLocationId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const activeUsersCount = useMemo(
    () => members.filter((x) => isActiveUser(x)).length,
    [members],
  );

  const companyAdminCount = useMemo(
    () => members.filter((x) => isCompanyAdmin(x) && isActiveUser(x)).length,
    [members],
  );

  const branchAdminCount = useMemo(
    () => members.filter((x) => hasRole(x, "BranchAdmin") && isActiveUser(x)).length,
    [members],
  );

  const fetchAll = useCallback(async () => {
    if (!props.companyId || !props.branchId) {
      setMembers([]);
      setEmployees([]);
      setLocations([]);
      setLoadError("Company and branch are required before users can be loaded.");
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [users, employeeLookups, stockLocations] = await Promise.all([
        onboardingApi.listBranchUsers(props.companyId, props.branchId),
        onboardingApi.listAvailableEmployees(props.companyId, props.branchId),
        onboardingApi.listStockLocations(props.companyId, props.branchId),
      ]);

      setMembers(Array.isArray(users) ? users : []);
      setEmployees(
        Array.isArray(employeeLookups?.employees)
          ? employeeLookups.employees
          : [],
      );
      setLocations(Array.isArray(stockLocations) ? stockLocations : []);
    } catch (err) {
      setLoadError(extractApiError(err, "Failed to load users and employees."));
      setMembers([]);
      setEmployees([]);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [props.companyId, props.branchId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const selectedEmployee = employees.find((x) => x.id === form.employeeId);

  useEffect(() => {
    if (!selectedEmployee) return;

    setForm((x) => ({
      ...x,
      email: x.email || selectedEmployee.workEmail || "",
      userName:
        x.userName ||
        selectedEmployee.workEmail ||
        selectedEmployee.employeeCode ||
        "",
    }));
  }, [selectedEmployee]);

  function validate(): boolean {
    const e: FieldErrors = {};
    const role = normalizeRole(form.role);
    const systemAdmin = isSystemAdminRole(role);

    if (!form.employeeId) e.employeeId = "Employee is required.";
    if (!form.userName.trim()) e.userName = "Username is required.";
    if (form.email && !isEmail(form.email)) e.email = "Valid email is required.";

    if (!form.password || form.password.trim().length < 8) {
      e.password = "Password must be at least 8 characters.";
    }

    if (!role) e.role = "Role is required.";

    if (!systemAdmin && !props.branchId) {
      e.branchId = "Branch is required unless the user is System Admin.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function startEdit(member: CompanyUserDto) {
    const roles = getRoles(member);
    const primaryRole = normalizeRole(roles[0] ?? "BranchAdmin");

    setEditingUser(member);
    setEditRole(primaryRole);
    setEditEmail(member.email ?? "");
    setEditStockLocationId(member.defaultStockLocationId ?? "");
    setEditPassword("");
    setEditIsActive(member.isActive !== false);
  }

  async function create() {
    if (!props.companyId || !validate()) return;

    const role = normalizeRole(form.role);
    const systemAdmin = isSystemAdminRole(role);
    const selectedBranchId = props.branchId ?? "";
    const selectedStockLocationId = form.stockLocationId;

    if (!systemAdmin && !selectedBranchId) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: "Branch is required unless the user is System Admin.",
      });
      return;
    }

    setBusy(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      const created = await onboardingApi.createUser(props.companyId, {
        employeeId: form.employeeId,
        userName: form.userName.trim(),
        email: form.email.trim() || null,
        password: form.password.trim(),
        isActive: true,
        roles: [role],
        branches:
          systemAdmin || !selectedBranchId
            ? []
            : [{ branchId: selectedBranchId, isDefault: true, isActive: true }],
        stockLocations:
          systemAdmin || !selectedStockLocationId
            ? []
            : [
                {
                  stockLocationId: selectedStockLocationId,
                  isDefault: true,
                  isActive: true,
                  canReceive: true,
                  canIssue: true,
                  canTransfer: true,
                  canSell: true,
                  canAdjust: true,
                },
              ],
      } as any);

      const createdUserId = getId(created);

      if (createdUserId) {
        await onboardingApi.assignRoles(props.companyId, createdUserId, [role]);

        await onboardingApi.setUserActiveStatus(
          props.companyId,
          createdUserId,
          true,
        );

        if (!systemAdmin && selectedBranchId) {
          await onboardingApi.assignUserBranches(props.companyId, createdUserId, [
            selectedBranchId,
          ]);
        }

        if (!systemAdmin && selectedStockLocationId) {
          await onboardingApi.assignUserStockLocations(
            props.companyId,
            createdUserId,
            [selectedStockLocationId],
          );
        }
      }

      setForm({ ...EMPTY_FORM });
      await fetchAll();
      await props.onChanged?.();

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "Active employee login account created successfully.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to create employee login account."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveUserSettings() {
    if (!props.companyId || !editingUser) return;

    const userId = getId(editingUser);
    if (!userId) return;

    const nextRole = normalizeRole(editRole);
    const nextSystemAdmin = isSystemAdminRole(nextRole);

    const currentRoles = getRoles(editingUser);
    const removingLastCompanyAdmin =
      currentRoles.some((r) => isCompanyAdminRole(r)) &&
      !isCompanyAdminRole(nextRole) &&
      companyAdminCount <= 1;

    const deactivatingLastActiveUser =
      editingUser.isActive !== false && !editIsActive && activeUsersCount <= 1;

    if (removingLastCompanyAdmin) {
      props.dispatch({
        type: "SAVE_ERROR",
        error:
          "Assign another Company Admin before changing the last active Company Admin.",
      });
      return;
    }

    if (deactivatingLastActiveUser) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: "At least one active user is required for company onboarding.",
      });
      return;
    }

    setBusy(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      await onboardingApi.updateUser(props.companyId, userId, {
        email: editEmail.trim() || null,
        isActive: editIsActive,
      } as any);

      await onboardingApi.assignRoles(props.companyId, userId, [nextRole]);

      await onboardingApi.setUserActiveStatus(
        props.companyId,
        userId,
        editIsActive,
      );

      if (nextSystemAdmin) {
        await onboardingApi.assignUserBranches(props.companyId, userId, []);
        await onboardingApi.assignUserStockLocations(props.companyId, userId, []);
      } else {
        if (props.branchId) {
          await onboardingApi.assignUserBranches(props.companyId, userId, [
            props.branchId,
          ]);
        }

        await onboardingApi.assignUserStockLocations(
          props.companyId,
          userId,
          editStockLocationId ? [editStockLocationId] : [],
        );
      }

      if (editPassword.trim()) {
        if (editPassword.trim().length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }

        await onboardingApi.resetUserPassword(
          props.companyId,
          userId,
          editPassword.trim(),
        );
      }

      setEditingUser(null);
      await fetchAll();
      await props.onChanged?.();

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "User settings updated.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to update user settings."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, nextRoleRaw: string) {
    if (!props.companyId || !userId) return;

    const nextRole = normalizeRole(nextRoleRaw);
    const member = members.find((x) => getId(x) === userId);
    const currentRoles = member ? getRoles(member) : [];

    const removingLastCompanyAdmin =
      currentRoles.some((r) => isCompanyAdminRole(r)) &&
      !isCompanyAdminRole(nextRole) &&
      companyAdminCount <= 1;

    const removingLastBranchAdmin =
      currentRoles.some((r) => r.toLowerCase() === "branchadmin") &&
      nextRole.toLowerCase() !== "branchadmin" &&
      branchAdminCount <= 1;

    if (removingLastCompanyAdmin) {
      props.dispatch({
        type: "SAVE_ERROR",
        error:
          "Assign another Company Admin before changing the last active Company Admin.",
      });
      return;
    }

    if (removingLastBranchAdmin) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: "Assign another Branch Admin before changing the last Branch Admin.",
      });
      return;
    }

    setRoleBusyId(userId);
    props.dispatch({ type: "SAVE_START" });

    try {
      await onboardingApi.assignRoles(props.companyId, userId, [nextRole]);

      await onboardingApi.setUserActiveStatus(props.companyId, userId, true);

      await fetchAll();
      await props.onChanged?.();

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "User role updated.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to update user role."),
      });
    } finally {
      setRoleBusyId(null);
    }
  }

  async function removeFromBranch(userId: string) {
    if (!props.companyId || !props.branchId || !userId) return;

    const member = members.find((x) => getId(x) === userId);

    if (member && hasRole(member, "BranchAdmin") && branchAdminCount <= 1) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: "Cannot remove the last Branch Admin from this branch.",
      });
      return;
    }

    setRemoveBusyId(userId);
    props.dispatch({ type: "SAVE_START" });

    try {
      await onboardingApi.assignUserBranches(props.companyId, userId, []);
      await onboardingApi.assignUserStockLocations(props.companyId, userId, []);

      await fetchAll();
      await props.onChanged?.();

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: "User removed from branch.",
      });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to remove user from branch."),
      });
    } finally {
      setRemoveBusyId(null);
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
        <Spinner /> Loading employee accounts…
      </div>
    );
  }

  const employeeOptions = [
    { value: "", label: "— Select employee —" },
    ...employees.map((e) => ({ value: e.id, label: employeeLabel(e) })),
  ];

  const locationOptions = [
    { value: "", label: "— No stock location —" },
    ...locations
      .filter((x: any) => x.isActive !== false)
      .map((x: any) => ({
        value: String(x.id),
        label: `${x.name}${x.code ? ` (${x.code})` : ""}`,
      })),
  ];

  const selectedRole = normalizeRole(form.role);
  const selectedRoleIsSystemAdmin = isSystemAdminRole(selectedRole);

  const editRoleNormalized = normalizeRole(editRole);
  const editRoleIsSystemAdmin = isSystemAdminRole(editRoleNormalized);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loadError && (
        <Alert
          tone="danger"
          title="Unable to load employee accounts"
          message={loadError}
        />
      )}

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            background: "#fafbfc",
          }}
        >
          <SectionTitle
            title="Create employee login"
            subtitle={`Create ERP access for employees assigned to ${
              props.branchName ?? "this branch"
            }.`}
          />
        </div>

        <div
          style={{
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {Object.values(errors)
            .filter(Boolean)
            .map((msg, i) => (
              <Alert key={i} tone="danger" title="Validation" message={msg!} />
            ))}

          <div className="ob-grid-2">
            <Field label="Employee" hint={errors.employeeId}>
              <SelectInput
                value={form.employeeId}
                onChange={(value) =>
                  setForm((x) => ({ ...x, employeeId: value }))
                }
                options={employeeOptions}
              />
            </Field>

            <Field label="Role" hint={errors.role}>
              <SelectInput
                value={form.role}
                onChange={(value) =>
                  setForm((x) => ({
                    ...x,
                    role: normalizeRole(value),
                    stockLocationId: isSystemAdminRole(value)
                      ? ""
                      : x.stockLocationId,
                  }))
                }
                options={ROLE_OPTIONS as any}
              />
            </Field>

            <Field label="Username" hint={errors.userName}>
              <Input
                value={form.userName}
                onChange={(value) => setForm((x) => ({ ...x, userName: value }))}
                placeholder="username or work email"
              />
            </Field>

            <Field label="Email" hint={errors.email}>
              <Input
                value={form.email}
                onChange={(value) => setForm((x) => ({ ...x, email: value }))}
                placeholder="employee@example.com"
              />
            </Field>

            <Field label="Temporary password" hint={errors.password}>
              <Input
                type="password"
                value={form.password}
                onChange={(value) => setForm((x) => ({ ...x, password: value }))}
                placeholder="Minimum 8 characters"
              />
            </Field>

            <Field label="Stock location access">
              <SelectInput
                value={form.stockLocationId}
                onChange={(value) =>
                  setForm((x) => ({ ...x, stockLocationId: value }))
                }
                options={locationOptions}
                disabled={selectedRoleIsSystemAdmin}
              />
            </Field>
          </div>

          {selectedRoleIsSystemAdmin && (
            <Alert
              tone="warn"
              title="System Admin selected"
              message="System Admin will be created active, without branch or stock location assignment."
            />
          )}

          {!selectedRoleIsSystemAdmin && !form.stockLocationId && (
            <Alert
              tone="warn"
              title="No stock location selected"
              message="The user will be created active. Stock-location access can be configured later."
            />
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn
              variant="primary"
              onClick={() => void create()}
              disabled={
                busy ||
                !props.companyId ||
                (!selectedRoleIsSystemAdmin && !props.branchId)
              }
            >
              {busy ? "Creating…" : "Create active login account"}
            </Btn>
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            background: "#fafbfc",
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Branch users
        </div>

        <div style={{ padding: "8px 16px" }}>
          {members.length === 0 ? (
            <EmptyState
              title="No user accounts"
              sub="Create at least one active Company Admin or Branch Admin account."
            />
          ) : (
            members.map((member) => {
              const userId = getId(member);
              const roles = getRoles(member).map(normalizeRole);
              const primaryRole = normalizeRole(roles[0] ?? "Staff");
              const active = isActiveUser(member);

              return (
                <div
                  key={userId || member.email}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 220px 190px",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid #f8fafc",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {displayName(member)}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        marginTop: 2,
                      }}
                    >
                      {member.email || member.userName}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginTop: 5,
                      }}
                    >
                      {roles.map((role) => (
                        <span
                          key={role}
                          className={
                            isCompanyAdminRole(role) || role === "BranchAdmin"
                              ? "ob-badge ob-badge--success"
                              : "ob-badge"
                          }
                        >
                          {role}
                        </span>
                      ))}

                      <span
                        className={
                          active
                            ? "ob-badge ob-badge--success"
                            : "ob-badge ob-badge--warn"
                        }
                      >
                        {active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <SelectInput
                    value={primaryRole}
                    disabled={roleBusyId === userId}
                    onChange={(value) => void changeRole(userId, value)}
                    options={ROLE_OPTIONS as any}
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <Btn variant="ghost" onClick={() => startEdit(member)}>
                      Configure
                    </Btn>

                    <Btn
                      variant="ghost"
                      disabled={removeBusyId === userId}
                      onClick={() => void removeFromBranch(userId)}
                    >
                      {removeBusyId === userId ? "Removing…" : "Remove"}
                    </Btn>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editingUser && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            background: "#fff",
            padding: 16,
          }}
        >
          <SectionTitle
            title="Configure user settings"
            subtitle={`Update role, email, stock location access, active status, and password for ${displayName(
              editingUser,
            )}.`}
          />

          <div className="ob-grid-2" style={{ marginTop: 14 }}>
            <Field label="Role">
              <SelectInput
                value={editRoleNormalized}
                onChange={(value) => {
                  const role = normalizeRole(value);
                  setEditRole(role);
                  if (isSystemAdminRole(role)) setEditStockLocationId("");
                }}
                options={ROLE_OPTIONS as any}
              />
            </Field>

            <Field label="Email">
              <Input
                value={editEmail}
                onChange={setEditEmail}
                placeholder="employee@example.com"
              />
            </Field>

            <Field label="Stock location access">
              <SelectInput
                value={editStockLocationId}
                onChange={setEditStockLocationId}
                options={locationOptions}
                disabled={editRoleIsSystemAdmin}
              />
            </Field>

            <Field label="Reset password">
              <Input
                type="password"
                value={editPassword}
                onChange={setEditPassword}
                placeholder="Leave blank to keep current password"
              />
            </Field>

            <Field label="Active status">
              <SelectInput
                value={editIsActive ? "true" : "false"}
                onChange={(value) => setEditIsActive(value === "true")}
                options={[
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
              />
            </Field>
          </div>

          {editRoleIsSystemAdmin && (
            <Alert
              tone="warn"
              title="System Admin selected"
              message="Saving will remove branch and stock location assignments for this user."
            />
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <Btn variant="ghost" onClick={() => setEditingUser(null)}>
              Cancel
            </Btn>

            <Btn
              variant="primary"
              disabled={busy}
              onClick={() => void saveUserSettings()}
            >
              {busy ? "Saving…" : "Save settings"}
            </Btn>
          </div>
        </div>
      )}

      {members.length > 0 && !members.some((x) => isActiveUser(x)) && (
        <Alert
          tone="danger"
          title="No active user"
          message="At least one active user is required before company activation."
        />
      )}

      {members.length > 0 &&
        !members.some((x) => isCompanyAdmin(x) && isActiveUser(x)) && (
          <Alert
            tone="warn"
            title="Company Admin missing"
            message="At least one active Company Admin is recommended. System Admin can still finish initial setup."
          />
        )}

      {members.length > 0 &&
        !members.some((x) => hasRole(x, "BranchAdmin") && isActiveUser(x)) && (
          <Alert
            tone="warn"
            title="Branch Admin missing"
            message="At least one Branch Admin is recommended for branch-level operations."
          />
        )}
    </div>
  );
}