// src/modules/company/onboarding/steps/UsersStep.tsx

import { memo, useCallback, useEffect, useMemo, useState } from "react";
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

type FormState = {
  employeeId: string;
  userName: string;
  email: string;
  password: string;
  role: string;
  stockLocationId: string;
  isActive: boolean;
};

type AssignExistingState = {
  userId: string;
  role: string;
  stockLocationId: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type DbRoleOption = {
  id: string;
  value: string;
  label: string;
  isSystem?: boolean;
  isActive?: boolean;
};

type ScopeAssignment = {
  role: string;
  stockLocationId: string;
};

const EMPTY_FORM: FormState = {
  employeeId: "",
  userName: "",
  email: "",
  password: "",
  role: "",
  stockLocationId: "",
  isActive: true,
};

const EMPTY_ASSIGN_EXISTING: AssignExistingState = {
  userId: "",
  role: "",
  stockLocationId: "",
};

const ROLE_POLICY = {
  companyAdmin: "COMPANYADMIN",
  branchAdmin: "BRANCHADMIN",
  requiresStockLocation: new Set([
    "STOREMANAGER",
    "STOREKEEPER",
    "WAREHOUSEMANAGER",
    "KITCHENMANAGER",
    "KITCHEN",
    "BARMAN",
    "BARMANAGER",
    "PURCHASINGOFFICER",
    "PRODUCTIONMANAGER",
    "CASHIER",
    "INVENTORYCLERK",
    "INVENTORYCONTROLLER",
    "FNBCONTROLLER",
  ]),
  canReceive: new Set(["STOREKEEPER", "WAREHOUSEMANAGER", "PURCHASINGOFFICER", "INVENTORYCONTROLLER"]),
  canIssue: new Set([
    "STOREKEEPER",
    "WAREHOUSEMANAGER",
    "KITCHEN",
    "KITCHENMANAGER",
    "PRODUCTIONMANAGER",
    "BARMAN",
    "BARMANAGER",
    "INVENTORYCONTROLLER",
  ]),
  canTransfer: new Set(["STOREKEEPER", "WAREHOUSEMANAGER", "PRODUCTIONMANAGER", "INVENTORYCONTROLLER"]),
  canSell: new Set(["STOREMANAGER", "CASHIER", "BARMAN", "BARMANAGER"]),
  canAdjust: new Set(["WAREHOUSEMANAGER", "FNBCONTROLLER", "INVENTORYCONTROLLER"]),
};

function stringId(value: unknown): string {
  return String(value ?? "").trim();
}

function idOf(value: any): string {
  return stringId(value?.id ?? value?.Id ?? value?.userId ?? value?.employeeId);
}

function stockLocationIdOf(value: any): string {
  return stringId(value?.stockLocationId ?? value?.StockLocationId ?? value?.id ?? value?.Id);
}

function normalizeRole(role: unknown): string {
  return String(role ?? "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toUpperCase();
}

function roleDisplay(value: unknown): string {
  return String(value ?? "").trim() || "Role";
}

function rolesOf(value: any): string[] {
  if (Array.isArray(value?.roles)) {
    return value.roles
      .filter(Boolean)
      .map((x: any) => normalizeRole(x?.value ?? x?.name ?? x));
  }

  if (Array.isArray(value?.roleNames)) return value.roleNames.filter(Boolean).map(normalizeRole);

  if (typeof value?.roles === "string") return value.roles.split(",").map(normalizeRole).filter(Boolean);

  return [value?.role, value?.roleName, value?.primaryRole].filter(Boolean).map(normalizeRole);
}

function hasRole(value: any, role: string): boolean {
  const expected = normalizeRole(role);
  return rolesOf(value).some((r) => r === expected);
}

function isCompanyAdminRole(role: string): boolean {
  return normalizeRole(role) === ROLE_POLICY.companyAdmin;
}

function isBranchAdminRole(role: string): boolean {
  return normalizeRole(role) === ROLE_POLICY.branchAdmin;
}

function isPrivilegedBranchRole(role: string): boolean {
  return isCompanyAdminRole(role) || isBranchAdminRole(role);
}

function activeUser(value: any): boolean {
  return value?.isActive !== false;
}

function displayName(value: any): string {
  return (
    value?.employeeName ??
    value?.employee?.fullName ??
    value?.fullName ??
    value?.name ??
    value?.userName ??
    value?.email ??
    "-"
  );
}

function employeeLabel(e: EmployeeLookupDto): string {
  const x = e as any;
  return `${x.employeeCode ? `${x.employeeCode} - ` : ""}${x.fullName ?? x.workEmail ?? "Employee"}`;
}

function userLabel(user: CompanyUserDto): string {
  const email = (user as any).email ?? (user as any).userName;
  return `${displayName(user)}${email ? ` - ${email}` : ""}`;
}

function locationName(locations: StockLocation[], id?: string | null): string {
  const target = stringId(id);
  if (!target) return "No stock location";

  const found = locations.find((x: any) => stockLocationIdOf(x) === target);
  return found ? `${(found as any).name}${(found as any).code ? ` (${(found as any).code})` : ""}` : target;
}

function requiresLocation(role: string): boolean {
  return ROLE_POLICY.requiresStockLocation.has(normalizeRole(role));
}

function capabilities(role: string) {
  const r = normalizeRole(role);
  const admin = isPrivilegedBranchRole(r);

  return {
    canReceive: admin || ROLE_POLICY.canReceive.has(r),
    canIssue: admin || ROLE_POLICY.canIssue.has(r),
    canTransfer: admin || ROLE_POLICY.canTransfer.has(r),
    canSell: admin || ROLE_POLICY.canSell.has(r),
    canAdjust: isCompanyAdminRole(r) || ROLE_POLICY.canAdjust.has(r),
  };
}

function mapRoleOptions(rows: any[]): DbRoleOption[] {
  return rows
    .filter((r) => r?.isActive !== false)
    .filter((r) => r?.isSystem !== true)
    .map((r) => {
      const value = normalizeRole(r?.value ?? r?.normalizedName ?? r?.name ?? r?.displayName);
      const label = roleDisplay(r?.displayName ?? r?.label ?? r?.name ?? r?.value);

      return {
        id: String(r?.id ?? value),
        value,
        label,
        isSystem: r?.isSystem,
        isActive: r?.isActive,
      };
    })
    .filter((r) => r.value)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function validateScopeAssignment(scope: ScopeAssignment): FieldErrors {
  const next: FieldErrors = {};
  const role = normalizeRole(scope.role);

  if (!role) next.role = "Role is required.";
  if (requiresLocation(role) && !scope.stockLocationId) {
    next.stockLocationId = `${role} requires a default stock location assignment.`;
  }

  return next;
}

async function listCompanyUsers(companyId: string): Promise<CompanyUserDto[]> {
  const api = onboardingApi as any;
  const loader = api.listCompanyUsers ?? api.listUsers ?? api.listCompanyUserAccounts;

  if (typeof loader !== "function") return [];

  const result = await loader(companyId);
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.users)) return result.users;
  if (Array.isArray(result?.items)) return result.items;
  return [];
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

const CreateUserForm = memo(function CreateUserForm(props: {
  form: FormState;
  errors: FieldErrors;
  employeeOptions: SelectOption[];
  roleOptions: SelectOption[];
  locationOptions: SelectOption[];
  busy: boolean;
  saving: boolean;
  disabled: boolean;
  onChange: React.Dispatch<React.SetStateAction<FormState>>;
  onCreate: () => void;
}) {
  const set = useCallback(
    (patch: Partial<FormState>) => props.onChange((current) => ({ ...current, ...patch })),
    [props],
  );

  return (
    <div className="ob-inner-card">
      <div className="ob-inner-card-body">
        <SectionTitle
          title="Create login account"
          subtitle="Create a company user and immediately assign role, branch, and stock-location scope."
        />

        {Object.values(props.errors)
          .filter(Boolean)
          .map((message) => (
            <Alert key={message} tone="danger" title="Validation" message={message!} />
          ))}

        <div className="ob-grid-2">
          <Field label="Employee" required error={props.errors.employeeId}>
            <SelectInput value={props.form.employeeId} onChange={(v) => set({ employeeId: v })} options={props.employeeOptions as any} />
          </Field>

          <Field label="Role" required error={props.errors.role}>
            <SelectInput value={props.form.role} onChange={(v) => set({ role: v })} options={props.roleOptions as any} />
          </Field>

          <Field label="Username" required error={props.errors.userName}>
            <Input value={props.form.userName} onChange={(v) => set({ userName: v })} />
          </Field>

          <Field label="Email" error={props.errors.email}>
            <Input value={props.form.email} onChange={(v) => set({ email: v })} />
          </Field>

          <Field label="Temporary password" required error={props.errors.password}>
            <Input value={props.form.password} onChange={(v) => set({ password: v })} type="password" />
          </Field>

          <Field label="Default stock location" required={requiresLocation(props.form.role)} error={props.errors.stockLocationId}>
            <SelectInput value={props.form.stockLocationId} onChange={(v) => set({ stockLocationId: v })} options={props.locationOptions as any} />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="primary" disabled={props.busy || props.saving || props.disabled} onClick={() => props.onCreate()}>
            {props.busy ? "Saving..." : "Create user"}
          </Btn>
        </div>
      </div>
    </div>
  );
});

const AssignExistingUserForm = memo(function AssignExistingUserForm(props: {
  value: AssignExistingState;
  errors: FieldErrors;
  userOptions: SelectOption[];
  roleOptions: SelectOption[];
  locationOptions: SelectOption[];
  busy: boolean;
  saving: boolean;
  disabled: boolean;
  onChange: React.Dispatch<React.SetStateAction<AssignExistingState>>;
  onAssign: () => void;
}) {
  const set = useCallback(
    (patch: Partial<AssignExistingState>) => props.onChange((current) => ({ ...current, ...patch })),
    [props],
  );

  return (
    <div className="ob-inner-card">
      <div className="ob-inner-card-body">
        <SectionTitle
          title="Assign existing user to branch"
          subtitle="Use this when the login already exists at company level and only needs access to the selected branch."
        />

        {Object.values(props.errors)
          .filter(Boolean)
          .map((message) => (
            <Alert key={message} tone="danger" title="Validation" message={message!} />
          ))}

        <div className="ob-grid-2">
          <Field label="Existing user" required error={props.errors.userId}>
            <SelectInput value={props.value.userId} onChange={(v) => set({ userId: v })} options={props.userOptions as any} />
          </Field>

          <Field label="Branch role" required error={props.errors.role}>
            <SelectInput value={props.value.role} onChange={(v) => set({ role: v })} options={props.roleOptions as any} />
          </Field>

          <Field label="Default stock location" required={requiresLocation(props.value.role)} error={props.errors.stockLocationId}>
            <SelectInput value={props.value.stockLocationId} onChange={(v) => set({ stockLocationId: v })} options={props.locationOptions as any} />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="primary" disabled={props.busy || props.saving || props.disabled} onClick={() => props.onAssign()}>
            {props.busy ? "Assigning..." : "Assign to branch"}
          </Btn>
        </div>
      </div>
    </div>
  );
});

const EditUserPanel = memo(function EditUserPanel(props: {
  editingUser: CompanyUserDto;
  editRole: string;
  editEmail: string;
  editStockLocationId: string;
  editPassword: string;
  roleOptions: SelectOption[];
  locationOptions: SelectOption[];
  busy: boolean;
  saving: boolean;
  onRoleChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="ob-inner-card">
      <div className="ob-inner-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionTitle title="Configure user settings" subtitle={`Update access for ${displayName(props.editingUser)}.`} />

        <div className="ob-grid-2">
          <Field label="Role" required>
            <SelectInput value={props.editRole} onChange={props.onRoleChange} options={props.roleOptions as any} />
          </Field>

          <Field label="Email">
            <Input value={props.editEmail} onChange={props.onEmailChange} />
          </Field>

          <Field label="Default stock location" required={requiresLocation(props.editRole)}>
            <SelectInput value={props.editStockLocationId} onChange={props.onLocationChange} options={props.locationOptions as any} />
          </Field>

          <Field label="Reset password">
            <Input value={props.editPassword} onChange={props.onPasswordChange} type="password" placeholder="Leave blank to keep current password" />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Btn variant="ghost" onClick={props.onCancel}>Cancel</Btn>
          <Btn variant="primary" disabled={props.busy || props.saving} onClick={() => props.onSave()}>
            {props.busy ? "Saving..." : "Save user"}
          </Btn>
        </div>
      </div>
    </div>
  );
});

export function UsersStep(props: Props) {
  const [members, setMembers] = useState<CompanyUserDto[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUserDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeLookupDto[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [roles, setRoles] = useState<DbRoleOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [assignExisting, setAssignExisting] = useState<AssignExistingState>({ ...EMPTY_ASSIGN_EXISTING });
  const [assignErrors, setAssignErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const [editingUser, setEditingUser] = useState<CompanyUserDto | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStockLocationId, setEditStockLocationId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const activeUsers = useMemo(() => members.filter(activeUser), [members]);

  const companyAdmins = useMemo(
    () => members.filter((m) => activeUser(m) && hasRole(m, ROLE_POLICY.companyAdmin)),
    [members],
  );

  const branchManagers = useMemo(
    () => members.filter((m) => activeUser(m) && rolesOf(m).some(isPrivilegedBranchRole)),
    [members],
  );

  const fetchAll = useCallback(async () => {
    if (!props.companyId || !props.branchId) {
      setMembers([]);
      setCompanyUsers([]);
      setEmployees([]);
      setLocations([]);
      setRoles([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [users, allCompanyUsers, lookup, locs, dbRoles] = await Promise.all([
        onboardingApi.listBranchUsers(props.companyId, props.branchId),
        listCompanyUsers(props.companyId),
        onboardingApi.listAvailableEmployees(props.companyId, props.branchId),
        onboardingApi.listStockLocations(props.companyId, props.branchId),
        onboardingApi.listRoles(props.companyId),
      ]);

      setMembers(Array.isArray(users) ? users : []);
      setCompanyUsers(Array.isArray(allCompanyUsers) ? allCompanyUsers : []);
      setEmployees(
        Array.isArray((lookup as any)?.employees)
          ? (lookup as any).employees
          : Array.isArray(lookup)
            ? (lookup as any)
            : [],
      );
      setLocations(Array.isArray(locs) ? locs : []);
      setRoles(mapRoleOptions(Array.isArray(dbRoles) ? dbRoles : []));
    } catch (err) {
      setLoadError(extractApiError(err, "Failed to load users, employees, roles, and stock locations."));
      setMembers([]);
      setCompanyUsers([]);
      setEmployees([]);
      setLocations([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [props.companyId, props.branchId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const selectedEmployee = useMemo(
    () => employees.find((e: any) => idOf(e) === form.employeeId),
    [employees, form.employeeId],
  );

  useEffect(() => {
    if (!selectedEmployee) return;

    setForm((current) => ({
      ...current,
      email: current.email || (selectedEmployee as any).workEmail || "",
      userName: current.userName || (selectedEmployee as any).workEmail || (selectedEmployee as any).employeeCode || "",
    }));
  }, [selectedEmployee]);

  const roleOptions = useMemo<SelectOption[]>(
    () => [{ value: "", label: "- Select role -" }, ...roles.map((role) => ({ value: role.value, label: role.label }))],
    [roles],
  );

  const locationOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "- No default stock location -" },
      ...locations.map((x: any) => ({ value: stockLocationIdOf(x), label: `${x.name}${x.code ? ` (${x.code})` : ""}` })),
    ],
    [locations],
  );

  const employeeOptions = useMemo<SelectOption[]>(
    () => [{ value: "", label: "- Select employee -" }, ...employees.map((e) => ({ value: idOf(e), label: employeeLabel(e) }))],
    [employees],
  );

  const assignableUserOptions = useMemo<SelectOption[]>(() => {
    const memberIds = new Set(members.map(idOf).filter(Boolean));
    const candidates = companyUsers.filter((u) => {
      const userId = idOf(u);
      return userId && !memberIds.has(userId);
    });

    return [{ value: "", label: "- Select existing user -" }, ...candidates.map((u) => ({ value: idOf(u), label: userLabel(u) }))];
  }, [companyUsers, members]);

  const validateCreate = useCallback(() => {
    const next: FieldErrors = validateScopeAssignment({ role: form.role, stockLocationId: form.stockLocationId });

    if (!form.employeeId) next.employeeId = "Employee is required.";
    if (!form.userName.trim()) next.userName = "Username is required.";
    if (form.email && !isEmail(form.email)) next.email = "Valid email is required.";
    if (!form.password || form.password.trim().length < 8) next.password = "Password must be at least 8 characters.";
    if (!props.branchId) next.branchId = "Branch is required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, props.branchId]);

  const validateAssignExisting = useCallback(() => {
    const next: FieldErrors = validateScopeAssignment(assignExisting);
    if (!assignExisting.userId) next.userId = "Existing user is required.";
    if (!props.branchId) next.branchId = "Branch is required.";

    setAssignErrors(next);
    return Object.keys(next).length === 0;
  }, [assignExisting, props.branchId]);

  const assignBranchScope = useCallback(
    async (userId: string, scope: ScopeAssignment) => {
      if (!props.companyId || !props.branchId) return;

      const role = normalizeRole(scope.role);

      await onboardingApi.assignRoles(props.companyId, userId, [role]);
      await onboardingApi.assignUserBranches(props.companyId, userId, [
        {
          branchId: props.branchId,
          isDefault: true,
          isActive: true,
        },
      ]);

      await onboardingApi.assignUserStockLocations(
        props.companyId,
        userId,
        scope.stockLocationId
          ? [
              {
                stockLocationId: scope.stockLocationId,
                branchId: props.branchId,
                isDefault: true,
                isActive: true,
                ...capabilities(role),
              },
            ]
          : [],
      );
    },
    [props.companyId, props.branchId],
  );

  const createUser = useCallback(async () => {
    if (!props.companyId || !validateCreate()) return;

    const role = normalizeRole(form.role);
    const scope = { role, stockLocationId: form.stockLocationId };

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
        branches: props.branchId ? [props.branchId] : [],
        stockLocations: form.stockLocationId
          ? [
              {
                stockLocationId: form.stockLocationId,
                branchId: props.branchId,
                isDefault: true,
                isActive: true,
                ...capabilities(role),
              },
            ]
          : [],
      } as any);

      const userId = idOf(created);

      if (userId) {
        await onboardingApi.setUserActiveStatus(props.companyId, userId, true);
        await assignBranchScope(userId, scope);
      }

      setForm({ ...EMPTY_FORM });
      setErrors({});

      await fetchAll();
      await props.onChanged?.();

      props.dispatch({
        type: "SAVE_SUCCESS",
        notice: isCompanyAdminRole(role)
          ? "Company Admin created and assigned to this branch. BranchAdmin is not required for company admin users."
          : "Employee login account created and assigned to this branch.",
      });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to create employee login account.") });
    } finally {
      setBusy(false);
    }
  }, [assignBranchScope, fetchAll, form, props, validateCreate]);

  const assignExistingUser = useCallback(async () => {
    if (!props.companyId || !validateAssignExisting()) return;

    const scope = { role: normalizeRole(assignExisting.role), stockLocationId: assignExisting.stockLocationId };

    setBusy(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      await onboardingApi.setUserActiveStatus(props.companyId, assignExisting.userId, true);
      await assignBranchScope(assignExisting.userId, scope);

      setAssignExisting({ ...EMPTY_ASSIGN_EXISTING });
      setAssignErrors({});

      await fetchAll();
      await props.onChanged?.();

      props.dispatch({ type: "SAVE_SUCCESS", notice: "Existing user assigned to this branch." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to assign existing user to branch.") });
    } finally {
      setBusy(false);
    }
  }, [assignBranchScope, assignExisting, fetchAll, props, validateAssignExisting]);

  const startEdit = useCallback((member: CompanyUserDto) => {
    const primary = rolesOf(member)[0] ?? "";

    setEditingUser(member);
    setEditRole(primary);
    setEditEmail((member as any).email ?? "");
    setEditStockLocationId(stringId((member as any).defaultStockLocationId ?? (member as any).stockLocationId));
    setEditPassword("");
    setEditIsActive((member as any).isActive !== false);
  }, []);

  const saveUser = useCallback(async () => {
    if (!props.companyId || !editingUser) return;

    const userId = idOf(editingUser);
    const nextRole = normalizeRole(editRole);
    if (!userId) return;

    const scopeErrors = validateScopeAssignment({ role: nextRole, stockLocationId: editStockLocationId });
    if (Object.keys(scopeErrors).length) {
      props.dispatch({ type: "SAVE_ERROR", error: Object.values(scopeErrors).filter(Boolean).join(" ") });
      return;
    }

    if (hasRole(editingUser, ROLE_POLICY.companyAdmin) && !isCompanyAdminRole(nextRole) && companyAdmins.length <= 1) {
      props.dispatch({ type: "SAVE_ERROR", error: "Assign another Company Admin before changing the last active Company Admin." });
      return;
    }

    if ((editingUser as any).isActive !== false && !editIsActive && activeUsers.length <= 1) {
      props.dispatch({ type: "SAVE_ERROR", error: "At least one active user is required." });
      return;
    }

    if (editPassword.trim() && editPassword.trim().length < 8) {
      props.dispatch({ type: "SAVE_ERROR", error: "Password must be at least 8 characters." });
      return;
    }

    setBusy(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      await onboardingApi.updateUser(props.companyId, userId, {
        email: editEmail.trim() || null,
        isActive: editIsActive,
      } as any);

      await onboardingApi.setUserActiveStatus(props.companyId, userId, editIsActive);
      await assignBranchScope(userId, { role: nextRole, stockLocationId: editStockLocationId });

      if (editPassword.trim()) await onboardingApi.resetUserPassword(props.companyId, userId, editPassword.trim());

      setEditingUser(null);

      await fetchAll();
      await props.onChanged?.();

      props.dispatch({ type: "SAVE_SUCCESS", notice: "User settings updated." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update user settings.") });
    } finally {
      setBusy(false);
    }
  }, [activeUsers.length, assignBranchScope, companyAdmins.length, editEmail, editIsActive, editPassword, editRole, editStockLocationId, editingUser, fetchAll, props]);

  const removeFromBranch = useCallback(
    async (userId: string) => {
      if (!props.companyId || !userId) return;

      setBusy(true);
      props.dispatch({ type: "SAVE_START" });

      try {
        const api = onboardingApi as any;
        if (typeof api.removeUserBranch === "function" && props.branchId) {
          await api.removeUserBranch(props.companyId, userId, props.branchId);
        } else {
          await onboardingApi.assignUserBranches(props.companyId, userId, [] as any);
          await onboardingApi.assignUserStockLocations(props.companyId, userId, []);
        }

        await fetchAll();
        await props.onChanged?.();

        props.dispatch({ type: "SAVE_SUCCESS", notice: "User removed from this branch." });
      } catch (err) {
        props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to remove user from branch.") });
      } finally {
        setBusy(false);
      }
    },
    [fetchAll, props],
  );

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "24px 0", color: "#64748b" }}>
        <Spinner /> Loading users...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!props.companyId || !props.branchId ? (
        <Alert tone="warn" title="Select branch first" message="Users are created at company level and scoped to branch/stock-location access." />
      ) : null}

      {loadError && <Alert tone="danger" title="Unable to load users" message={loadError} />}

      {roles.length === 0 && props.companyId && (
        <Alert tone="warn" title="No roles found" message="No active company roles were found. Seed or create roles before adding users." />
      )}

      <div className="ob-grid-3">
        <Summary label="Active users" value={activeUsers.length} />
        <Summary label="Company admins" value={companyAdmins.length} />
        <Summary label="Branch managers" value={branchManagers.length} />
      </div>

      {companyAdmins.length === 0 && (
        <Alert tone="warn" title="Company Admin required" message="Create or assign at least one active Company Admin. Company Admin can manage branches without a separate BranchAdmin role." />
      )}

      <CreateUserForm
        form={form}
        errors={errors}
        employeeOptions={employeeOptions}
        roleOptions={roleOptions}
        locationOptions={locationOptions}
        busy={busy}
        saving={props.saving}
        disabled={!props.companyId || !props.branchId || roles.length === 0}
        onChange={setForm}
        onCreate={createUser}
      />

      <AssignExistingUserForm
        value={assignExisting}
        errors={assignErrors}
        userOptions={assignableUserOptions}
        roleOptions={roleOptions}
        locationOptions={locationOptions}
        busy={busy}
        saving={props.saving}
        disabled={!props.companyId || !props.branchId || roles.length === 0 || assignableUserOptions.length <= 1}
        onChange={setAssignExisting}
        onAssign={assignExistingUser}
      />

      <div className="ob-inner-card">
        <div className="ob-inner-card-body">
          <SectionTitle title="Branch user access" subtitle="CompanyAdmin users can manage this branch without a separate BranchAdmin assignment." />

          {members.length === 0 ? (
            <EmptyState title="No user accounts" sub="Create or assign at least one active Company Admin account." />
          ) : (
            members.map((m) => {
              const userId = idOf(m);
              const rolesForUser = rolesOf(m);
              const primary = rolesForUser[0] ?? "";
              const userStockLocationId = stringId((m as any).defaultStockLocationId ?? (m as any).stockLocationId);

              return (
                <div
                  key={userId || (m as any).email}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 180px 220px auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #f8fafc",
                  }}
                >
                  <div>
                    <strong>{displayName(m)}</strong>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{(m as any).email ?? (m as any).userName}</div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                      {rolesForUser.map((r) => (
                        <span key={r} className={isPrivilegedBranchRole(r) ? "ob-badge ob-badge--success" : "ob-badge"}>
                          {r}
                        </span>
                      ))}

                      <span className={activeUser(m) ? "ob-badge ob-badge--success" : "ob-badge ob-badge--warn"}>
                        {activeUser(m) ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <span className="ob-badge">{primary || "No role"}</span>

                  <div style={{ color: "#64748b", fontSize: 12 }}>{locationName(locations, userStockLocationId)}</div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Btn variant="ghost" onClick={() => startEdit(m)}>Configure</Btn>
                    <Btn variant="ghost" onClick={() => void removeFromBranch(userId)} disabled={busy}>Remove</Btn>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editingUser && (
        <EditUserPanel
          editingUser={editingUser}
          editRole={editRole}
          editEmail={editEmail}
          editStockLocationId={editStockLocationId}
          editPassword={editPassword}
          roleOptions={roleOptions}
          locationOptions={locationOptions}
          busy={busy}
          saving={props.saving}
          onRoleChange={setEditRole}
          onEmailChange={setEditEmail}
          onLocationChange={setEditStockLocationId}
          onPasswordChange={setEditPassword}
          onCancel={() => setEditingUser(null)}
          onSave={saveUser}
        />
      )}
    </div>
  );
}
