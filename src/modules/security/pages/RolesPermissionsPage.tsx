// src/modules/security/pages/RolesPermissionsPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { useAuth } from "../../../auth/AuthProvider";
import "./roles-permissions.css";

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


type Tab = "matrix" | "members" | "overview";

function sortRoles(roles: RoleDto[]): RoleDto[] {
  return [...roles].sort(
    (a, b) =>
      Number(Boolean(b.isSystem)) - Number(Boolean(a.isSystem)) ||
      a.name.localeCompare(b.name)
  );
}

function permissionLabel(permission: PermissionCatalogItem): string {
  return permission.name || permission.key;
}

function permissionKey(permission: PermissionCatalogItem): string {
  return permission.key;
}

function roleName(role?: RoleDto | null): string {
  return role?.name ?? "No role selected";
}

function userRoles(user: UserDto): string[] {
  return (((user as any).roles ?? (user as any).roleNames ?? []) as string[])
    .filter(Boolean)
    .map(String);
}

export default function RolesPermissionsPage() {

  const { companyId } = useAppScope();
  const { hasPermission } = useAuth();

  const canView =
    hasPermission("roles.view") ||
    hasPermission("users.view") ||
    hasPermission("security.view");

  const canManage =
    hasPermission("roles.manage") ||
    hasPermission("security.manage");

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const selectedRole = roles.find((x) => x.id === selectedRoleId) ?? null;

  const [originalPermissionKeys, setOriginalPermissionKeys] = useState<string[]>([]);
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

  const isSystemRole = Boolean(selectedRole?.isSystem);
  const isDirty = isPermissionsDirty(originalPermissionKeys, stagedPermissionKeys);

  const stagedSet = useMemo(
    () => new Set(stagedPermissionKeys),
    [stagedPermissionKeys]
  );

  async function loadWorkspace(preferredRoleId?: string) {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const [roleList, permissionList, userList] = await Promise.all([
        securityApi.listRoles(companyId),
        securityApi.listPermissions(companyId),
        securityApi.listUsers(companyId),
      ]);

      const orderedRoles = sortRoles(roleList ?? []);

      setRoles(orderedRoles);
      setPermissions(permissionList ?? []);
      setUsers(userList ?? []);

      setSelectedRoleId(
        preferredRoleId ||
          selectedRoleId ||
          orderedRoles[0]?.id ||
          null
      );
    } catch (e) {
      setError(extractSecurityError(e, "Failed to load security workspace."));
    } finally {
      setLoading(false);
    }
  }

  async function loadRolePermissions(roleId: string) {
    if (!companyId) return;

    setRoleLoading(true);
    setError(null);

    try {
      const assigned = await securityApi.getRolePermissions(companyId, roleId);
      const keys = assigned.map(permissionKey).sort();

      setOriginalPermissionKeys(keys);
      setStagedPermissionKeys(keys);
    } catch (e) {
      setError(extractSecurityError(e, "Failed to load role permissions."));
      setOriginalPermissionKeys([]);
      setStagedPermissionKeys([]);
    } finally {
      setRoleLoading(false);
    }
  }

  useEffect(() => {
    if (canView && companyId) {
      void loadWorkspace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, companyId]);

  useEffect(() => {
    if (selectedRoleId && companyId) {
      void loadRolePermissions(selectedRoleId);
    }
  }, [selectedRoleId, companyId]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();

    return sortRoles(
      roles.filter((role) =>
        !q ||
        `${role.name} ${role.description ?? ""}`
          .toLowerCase()
          .includes(q)
      )
    );
  }, [roles, roleSearch]);

  const permissionGroups = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();

    return groupPermissions(
      permissions.filter((permission) =>
        !q ||
        `${permission.key} ${permission.name ?? ""} ${(permission as any).category ?? ""} ${permission.group ?? ""} ${permission.description ?? ""}`
          .toLowerCase()
          .includes(q)
      )
    );
  }, [permissions, permissionSearch]);

  const roleMembers = useMemo(() => {
    if (!selectedRole) return [];

    return users.filter((user) =>
      userRoles(user).some(
        (role) => role.toLowerCase() === selectedRole.name.toLowerCase()
      )
    );
  }, [users, selectedRole]);

  const assignableUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();

    return users
      .filter((user) => !roleMembers.some((member) => member.id === user.id))
      .filter((user) =>
        !q ||
        `${userDisplayName(user)} ${user.email ?? ""}`
          .toLowerCase()
          .includes(q)
      );
  }, [users, roleMembers, userSearch]);

  const riskyPermissions = useMemo(
    () =>
      stagedPermissionKeys.filter((key) =>
        /(delete|reverse|post|approve|manage|void|refund)/i.test(key)
      ),
    [stagedPermissionKeys]
  );

  function selectRole(roleId: string) {
    if (isDirty && !window.confirm("Discard unsaved permission changes?")) return;

    setSelectedRoleId(roleId);
    setTab("matrix");
    setNotice(null);
  }

  function togglePermission(key: string) {
    if (!canManage || isSystemRole) return;

    setStagedPermissionKeys((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return [...next].sort();
    });
  }

  function toggleGroup(keys: string[]) {
    if (!canManage || isSystemRole) return;

    const allSelected = keys.every((key) => stagedSet.has(key));

    setStagedPermissionKeys((current) => {
      const next = new Set(current);

      for (const key of keys) {
        allSelected ? next.delete(key) : next.add(key);
      }

      return [...next].sort();
    });
  }

  async function savePermissions() {
    if (!companyId || !selectedRole || selectedRole.isSystem) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await securityApi.setRolePermissions(
        companyId,
        selectedRole.id,
        stagedPermissionKeys
      );

      await loadRolePermissions(selectedRole.id);
      setNotice("Permissions saved.");
    } catch (e) {
      setError(extractSecurityError(e, "Failed to save permissions."));
    } finally {
      setSaving(false);
    }
  }

  function openCreateRole() {
    setEditingRole(null);
    setRoleFormName("");
    setRoleFormDescription("");
    setDrawerOpen(true);
  }

  function openEditRole(role: RoleDto) {
    setEditingRole(role);
    setRoleFormName(role.name);
    setRoleFormDescription(role.description ?? "");
    setDrawerOpen(true);
  }

  async function saveRole() {
    if (!companyId) return;

    const name = roleFormName.trim();

    if (!name) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingRole) {
        await securityApi.updateRole(companyId, editingRole.id, {
          name,
          displayName: name,
          description: roleFormDescription.trim() || null,
        });

        await loadWorkspace(editingRole.id);
      } else {
        await securityApi.createRole(companyId, {
          name,
          displayName: name,
          description: roleFormDescription.trim() || null,
        });

        await loadWorkspace();
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
    if (!companyId || role.isSystem) return;
    if (!window.confirm(`Delete role "${role.name}"?`)) return;

    setSaving(true);
    setError(null);

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
    if (!companyId || !selectedRole || selectedRole.isSystem) return;

    setSaving(true);
    setError(null);

    try {
      await securityApi.addUserToRole(companyId, selectedRole.id, userId);
      await loadWorkspace(selectedRole.id);
      setNotice("User assigned.");
    } catch (e) {
      setError(extractSecurityError(e, "Failed to assign user."));
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(userId: string) {
    if (!companyId || !selectedRole || selectedRole.isSystem) return;

    setSaving(true);
    setError(null);

    try {
      await securityApi.removeUserFromRole(companyId, selectedRole.id, userId);
      await loadWorkspace(selectedRole.id);
      setNotice("User removed.");
    } catch (e) {
      setError(extractSecurityError(e, "Failed to remove user."));
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <div className="rp-shell">
        <div className="rp-empty">
          <strong>Access denied</strong>
          <span>You do not have permission to view Security Administration.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rp-shell">
      <header className="rp-header">
        <div>
          <div className="rp-kicker">ERP Security Workspace</div>
          <h1>Security Administration</h1>
          <p>Tenant-scoped roles, permission governance, and user access assignment.</p>
        </div>

        <div className="rp-actions">
          <span className={`rp-badge ${companyId ? "success" : "danger"}`}>
            {companyId ? "Company scoped" : "Missing company"}
          </span>

          {canManage && (
            <button className="rp-btn primary" onClick={openCreateRole}>
              + New role
            </button>
          )}
        </div>
      </header>

      {notice && <div className="rp-alert success">{notice}</div>}
      {error && <div className="rp-alert danger">{error}</div>}

      <section className="rp-kpis">
        <div><span>Roles</span><strong>{roles.length}</strong></div>
        <div><span>Permissions</span><strong>{permissions.length}</strong></div>
        <div><span>Assignments</span><strong>{roles.reduce((s, r) => s + (r.userCount ?? 0), 0)}</strong></div>
        <div><span>Protected</span><strong>{roles.filter((r) => r.isSystem).length}</strong></div>
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
                  className={`rp-role ${role.id === selectedRoleId ? "active" : ""}`}
                  onClick={() => selectRole(role.id)}
                >
                  <strong>{role.name}</strong>
                  {role.isSystem && <span className="rp-badge warning">System</span>}
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
                </div>

                <div className="rp-actions">
                  {selectedRole.isSystem && <span className="rp-badge warning">Read only</span>}
                  {canManage && !selectedRole.isSystem && (
                    <>
                      <button className="rp-btn" onClick={() => openEditRole(selectedRole)}>Edit</button>
                      <button className="rp-btn danger" onClick={() => deleteRole(selectedRole)}>Delete</button>
                    </>
                  )}
                </div>
              </div>

              <nav className="rp-tabs">
                <button className={tab === "matrix" ? "active" : ""} onClick={() => setTab("matrix")}>Permission Matrix</button>
                <button className={tab === "members" ? "active" : ""} onClick={() => setTab("members")}>Members ({roleMembers.length})</button>
                <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Governance</button>
              </nav>

              {tab === "matrix" && (
                <div className="rp-body">
                  <div className="rp-toolbar">
                    <input
                      className="rp-input"
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      placeholder="Filter permissions..."
                    />
                  </div>

                  {roleLoading ? (
                    <div className="rp-muted">Loading permissions...</div>
                  ) : (
                    <div className="rp-permission-groups">
                      {permissionGroups.map((group) => {
                        const keys = group.items.map((p) => p.key);
                        const selected = keys.filter((key) => stagedSet.has(key)).length;

                        return (
                          <section key={group.group} className="rp-permission-group">
                            <div className="rp-group-head">
                              <div>
                                <strong>{group.group}</strong>
                                <span>{selected}/{keys.length} enabled</span>
                              </div>

                              <button
                                className="rp-btn mini"
                                disabled={!canManage || isSystemRole}
                                onClick={() => toggleGroup(keys)}
                              >
                                Toggle group
                              </button>
                            </div>

                            <div className="rp-permission-list">
                              {group.items.map((permission) => (
                                <label key={permission.key} className="rp-permission">
                                  <input
                                    type="checkbox"
                                    checked={stagedSet.has(permission.key)}
                                    disabled={!canManage || isSystemRole}
                                    onChange={() => togglePermission(permission.key)}
                                  />
                                  <span>
                                    <strong>{permissionLabel(permission)}</strong>
                                    <small>{permission.description || permission.key}</small>
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

                      {roleMembers.length === 0 ? (
                        <div className="rp-muted">No users assigned.</div>
                      ) : (
                        roleMembers.map((user) => (
                          <div key={user.id} className="rp-user">
                            <div className="rp-avatar">{userInitials(user)}</div>
                            <div>
                              <strong>{userDisplayName(user)}</strong>
                              <small>{user.email}</small>
                            </div>

                            {canManage && !isSystemRole && (
                              <button
                                className="rp-btn mini danger"
                                onClick={() => removeUser(user.id)}
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
                      />

                      <div className="rp-user-list">
                        {assignableUsers.map((user) => (
                          <div key={user.id} className="rp-user">
                            <div className="rp-avatar">{userInitials(user)}</div>
                            <div>
                              <strong>{userDisplayName(user)}</strong>
                              <small>{user.email}</small>
                            </div>

                            {canManage && !isSystemRole && (
                              <button className="rp-btn mini" onClick={() => assignUser(user.id)}>
                                Assign
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {tab === "overview" && (
                <div className="rp-body rp-overview">
                  <div><span>Permissions</span><strong>{stagedPermissionKeys.length}</strong></div>
                  <div><span>Members</span><strong>{roleMembers.length}</strong></div>
                  <div><span>Risk flags</span><strong>{riskyPermissions.length}</strong></div>
                  <div><span>Role type</span><strong>{selectedRole.isSystem ? "System" : "Tenant"}</strong></div>

                  <section className="rp-governance">
                    <h3>Governance checklist</h3>
                    <ul>
                      <li>{selectedRole.isSystem ? "System role is read-only." : "Tenant role is editable."}</li>
                      <li>{riskyPermissions.length > 0 ? "High-risk permissions require review." : "No high-risk permission detected."}</li>
                      <li>Audit log backend feed recommended for go-live.</li>
                      <li>Separation-of-duties engine recommended for finance and inventory controls.</li>
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
            <div><span>Selected role</span><strong>{roleName(selectedRole)}</strong></div>
            <div><span>Status</span><strong>{selectedRole?.isSystem ? "Protected" : "Editable"}</strong></div>
            <div><span>Unsaved changes</span><strong>{isDirty ? "Yes" : "No"}</strong></div>
            <div><span>Risk permissions</span><strong>{riskyPermissions.length}</strong></div>
          </div>
        </aside>
      </section>

      {isDirty && selectedRole && (
        <div className="rp-savebar">
          <span>
            Unsaved permission changes for <strong>{selectedRole.name}</strong>
          </span>

          <div>
            <button
              className="rp-btn"
              onClick={() => setStagedPermissionKeys([...originalPermissionKeys])}
            >
              Reset
            </button>

            <button
              className="rp-btn primary"
              disabled={saving || !canManage || isSystemRole}
              onClick={savePermissions}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div className="rp-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="rp-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="rp-drawer-head">
              <strong>{editingRole ? "Edit role" : "Create role"}</strong>
              <button className="rp-btn mini" onClick={() => setDrawerOpen(false)}>
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
              />
            </label>

            <label className="rp-field">
              <span>Description</span>
              <textarea
                className="rp-textarea"
                value={roleFormDescription}
                onChange={(e) => setRoleFormDescription(e.target.value)}
                placeholder="Describe this role..."
              />
            </label>

            <div className="rp-drawer-actions">
              <button className="rp-btn" onClick={() => setDrawerOpen(false)}>
                Cancel
              </button>

              <button className="rp-btn primary" disabled={saving} onClick={saveRole}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}