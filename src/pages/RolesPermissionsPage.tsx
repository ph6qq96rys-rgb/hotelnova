import { useCallback, useEffect, useMemo, useState } from "react";

import {
  securityApi,
  type PermissionCatalogItem,
  type RoleDto,
} from "../modules/security/api/securityApi";
import { usersApi } from "../modules/security/api/usersApi";
import {
  addUserRoleAssignment,
  removeUserRoleAssignment,
} from "../modules/security/api/userAssignmentsApi";

import { useAppScope } from "../app/useAppScope";
import { useBranches } from "../modules/security/hooks/useBranches";
import { useEffectivePermissions } from "../modules/security/hooks/useEffectivePermissions";
import { useUsers } from "../modules/security/hooks/useUsers";
import { useUserSearch } from "../modules/security/hooks/useUserSearch";
import { useUser } from "../modules/security/hooks/useUsers";

// ----------------------------
// Styling helpers (Luxury / Professional)
// ----------------------------
const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm " +
  "outline-none placeholder:text-white/40 " +
  "focus:border-white/20 focus:bg-white/[0.05] transition";

const selectClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm " +
  "outline-none focus:border-white/20 focus:bg-white/[0.05] transition";

const chipClass =
  "inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] " +
  "px-2.5 py-1 text-xs text-white/85";

function normalize(s?: string | null) {
  return (s ?? "").trim().toLowerCase();
}

function userLabel(u: any) {
  return u.fullName ?? u.email ?? u.id;
}

function uniqSorted(list: string[]) {
  return Array.from(new Set(list.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function groupLabel(group?: string | null) {
  const g = normalize(group);
  if (!g) return "General";
  // Title-case-ish
  return g
    .split(/[-_.\s]+/g)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function SoftDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />;
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[11px] tracking-wide text-white/50">{label}</div>
      <div className="text-sm font-semibold text-white/90">{value}</div>
    </div>
  );
}

function SkeletonLine() {
  return <div className="h-3 w-full animate-pulse rounded bg-white/10" />;
}

function ToggleRow({
  title,
  subtitle,
  right,
  onClick,
  disabled,
}: {
  title: string;
  subtitle?: string | null;
  right: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={[
        "group flex items-start justify-between gap-4 rounded-2xl border border-white/10",
        "bg-white/[0.02] p-3.5",
        "transition hover:bg-white/[0.04]",
        disabled ? "opacity-60" : "cursor-pointer",
      ].join(" ")}
      onClick={disabled ? undefined : onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : -1}
      onKeyDown={(e) => {
        if (!onClick || disabled) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white/90">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-xs leading-snug text-white/55">{subtitle}</div>
        ) : null}
      </div>

      <div className="shrink-0">{right}</div>
    </div>
  );
}

function LuxSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      className={[
        "relative h-7 w-12 rounded-full border transition",
        checked
          ? "border-white/20 bg-white/20"
          : "border-white/10 bg-white/[0.04]",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-white/[0.06]",
      ].join(" ")}
      onClick={() => onChange(!checked)}
    >
      <span
        className={[
          "absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white/80",
          "shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition",
          checked ? "left-6" : "left-1",
        ].join(" ")}
      />
    </button>
  );
}

