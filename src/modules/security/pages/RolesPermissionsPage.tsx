// src/modules/security/pages/RolesPermissionsPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppScope } from "../../../app/useAppScope";
import { useAuth } from "../../../auth/AuthProvider";

import {
  securityApi,
  type PermissionCatalogItem,
  type RoleDto,
  type UserDto,
} from "../api/securityApi";

import {
  extractSecurityError,
  groupPermissions,
  isPermissionsDirty,
  userDisplayName,
  userInitials,
} from "../utils/security.utils";

import "./roles-permissions.css";

type Tab = "matrix" | "members" | "overview";

function sortRoles(roles: RoleDto[]): RoleDto[] {
  return [...roles].sort(
    (a, b) =>
      Number(Boolean(b.isSystem)) - Number(Boolean(a.isSystem)) ||
      a.name.localeCompare(b.name)
  );
}

function clean(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function permissionLabel(permission: PermissionCatalogItem): string {
  return permission.name || permission.key;
}

function permissionKey(permission: PermissionCatalogItem): string {
  return permission.key;
}

function roleName(role?: RoleDto | null): string {
  return role?.displayName || role?.name || "No role selected";
}

function userRoles(user: UserDto): string[] {
  return (((user as any).roles ?? (user as any).roleNames ?? []) as string[])
    .filter(Boolean)
    .map(String);
}

function hasAnyRole(user: any, roleNames: string[]): boolean {
  const normalized = new Set(roleNames.map((x) => x.toLowerCase()));

  return (((user?.roles ?? user?.roleNames ?? []) as string[]) || [])
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .some((role) => normalized.has(role));
}

function roleMatchesUser(role: RoleDto, user: UserDto): boolean {
  const targetNames = [role.name, role.displayName]
    .map((x) => clean(x).toLowerCase())
    .filter(Boolean);

  if (targetNames.length === 0) return false;

  return userRoles(user).some((x) =>
    targetNames.includes(clean(x).toLowerCase())
  );
}

function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rp-shell">
      <div className="rp-empty">
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

export default function RolesPermissionsPage() {
  const { companyId } = useAppScope();
  const { hasPermission, user } = useAuth() as any;

  const isSystemAdmin = hasAnyRole(user, ["SystemAdmin", "SysAdmin"]);
  const isCompanyAdmin = hasAnyRole(user, ["CompanyAdmin"]);

  const canView =
    Boolean(companyId) &&
    (isSystemAdmin ||
      isCompanyAdmin ||
      hasPermission?.("roles.view") ||
      hasPermission?.("users.view"));

  const canManage =
    Boolean(companyId) &&
    (isSystemAdmin ||
      isCompanyAdmin ||
      hasPermission?.("roles.manage"));

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => roles.find((x) => x.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const [originalPermissionKeys, setOriginalPermissionKeys] = useState<string[]>(
    []
  );
  const [stagedPermissionKeys, setStagedPermissionKeys] = useState<string[]>([]);

  const [tab, setTab] = useState<Tab>("matrix");
  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);
  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormDescription, setRoleFormDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberLoadError, setMemberLoadError] = useState<string | null>(null);

  const isSystemRole = Boolean(selectedRole?.isSystem);
  const isDirty = isPermissionsDirty(
    originalPermissionKeys,
    stagedPermissionKeys
  );

  const canEditSelectedRole = canManage && Boolean(selectedRole) && !isSystemRole;

  const stagedSet = useMemo(
    () => new Set(stagedPermissionKeys),
    [stagedPermissionKeys]
  );

  const loadRolePermissions = useCallback(
    async (roleId: string, signal?: AbortSignal) => {
      if (!companyId) return;

      setRoleLoading(true);
      setError(null);

      try {
        const assigned = await securityApi.getRolePermissions(
          companyId,
          roleId,
          signal
        );

        const keys = assigned.map(permissionKey).sort();

        setOriginalPermissionKeys(keys);
        setStagedPermissionKeys(keys);
      } catch (e) {
        if ((e as any)?.name === "CanceledError") return;

        setError(extractSecurityError(e, "Failed to load role permissions."));
        setOriginalPermissionKeys([]);
        setStagedPermissionKeys([]);
      } finally {
        setRoleLoading(false);
      }
    },
    [companyId]
  );

  const loadWorkspace = useCallback(
    async (preferredRoleId?: string, signal?: AbortSignal) => {
      if (!companyId || !canView) return;

      setLoading(true);
      setError(null);

      try {
        const [roleList, permissionList, userList] = await Promise.all([
          securityApi.listRoles(companyId, signal),
          securityApi.listPermissions(companyId, signal),
          securityApi.listUsers(companyId, signal).catch((error) => {
            setMemberLoadError(
              extractSecurityError(
                error,
                "User membership could not be loaded."
              )
            );

            return [] as UserDto[];
          }),
        ]);

        const orderedRoles = sortRoles(roleList ?? []);

        setRoles(orderedRoles);
        setPermissions(permissionList ?? []);
        setUsers(userList ?? []);

        if ((userList ?? []).length > 0) {
          setMemberLoadError(null);
        }

        setSelectedRoleId((current) => {
          if (preferredRoleId && orderedRoles.some((x) => x.id === preferredRoleId)) {
            return preferredRoleId;
          }

          if (current && orderedRoles.some((x) => x.id === current)) {
            return current;
          }

          return orderedRoles[0]?.id ?? null;
        });
      } catch (e) {
        if ((e as any)?.name === "CanceledError") return;

        setError(extractSecurityError(e, "Failed to load security workspace."));
      } finally {
        setLoading(false);
      }
    },
    [companyId, canView]
  );

  useEffect(() => {
    if (!companyId || !canView) return;

    const controller = new AbortController();

    void loadWorkspace(undefined, controller.signal);

    return () => controller.abort();
  }, [companyId, canView, loadWorkspace]);

  useEffect(() => {
    if (!selectedRoleId || !companyId || !canView) return;

    const controller = new AbortController();

    void loadRolePermissions(selectedRoleId, controller.signal);

    return () => controller.abort();
  }, [selectedRoleId, companyId, canView, loadRolePermissions]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();

    return sortRoles(
      roles.filter((role) => {
        if (!q) return true;

        return `${role.name} ${role.displayName ?? ""} ${role.description ?? ""}`
          .toLowerCase()
          .includes(q);
      })
    );
  }, [roles, roleSearch]);

  const permissionGroups = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();

    return groupPermissions(
      permissions.filter((permission) => {
        if (!q) return true;

        return `${permission.key} ${permission.name ?? ""} ${
          permission.category ?? ""
        } ${permission.group ?? ""} ${permission.description ?? ""}`
          .toLowerCase()
          .includes(q);
      })
    );
  }, [permissions, permissionSearch]);

  const roleMembers = useMemo(() => {
    if (!selectedRole) return [];
    return users.filter((item) => roleMatchesUser(selectedRole, item));
  }, [users, selectedRole]);

  const assignableUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const memberIds = new Set(roleMembers.map((x) => x.id));

    return users
      .filter((item) => !memberIds.has(item.id))
      .filter((item) => {
        if (!q) return true;

        return `${userDisplayName(item)} ${item.email ?? ""}`
          .toLowerCase()
          .includes(q);
      });
  }, [users, roleMembers, userSearch]);

  const riskyPermissions = useMemo(
    () =>
      stagedPermissionKeys.filter((key) =>
        /(delete|reverse|post|approve|manage|void|refund)/i.test(key)
      ),
    [stagedPermissionKeys]
  );

  function clearMessages() {
    setNotice(null);
    setError(null);
  }

  function selectRole(roleId: string) {
    if (roleId === selectedRoleId) return;

    if (isDirty && !window.confirm("Discard unsaved permission changes?")) {
      return;
    }

    clearMessages();
    setSelectedRoleId(roleId);
    setTab("matrix");
  }

  function togglePermission(key: string) {
    if (!canEditSelectedRole) return;

    setStagedPermissionKeys((current) => {
      const next = new Set(current);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return [...next].sort();
    });
  }

  function toggleGroup(keys: string[]) {
    if (!canEditSelectedRole) return;

    const allSelected = keys.every((key) => stagedSet.has(key));

    setStagedPermissionKeys((current) => {
      const next = new Set(current);

      for (const key of keys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }

      return [...next].sort();
    });
  }

  async function savePermissions() {
    if (!companyId || !selectedRole || !canEditSelectedRole) return;

    setSaving(true);
    clearMessages();

    try {
      await securityApi.setRolePermissions(
        companyId,
        selectedRole.id,
        stagedPermissionKeys
      );

      await loadRolePermissions(selectedRole.id);
      setNotice("Permissions saved. Affected users must refresh their session or sign in again for access changes to take effect.");
    } catch (e) {
      setError(extractSecurityError(e, "Failed to save permissions."));
    } finally {
      setSaving(false);
    }
  }

  function openCreateRole() {
    if (!canManage) return;

    clearMessages();
    setEditingRole(null);
    setRoleFormName("");
    setRoleFormDescription("");
    setDrawerOpen(true);
  }

  function openEditRole(role: RoleDto) {
    if (!canManage || role.isSystem) return;

    clearMessages();
    setEditingRole(role);
    setRoleFormName(role.name);
    setRoleFormDescription(role.description ?? "");
    setDrawerOpen(true);
  }

  async function saveRole() {
    if (!companyId || !canManage) return;

    const name = roleFormName.trim();

    if (!name) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      if (editingRole) {
        if (editingRole.isSystem) return;

        await securityApi.updateRole(companyId, editingRole.id, {
          name,
          displayName: name,
          description: roleFormDescription.trim() || null,
        });

        await loadWorkspace(editingRole.id);
      } else {
        const created = await securityApi.createRole(companyId, {
          name,
          displayName: name,
          description: roleFormDescription.trim() || null,
        });

        await loadWorkspace(created?.id);
      }

      setDrawerOpen(false);
      setNotice("Role saved.");
    } catch (e) {
      setError(extractSecurityError(e, "Failed to save role."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: RoleDto) {
    if (!companyId || !canManage || role.isSystem) return;

    if (!window.confirm(`Delete role "${roleName(role)}"?`)) return;

    setSaving(true);
    clearMessages();

    try {
      await securityApi.deleteRole(companyId, role.id);
      await loadWorkspace();
      setNotice("Role deleted.");
    } catch (e) {
      setError(extractSecurityError(e, "Failed to delete role."));
    } finally {
      setSaving(false);
    }
  }

  async function assignUser(userId: string) {
    if (!companyId || !selectedRole || !canEditSelectedRole) return;

    setSaving(true);
    clearMessages();

    try {
      await securityApi.addUserToRole(companyId, selectedRole.name, userId);
      await loadWorkspace(selectedRole.id);
      setNotice("User assigned. The affected user must refresh their session or sign in again for access changes to take effect.");
    } catch (e) {
      setError(extractSecurityError(e, "Failed to assign user."));
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(userId: string) {
    if (!companyId || !selectedRole || !canEditSelectedRole) return;

    setSaving(true);
    clearMessages();

    try {
      await securityApi.removeUserFromRole(companyId, selectedRole.name, userId);
      await loadWorkspace(selectedRole.id);
      setNotice("User removed. The affected user must refresh their session or sign in again for access changes to take effect.");
    } catch (e) {
      setError(extractSecurityError(e, "Failed to remove user."));
    } finally {
      setSaving(false);
    }
  }

  function closeDrawer() {
    if (saving) return;

    setDrawerOpen(false);
    setEditingRole(null);
    setRoleFormName("");
    setRoleFormDescription("");
  }

  if (!companyId) {
    return (
      <EmptyState
        title="No company selected"
        text="Select a company workspace before managing company roles and permissions."
      />
    );
  }

  if (!canView) {
    return (
      <EmptyState
        title="Access denied"
        text="You need CompanyAdmin, SystemAdmin, roles.view, or users.view permission to access this page."
      />
    );
  }

  return (
    <div className="rp-shell">
      <header className="rp-header">
        <div>
          <div className="rp-kicker">Company Security Workspace</div>
          <h1>Roles & Permissions</h1>
          <p>
            Company-scoped roles, permission governance, and user access
            assignment.
          </p>
        </div>

        <div className="rp-actions">
          <span className="rp-badge success">Company scoped</span>

          {isSystemAdmin ? (
            <span className="rp-badge warning">SystemAdmin acting in company</span>
          ) : null}

          {isCompanyAdmin ? (
            <span className="rp-badge success">CompanyAdmin</span>
          ) : null}

          {canManage && (
            <button
              type="button"
              className="rp-btn primary"
              onClick={openCreateRole}
              disabled={saving}
            >
              + New role
            </button>
          )}
        </div>
      </header>

      {notice && <div className="rp-alert success">{notice}</div>}
      {error && <div className="rp-alert danger">{error}</div>}

      <section className="rp-kpis">
        <div>
          <span>Roles</span>
          <strong>{roles.length}</strong>
        </div>
        <div>
          <span>Permissions</span>
          <strong>{permissions.length}</strong>
        </div>
        <div>
          <span>Assignments</span>
          <strong>
            {roles.reduce((sum, role) => sum + (role.userCount ?? 0), 0)}
          </strong>
        </div>
        <div>
          <span>Protected</span>
          <strong>{roles.filter((role) => role.isSystem).length}</strong>
        </div>
      </section>

      <section className="rp-grid">
        <aside className="rp-panel">
          <div className="rp-panel-head">
            <strong>Roles</strong>
            <span>{filteredRoles.length}</span>
          </div>

          <input
            className="rp-input"
            value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
            placeholder="Search roles..."
            disabled={saving}
          />

          <div className="rp-list">
            {loading ? (
              <div className="rp-muted">Loading roles...</div>
            ) : filteredRoles.length === 0 ? (
              <div className="rp-muted">No roles found.</div>
            ) : (
              filteredRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`rp-role ${
                    role.id === selectedRoleId ? "active" : ""
                  }`}
                  onClick={() => selectRole(role.id)}
                  disabled={saving}
                >
                  <strong>{roleName(role)}</strong>

                  {role.isSystem && (
                    <span className="rp-badge warning">System</span>
                  )}

                  {!role.isSystem && (
                    <span className="rp-badge success">Company</span>
                  )}

                  <small>{role.description || "No description"}</small>
                  <em>{role.userCount ?? 0} users</em>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="rp-panel main">
          {!selectedRole ? (
            <div className="rp-empty">Select a role to begin.</div>
          ) : (
            <>
              <div className="rp-role-head">
                <div>
                  <h2>{roleName(selectedRole)}</h2>
                  <p>{selectedRole.description || "No description provided."}</p>
                  {!roleLoading && (selectedRole.userCount ?? 0) === 0 && (
                    <div className="rp-access-note warning">
                      This role has permissions configured, but no active users
                      are assigned to it yet.
                    </div>
                  )}
                </div>

                <div className="rp-actions">
                  {selectedRole.isSystem && (
                    <span className="rp-badge warning">Read only</span>
                  )}

                  {canEditSelectedRole && (
                    <>
                      <button
                        type="button"
                        className="rp-btn"
                        onClick={() => openEditRole(selectedRole)}
                        disabled={saving}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="rp-btn danger"
                        onClick={() => deleteRole(selectedRole)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              <nav className="rp-tabs">
                <button
                  type="button"
                  className={tab === "matrix" ? "active" : ""}
                  onClick={() => setTab("matrix")}
                >
                  Permission Matrix
                </button>

                <button
                  type="button"
                  className={tab === "members" ? "active" : ""}
                  onClick={() => setTab("members")}
                  disabled={Boolean(memberLoadError)}
                >
                  Members ({roleMembers.length})
                </button>

                <button
                  type="button"
                  className={tab === "overview" ? "active" : ""}
                  onClick={() => setTab("overview")}
                >
                  Governance
                </button>
              </nav>

              {tab === "matrix" && (
                <div className="rp-body">
                  <div className="rp-toolbar">
                    <input
                      className="rp-input"
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      placeholder="Filter permissions..."
                      disabled={saving}
                    />
                  </div>

                  {roleLoading ? (
                    <div className="rp-muted">Loading permissions...</div>
                  ) : permissionGroups.length === 0 ? (
                    <div className="rp-muted">No permissions found.</div>
                  ) : (
                    <div className="rp-permission-groups">
                      {permissionGroups.map((group) => {
                        const keys = group.items.map((item) => item.key);
                        const selected = keys.filter((key) =>
                          stagedSet.has(key)
                        ).length;

                        return (
                          <section
                            key={group.group}
                            className="rp-permission-group"
                          >
                            <div className="rp-group-head">
                              <div>
                                <strong>{group.group}</strong>
                                <span>
                                  {selected}/{keys.length} enabled
                                </span>
                              </div>

                              <button
                                type="button"
                                className="rp-btn mini"
                                disabled={!canEditSelectedRole || saving}
                                onClick={() => toggleGroup(keys)}
                              >
                                Toggle group
                              </button>
                            </div>

                            <div className="rp-permission-list">
                              {group.items.map((permission) => (
                                <label
                                  key={permission.key}
                                  className="rp-permission"
                                >
                                  <input
                                    type="checkbox"
                                    checked={stagedSet.has(permission.key)}
                                    disabled={!canEditSelectedRole || saving}
                                    onChange={() =>
                                      togglePermission(permission.key)
                                    }
                                  />

                                  <span>
                                    <strong>{permissionLabel(permission)}</strong>
                                    <small>
                                      {permission.description || permission.key}
                                    </small>
                                  </span>
                                </label>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "members" && (
                <div className="rp-body">
                  <div className="rp-members-grid">
                    <section>
                      <h3>Assigned users</h3>

                      {memberLoadError ? (
                        <div className="rp-empty-inline">
                          <strong>Membership unavailable</strong>
                          <span>{memberLoadError}</span>
                        </div>
                      ) : roleMembers.length === 0 ? (
                        <div className="rp-empty-inline">
                          <strong>No users assigned</strong>
                          <span>
                            Permissions on this role will not take effect until
                            at least one active user is assigned.
                          </span>
                        </div>
                      ) : (
                        roleMembers.map((member) => (
                          <div key={member.id} className="rp-user">
                            <div className="rp-avatar">
                              {userInitials(member)}
                            </div>

                            <div>
                              <strong>{userDisplayName(member)}</strong>
                              <small>{member.email}</small>
                            </div>

                            {canEditSelectedRole && (
                              <button
                                type="button"
                                className="rp-btn mini danger"
                                onClick={() => removeUser(member.id)}
                                disabled={saving}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </section>

                    <section>
                      <h3>Assign users</h3>

                      <input
                        className="rp-input"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search available users..."
                        disabled={!canEditSelectedRole || saving || Boolean(memberLoadError)}
                      />

                      <div className="rp-user-list">
                        {memberLoadError ? (
                          <div className="rp-empty-inline">
                            <strong>User list unavailable</strong>
                            <span>
                              User assignment requires access to the company user
                              directory.
                            </span>
                          </div>
                        ) : assignableUsers.length === 0 ? (
                          <div className="rp-muted">No available users.</div>
                        ) : (
                          assignableUsers.map((item) => (
                            <div key={item.id} className="rp-user">
                              <div className="rp-avatar">
                                {userInitials(item)}
                              </div>

                              <div>
                                <strong>{userDisplayName(item)}</strong>
                                <small>{item.email}</small>
                              </div>

                              {canEditSelectedRole && (
                                <button
                                  type="button"
                                  className="rp-btn mini"
                                  onClick={() => assignUser(item.id)}
                                  disabled={saving}
                                >
                                  Assign
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {tab === "overview" && (
                <div className="rp-body rp-overview">
                  <div>
                    <span>Permissions</span>
                    <strong>{stagedPermissionKeys.length}</strong>
                  </div>

                  <div>
                    <span>Members</span>
                    <strong>{roleMembers.length}</strong>
                  </div>

                  <div>
                    <span>Risk flags</span>
                    <strong>{riskyPermissions.length}</strong>
                  </div>

                  <div>
                    <span>Role type</span>
                    <strong>{selectedRole.isSystem ? "System" : "Company"}</strong>
                  </div>

                  <section className="rp-governance">
                    <h3>Governance checklist</h3>

                    <ul>
                      <li>
                        {selectedRole.isSystem
                          ? "System role is read-only in company workspace."
                          : "Company role is editable within this company."}
                      </li>
                      <li>
                        {riskyPermissions.length > 0
                          ? "High-risk permissions require review."
                          : "No high-risk permission detected."}
                      </li>
                      <li>
                        CompanyAdmin can manage only company-scoped roles and
                        permissions.
                      </li>
                      <li>
                        A user needs both role membership and an active branch
                        assignment before these permissions become effective.
                      </li>
                      <li>
                        SystemAdmin actions should be audited as platform admin
                        acting inside this company.
                      </li>
                    </ul>
                  </section>
                </div>
              )}
            </>
          )}
        </main>

        <aside className="rp-panel">
          <div className="rp-panel-head">
            <strong>Governance</strong>
          </div>

          <div className="rp-side">
            <div>
              <span>Selected role</span>
              <strong>{roleName(selectedRole)}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{selectedRole?.isSystem ? "Protected" : "Editable"}</strong>
            </div>

            <div>
              <span>Effective users</span>
              <strong>{selectedRole?.userCount ?? 0}</strong>
            </div>

            <div>
              <span>Unsaved changes</span>
              <strong>{isDirty ? "Yes" : "No"}</strong>
            </div>

            <div>
              <span>Risk permissions</span>
              <strong>{riskyPermissions.length}</strong>
            </div>
          </div>
        </aside>
      </section>

      {isDirty && selectedRole && (
        <div className="rp-savebar">
          <span>
            Unsaved permission changes for <strong>{roleName(selectedRole)}</strong>
          </span>

          <div>
            <button
              type="button"
              className="rp-btn"
              onClick={() =>
                setStagedPermissionKeys([...originalPermissionKeys])
              }
              disabled={saving}
            >
              Reset
            </button>

            <button
              type="button"
              className="rp-btn primary"
              disabled={saving || !canEditSelectedRole}
              onClick={savePermissions}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div className="rp-overlay" onClick={closeDrawer}>
          <div className="rp-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="rp-drawer-head">
              <strong>{editingRole ? "Edit role" : "Create role"}</strong>

              <button
                type="button"
                className="rp-btn mini"
                onClick={closeDrawer}
                disabled={saving}
              >
                Close
              </button>
            </div>

            <label className="rp-field">
              <span>Role name</span>
              <input
                className="rp-input"
                value={roleFormName}
                onChange={(e) => setRoleFormName(e.target.value)}
                placeholder="Inventory Manager"
                disabled={saving}
              />
            </label>

            <label className="rp-field">
              <span>Description</span>
              <textarea
                className="rp-textarea"
                value={roleFormDescription}
                onChange={(e) => setRoleFormDescription(e.target.value)}
                placeholder="Describe this role..."
                disabled={saving}
              />
            </label>

            <div className="rp-drawer-actions">
              <button
                type="button"
                className="rp-btn"
                onClick={closeDrawer}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="rp-btn primary"
                disabled={saving || !roleFormName.trim()}
                onClick={saveRole}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