export default function AssignAccessPage() {
  const { companyId } = useAppScope();

  // ----------------------------
  // Users (search + list)
  // ----------------------------
  const [userQuery, setUserQuery] = useState("");

  const {
    users: allUsers = [],
    loading: usersLoading,
    error: usersError,
    refresh: refreshUsers,
  } = useUsers(companyId);

  const {
    results: searchedUsers = [],
    loading: searchLoading,
    error: searchError,
  } = useUserSearch(userQuery);

  const userOptions = useMemo(() => {
    const q = normalize(userQuery);
    return q ? searchedUsers : allUsers;
  }, [userQuery, searchedUsers, allUsers]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const {
    user: userDetail,
    loading: userLoading,
    error: userError,
    refresh: refreshUser,
  } = useUser(companyId, selectedUserId);

  // ----------------------------
  // Branches
  // ----------------------------
  const {
    branches = [],
    loading: branchesLoading,
    error: branchesError,
  } = useBranches(companyId);

  // ----------------------------
  // Roles
  // ----------------------------
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      const res = await securityApi.listRoles(companyId);
      setRoles(res.data ?? []);
      setRolesError(null);
    } catch (e: unknown) {
      setRolesError(e instanceof Error ? e.message : "Failed to load roles.");
    } finally {
      setRolesLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    loadRoles();
  }, [companyId, loadRoles]);

  // ----------------------------
  // Direct permissions
  // ----------------------------
  const [directPerms, setDirectPerms] = useState<Set<string>>(new Set());
  const [permQuery, setPermQuery] = useState("");
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionCatalogItem[]>([]);
  const [permLoading, setPermLoading] = useState(true);
  const [permError, setPermError] = useState<string | null>(null);

  const loadPermissionsCatalog = useCallback(async () => {
    try {
      setPermLoading(true);
      const perms = await securityApi.listPermissions(companyId);
      setPermissionsCatalog(perms.data ?? []);
      setPermError(null);
    } catch (e: unknown) {
      setPermError(
        e instanceof Error ? e.message : "Failed to load permissions catalog."
      );
    } finally {
      setPermLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    loadPermissionsCatalog();
  }, [companyId, loadPermissionsCatalog]);

  useEffect(() => {
    (async () => {
      if (!companyId || !selectedUserId) {
        setDirectPerms(new Set());
        return;
      }
      try {
        const keys = await usersApi.getUserPermissions(companyId, selectedUserId);
        setDirectPerms(new Set((keys ?? []).filter(Boolean)));
      } catch {
        setDirectPerms(new Set());
      }
    })();
  }, [companyId, selectedUserId]);

  const filteredPermCatalog = useMemo(() => {
    const q = normalize(permQuery);
    if (!q) return permissionsCatalog;
    return permissionsCatalog.filter((p) => {
      const hay = [p.key, p.group, p.description].map(normalize).join(" • ");
      return hay.includes(q);
    });
  }, [permissionsCatalog, permQuery]);

  // Group permissions by group for better scanability
  const groupedPermCatalog = useMemo(() => {
    const map = new Map<string, PermissionCatalogItem[]>();
    for (const p of filteredPermCatalog) {
      const g = groupLabel(p.group);
      map.set(g, [...(map.get(g) ?? []), p]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredPermCatalog]);

  const toggleDirectPerm = useCallback((key: string) => {
    setDirectPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ----------------------------
  // Effective permissions
  // ----------------------------
  const roleAssignments = useMemo(() => {
    if (!selectedUserId) return [];
    const a = userDetail?.assignments ?? [];
    return a.map((x: any) => ({ roleId: x.roleId, branchId: x.branchId ?? null }));
  }, [selectedUserId, userDetail]);

  const { state: effectiveState, effective } = useEffectivePermissions(
    companyId,
    roleAssignments,
    selectedUserId ? Array.from(directPerms) : []
  );

  // ----------------------------
  // UI state
  // ----------------------------
  const [newBranchId, setNewBranchId] = useState<string>("");
  const [newRoleId, setNewRoleId] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"direct" | "effective">("direct");

  const canInteract = !!companyId && !!selectedUserId;

  useEffect(() => {
    setErrorBanner(null);
    setNewRoleId("");
    setNewBranchId("");
    setActiveTab("direct");
  }, [selectedUserId]);

  const onAddAssignment = useCallback(async () => {
    if (!canInteract) return;
    if (!newRoleId) {
      setErrorBanner("Select a role.");
      return;
    }

    setErrorBanner(null);
    setSavingRole(true);
    try {
      await addUserRoleAssignment(companyId, {
        userId: selectedUserId,
        roleId: newRoleId,
        branchId: newBranchId || null,
      });

      await Promise.all([refreshUser(), refreshUsers()]);
      setNewRoleId("");
    } catch (e: unknown) {
      setErrorBanner(e instanceof Error ? e.message : "Failed to add role assignment.");
    } finally {
      setSavingRole(false);
    }
  }, [
    canInteract,
    companyId,
    selectedUserId,
    newRoleId,
    newBranchId,
    refreshUser,
    refreshUsers,
  ]);

  const onRemoveAssignment = useCallback(
    async (assignmentId: string) => {
      if (!canInteract) return;
      setErrorBanner(null);
      setSavingRole(true);
      try {
        await removeUserRoleAssignment(companyId, {
          userId: selectedUserId,
          assignmentId,
        });
        await refreshUser();
      } catch (e: unknown) {
        setErrorBanner(
          e instanceof Error ? e.message : "Failed to remove role assignment."
        );
      } finally {
        setSavingRole(false);
      }
    },
    [canInteract, companyId, selectedUserId, refreshUser]
  );

  const onSaveDirectPermissions = useCallback(async () => {
    if (!canInteract) return;
    setErrorBanner(null);
    setSavingPerms(true);
    try {
      await usersApi.setUserPermissions(companyId, {
        userId: selectedUserId,
        permissionKeys: uniqSorted(Array.from(directPerms)),
      });

      const keys = await usersApi.getUserPermissions(companyId, selectedUserId);
      setDirectPerms(new Set((keys ?? []).filter(Boolean)));
    } catch (e: unknown) {
      setErrorBanner(
        e instanceof Error ? e.message : "Failed to save direct permissions."
      );
    } finally {
      setSavingPerms(false);
    }
  }, [canInteract, companyId, selectedUserId, directPerms]);

  if (!companyId) {
    return (
      <div className="hna-page">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Missing companyId in route. Navigate via /companies/:companyId/...
        </div>
      </div>
    );
  }

  const selectedUserName =
    selectedUserId ? userLabel(userOptions.find((u: any) => u.id === selectedUserId) ?? userDetail) : "No user selected";

  const assignments = userDetail?.assignments ?? [];

  return (
    <div className="hna-page">
      {/* Luxury header */}
      <div className="mb-5 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] tracking-wide text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              SECURITY • ACCESS CONTROL
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white/95">
              Access
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/60">
              Assign branch-scoped roles, set direct permissions, and review effective access.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <StatPill label="Selected user" value={<span className="truncate">{selectedUserName}</span>} />
            <StatPill label="Assignments" value={canInteract ? assignments.length : "—"} />
            <StatPill
              label="Effective perms"
              value={
                canInteract
                  ? effectiveState.status === "loading"
                    ? "…"
                    : effective.length
                  : "—"
              }
            />
          </div>
        </div>

        {errorBanner && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorBanner}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        {/* LEFT PANEL (sticky) */}
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-white/90">User</div>
              <span className="text-[11px] text-white/45">
                {usersLoading || searchLoading ? "Loading…" : `${userOptions.length} shown`}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search users…"
                className={inputClass}
              />

              {(usersError || searchError) && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {usersError ? `Users: ${usersError}` : null}
                  {searchError ? ` Search: ${searchError}` : null}
                </div>
              )}

              <select
                value={selectedUserId ?? ""}
                onChange={(e) => setSelectedUserId(e.target.value || null)}
                className={selectClass}
              >
                <option value="">Select user…</option>
                {userOptions.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>

              {selectedUserId && (userLoading || userError) && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
                  {userLoading ? "Loading user…" : null}
                  {userError ? `Failed: ${userError}` : null}
                </div>
              )}
            </div>

            <div className="my-4">
              <SoftDivider />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-white/90">Role assignments</div>
              <span className="text-[11px] text-white/45">
                {canInteract ? `${assignments.length} assigned` : "—"}
              </span>
            </div>

            {/* Add assignment (premium inset) */}
            <div className="mt-3 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-4">
              <div className="text-xs font-semibold tracking-wide text-white/70">
                ADD ASSIGNMENT
              </div>

              <div className="mt-3 grid gap-3">
                <label className="grid gap-1">
                  <span className="text-[11px] text-white/50">Branch</span>
                  <select
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    className={selectClass}
                    disabled={!canInteract || savingRole || branchesLoading}
                  >
                    <option value="">All branches (no scope)</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name ?? b.branchName ?? b.id}
                      </option>
                    ))}
                  </select>
                  {branchesError && (
                    <div className="text-[11px] text-red-200">Branches: {branchesError}</div>
                  )}
                </label>

                <label className="grid gap-1">
                  <span className="text-[11px] text-white/50">Role</span>
                  <select
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(e.target.value)}
                    className={selectClass}
                    disabled={!canInteract || savingRole || rolesLoading}
                  >
                    <option value="">Select role…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {rolesError && (
                    <div className="text-[11px] text-red-200">Roles: {rolesError}</div>
                  )}
                </label>

                <button
                  type="button"
                  onClick={onAddAssignment}
                  disabled={!canInteract || savingRole}
                  className={[
                    "rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                    "border border-white/15 bg-white/10 hover:bg-white/15",
                    "disabled:opacity-60 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  {savingRole ? "Saving…" : "Add assignment"}
                </button>
              </div>
            </div>

            {/* Current assignments */}
            <div className="mt-4 grid gap-2">
              {canInteract && assignments.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">
                  No role assignments yet.
                </div>
              )}

              {assignments.map((a: any) => (
                <div
                  key={a.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-white/90">
                        {a.roleName}
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        Branch: <span className="text-white/75">{a.branchName ?? "All branches"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={chipClass}>
                          Perms: {a.permissionCount}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveAssignment(a.id)}
                      disabled={!canInteract || savingRole}
                      className={[
                        "shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold",
                        "hover:bg-white/[0.06] transition",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                      ].join(" ")}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-extrabold text-white/90">Permissions</div>
              <div className="text-xs text-white/55">
                Manage direct permissions and review the effective permission set.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("direct")}
                  className={[
                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                    activeTab === "direct"
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white/80",
                  ].join(" ")}
                >
                  Direct
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("effective")}
                  className={[
                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                    activeTab === "effective"
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white/80",
                  ].join(" ")}
                >
                  Effective
                </button>
              </div>

              <button
                type="button"
                onClick={onSaveDirectPermissions}
                disabled={!canInteract || savingPerms}
                className={[
                  "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                  "border border-white/15 bg-white/10 hover:bg-white/15",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {savingPerms ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <SoftDivider />
          </div>

          {!canInteract && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/60">
              Select a user to manage permissions.
            </div>
          )}

          {canInteract && activeTab === "effective" && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/85">Effective permissions</div>
                <div className="text-xs text-white/55">
                  {effectiveState.status === "loading"
                    ? "Calculating…"
                    : effectiveState.status === "error"
                    ? "Error"
                    : `${effective.length} total`}
                </div>
              </div>

              {effectiveState.status === "error" && (
                <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {effectiveState.message}
                </div>
              )}

              <div className="mt-3 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                {effectiveState.status === "loading" && (
                  <div className="grid gap-2">
                    <SkeletonLine />
                    <SkeletonLine />
                    <SkeletonLine />
                  </div>
                )}

                {effectiveState.status !== "loading" && (
                  <div className="flex flex-wrap gap-2">
                    {effective.slice(0, 48).map((k) => (
                      <span key={k} className={chipClass}>
                        {k}
                      </span>
                    ))}
                    {effective.length > 48 && (
                      <span className="text-xs text-white/55">
                        +{effective.length - 48} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {canInteract && activeTab === "direct" && (
            <div className="mt-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/85">Direct permissions</div>
                  <div className="text-xs text-white/55">
                    Toggle individual permissions (saved explicitly for this user).
                  </div>
                </div>

                <input
                  value={permQuery}
                  onChange={(e) => setPermQuery(e.target.value)}
                  placeholder="Search permissions…"
                  className={[inputClass, "md:max-w-sm"].join(" ")}
                />
              </div>

              {permLoading && (
                <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="grid gap-2">
                    <SkeletonLine />
                    <SkeletonLine />
                    <SkeletonLine />
                  </div>
                </div>
              )}

              {permError && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {permError}
                </div>
              )}

              {!permLoading && !permError && (
                <div className="mt-4 grid gap-3">
                  {groupedPermCatalog.map(([group, items]) => (
                    <div
                      key={group}
                      className="rounded-3xl border border-white/10 bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-extrabold text-white/90">{group}</div>
                        <div className="text-xs text-white/55">{items.length}</div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        {items.map((p) => {
                          const checked = directPerms.has(p.key);
                          return (
                            <ToggleRow
                              key={p.key}
                              title={p.key}
                              subtitle={p.description ?? p.group ?? null}
                              disabled={!canInteract || savingPerms}
                              onClick={() => toggleDirectPerm(p.key)}
                              right={
                                <LuxSwitch
                                  checked={checked}
                                  disabled={!canInteract || savingPerms}
                                  onChange={() => toggleDirectPerm(p.key)}
                                />
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {filteredPermCatalog.length === 0 && (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/60">
                      No permissions found.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
