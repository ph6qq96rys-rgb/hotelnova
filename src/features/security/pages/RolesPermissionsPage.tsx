import { useEffect, useMemo, useRef, useState } from "react";
import "./roles-permissions.css";
import {
  securityApi,
  type PermissionDto,
  type RoleDto,
  type RoleDetailDto,
  type UserLiteDto,
} from "../api/securityApi";
import { hasPermission } from "../../../auth/auth.storage";
import { usePageMeta } from "../../../hooks/usePageMeta";

type TabKey = "permissions" | "users";

const cx = (...xs: Array<string | false | undefined | null>) =>
  xs.filter(Boolean).join(" ");

function groupPermissions(perms: PermissionDto[]) {
  const map = new Map<string, PermissionDto[]>();
  for (const p of perms) {
    const g = p.group || "Other";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(p);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, items]) => ({
      group,
      items: items.sort((a, b) => a.key.localeCompare(b.key)),
    }));
}

function getErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export default function RolesPermissionsPage() {
  usePageMeta({
    title: "Roles & Permissions",
    subtitle: "Secure access control across modules",
  });

  // Permissions
  const canView = hasPermission("roles.view") || hasPermission("users.view");
  const canManageRoles = hasPermission("roles.manage");

  // Core state
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [roleDetail, setRoleDetail] = useState<RoleDetailDto | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("permissions");

  // Search
  const [roleSearch, setRoleSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");

  // Permissions staging (editable set)
  const [stagedPermissions, setStagedPermissions] = useState<string[]>([]);
  const stagedSet = useMemo(() => new Set(stagedPermissions), [stagedPermissions]);

  const isDirty = useMemo(() => {
    const base = new Set(roleDetail?.permissionKeys ?? []);
    if (base.size !== stagedSet.size) return true;
    for (const k of stagedSet) if (!base.has(k)) return true;
    return false;
  }, [roleDetail, stagedSet]);

  const permissionGroups = useMemo(
    () => groupPermissions(permissions),
    [permissions]
  );

  // Users tab state
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserLiteDto[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const userSearchTimer = useRef<number | null>(null);

  // Avoid setting state after unmount
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Load roles + permissions
  useEffect(() => {
    if (!canView) return;

    setLoading(true);
    setError(null);

    Promise.all([securityApi.listRoles(), securityApi.listPermissions()])
      .then(([r, p]) => {
        if (!aliveRef.current) return;
        setRoles(r.data ?? []);
        setPermissions(p.data ?? []);
      })
      .catch((e: unknown) => {
        if (!aliveRef.current) return;
        setError(getErrorMessage(e, "Failed to load security data"));
      })
      .finally(() => {
        if (!aliveRef.current) return;
        setLoading(false);
      });
  }, [canView]);

  // Load role detail
  useEffect(() => {
    if (!selectedRoleId) {
      setRoleDetail(null);
      setStagedPermissions([]);
      setDetailError(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    securityApi
      .getRole(selectedRoleId)
      .then((r) => {
        if (!aliveRef.current) return;
        setRoleDetail(r.data);
        setStagedPermissions(r.data.permissionKeys ?? []);
      })
      .catch((e: unknown) => {
        if (!aliveRef.current) return;
        setDetailError(getErrorMessage(e, "Failed to load role details"));
      })
      .finally(() => {
        if (!aliveRef.current) return;
        setDetailLoading(false);
      });
  }, [selectedRoleId]);

  // Derived: filtered roles
  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      `${r.name ?? ""} ${r.description ?? ""}`.toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);

  // Actions: permissions
  function togglePermission(key: string) {
    setStagedPermissions((prev) => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return [...s].sort();
    });
  }

  function bulkToggle(group: string, on: boolean) {
    const items = permissionGroups.find((g) => g.group === group)?.items ?? [];
    setStagedPermissions((prev) => {
      const s = new Set(prev);
      for (const p of items) on ? s.add(p.key) : s.delete(p.key);
      return [...s].sort();
    });
  }

  async function savePermissions() {
    if (!canManageRoles || !roleDetail) return;

    try {
      await securityApi.setRolePermissions(roleDetail.role.id, stagedPermissions);
      const d = await securityApi.getRole(roleDetail.role.id);
      if (!aliveRef.current) return;
      setRoleDetail(d.data);
      setStagedPermissions(d.data.permissionKeys ?? []);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Failed to save permissions"));
    }
  }

  function resetPermissions() {
    setStagedPermissions(roleDetail?.permissionKeys ?? []);
  }

  // Debounced user search (Users tab)
  useEffect(() => {
    if (tab !== "users") return;
    if (!selectedRoleId) return;

    const q = userSearch.trim();
    if (userSearchTimer.current) window.clearTimeout(userSearchTimer.current);

    if (!q) {
      setUserResults([]);
      setUserSearchLoading(false);
      setUserSearchError(null);
      return;
    }

    userSearchTimer.current = window.setTimeout(async () => {
      try {
        setUserSearchLoading(true);
        setUserSearchError(null);
        const r = await securityApi.searchUsers(q);
        if (!aliveRef.current) return;
        setUserResults(r.data ?? []);
      } catch (e: unknown) {
        if (!aliveRef.current) return;
        setUserSearchError(getErrorMessage(e, "User search failed"));
      } finally {
        if (!aliveRef.current) return;
        setUserSearchLoading(false);
      }
    }, 350);

    return () => {
      if (userSearchTimer.current) window.clearTimeout(userSearchTimer.current);
    };
  }, [userSearch, tab, selectedRoleId]);

  async function addUser(userId: string) {
    if (!canManageRoles || !roleDetail) return;
    try {
      await securityApi.addUserToRole(roleDetail.role.id, userId);
      const d = await securityApi.getRole(roleDetail.role.id);
      if (!aliveRef.current) return;
      setRoleDetail(d.data);
      setUserSearch("");
      setUserResults([]);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Failed to add user to role"));
    }
  }

  // Guard: no view permission
  if (!canView) {
    return (
      <div className="rp-shell">
        <div className="rp-empty">
          <div className="rp-emptyIcon">🔒</div>
          <div className="rp-emptyTitle">Access denied</div>
          <div className="rp-emptySub">You don’t have permission to view this page.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rp-shell">
      {/* Top Bar */}
      <div className="rp-topbar">
        <div className="rp-topbarLeft">
          <div className="rp-pageTitle">Roles & Permissions</div>
          <div className="rp-pageSubtitle">Role-based access control</div>
        </div>
      </div>

      {error && (
        <div className="rp-alert rp-alertError" style={{ marginBottom: 12 }}>
          <div className="rp-alertTitle">Couldn’t load</div>
          <div className="rp-alertBody">{error}</div>
        </div>
      )}

      <div className="rp-grid">
        {/* LEFT: Roles */}
        <aside className="rp-panel">
          <div className="rp-panelHeader">
            <div className="rp-panelTitle">Roles</div>
            <div className="rp-pill">{roles.length}</div>
          </div>

          <div className="rp-search">
            <input
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              placeholder="Search roles…"
            />
          </div>

          {loading ? (
            <div className="rp-muted">Loading…</div>
          ) : filteredRoles.length === 0 ? (
            <div className="rp-muted">No roles found.</div>
          ) : (
            <div className="rp-roleList">
              {filteredRoles.map((r) => {
                const active = r.id === selectedRoleId;
                return (
                  <button
                    key={r.id}
                    className={cx("rp-roleRow", active && "is-active")}
                    onClick={() => {
                      // Warn if switching role while unsaved changes exist
                      if (isDirty) {
                        const ok = confirm("You have unsaved permission changes. Discard them?");
                        if (!ok) return;
                      }
                      setSelectedRoleId(r.id);
                      setTab("permissions");
                      setUserSearch("");
                      setUserResults([]);
                    }}
                  >
                    <div className="rp-roleRowMain">
                      <div className="rp-roleName">
                        {r.name}
                        {r.isSystem ? <span className="rp-tag">System</span> : null}
                      </div>
                      <div className="rp-roleDesc">{r.description || "—"}</div>
                    </div>
                    <div className="rp-roleMeta">
                      <div className="rp-micro">Users</div>
                      <div className="rp-count">{r.userCount ?? "—"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* RIGHT: Detail */}
        <main className="rp-panel rp-panelMain">
          {!selectedRoleId ? (
            <div className="rp-empty">
              <div className="rp-emptyIcon">🧩</div>
              <div className="rp-emptyTitle">Select a role</div>
              <div className="rp-emptySub">Choose a role on the left to manage permissions and users.</div>
            </div>
          ) : detailLoading ? (
            <div className="rp-loading">
              <div className="rp-spinner" /> Loading role…
            </div>
          ) : detailError ? (
            <div className="rp-alert rp-alertError">
              <div className="rp-alertTitle">Couldn’t load role</div>
              <div className="rp-alertBody">{detailError}</div>
            </div>
          ) : !roleDetail ? (
            <div className="rp-muted">Role not found.</div>
          ) : (
            <>
              {/* Header */}
              <div className="rp-roleHeader">
                <div className="rp-roleHeaderLeft">
                  <div className="rp-roleHeaderTitle">
                    {roleDetail.role.name}
                    {roleDetail.role.isSystem ? <span className="rp-tag">System</span> : null}
                  </div>
                  <div className="rp-roleHeaderSub">{roleDetail.role.description || "No description"}</div>

                  <div className="rp-stats">
                    <div className="rp-stat">
                      <div className="rp-statLabel">Permissions</div>
                      <div className="rp-statValue">{stagedPermissions.length}</div>
                    </div>
                    <div className="rp-stat">
                      <div className="rp-statLabel">Users</div>
                      <div className="rp-statValue">{roleDetail.users?.length ?? 0}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="rp-tabs">
                <button
                  className={cx("rp-tab", tab === "permissions" && "is-active")}
                  onClick={() => {
                    if (tab === "users" && isDirty) {
                      const ok = confirm("You have unsaved permission changes. Keep them and continue?");
                      if (!ok) return;
                    }
                    setTab("permissions");
                  }}
                >
                  Permissions
                </button>
                <button
                  className={cx("rp-tab", tab === "users" && "is-active")}
                  onClick={() => setTab("users")}
                >
                  Users
                </button>
              </div>

              {/* Permissions Tab */}
              {tab === "permissions" ? (
                <section className="rp-tabBody">
                  <div className="rp-permToolbar">
                    <div className="rp-search rp-searchWide">
                      <input
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                        placeholder="Search permissions…"
                      />
                    </div>

                    <div className="rp-actions">
                      <button
                        className="rp-btn rp-btnGhost"
                        disabled={!canManageRoles || !isDirty}
                        onClick={resetPermissions}
                      >
                        Reset changes
                      </button>
                      <button
                        className="rp-btn rp-btnPrimary"
                        disabled={!canManageRoles || !isDirty}
                        onClick={savePermissions}
                        title={!canManageRoles ? "Missing roles.manage permission" : ""}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div className="rp-permGrid">
                    {permissionGroups.map((g) => {
                      const q = permSearch.trim().toLowerCase();
                      const visible = g.items.filter((p) => {
                        if (!q) return true;
                        return (
                          p.key.toLowerCase().includes(q) ||
                          (p.description ?? "").toLowerCase().includes(q) ||
                          (p.group ?? "").toLowerCase().includes(q)
                        );
                      });
                      if (visible.length === 0) return null;

                      const groupAllOn = visible.every((p) => stagedSet.has(p.key));
                      const groupSomeOn = visible.some((p) => stagedSet.has(p.key));

                      return (
                        <div key={g.group} className="rp-permGroup">
                          <div className="rp-permGroupHeader">
                            <div className="rp-permGroupTitle">
                              {g.group}
                              <span className="rp-permGroupCount">{visible.length}</span>
                            </div>

                            <div className="rp-permGroupActions">
                              <button
                                className="rp-miniBtn"
                                disabled={!canManageRoles}
                                onClick={() => bulkToggle(g.group, true)}
                              >
                                Select all
                              </button>
                              <button
                                className="rp-miniBtn"
                                disabled={!canManageRoles}
                                onClick={() => bulkToggle(g.group, false)}
                              >
                                Clear
                              </button>

                              <span
                                className={cx(
                                  "rp-dot",
                                  groupAllOn ? "is-on" : groupSomeOn ? "is-some" : "is-off"
                                )}
                              />
                            </div>
                          </div>

                          <div className="rp-permList">
                            {visible.map((p) => {
                              const on = stagedSet.has(p.key);
                              return (
                                <label key={p.key} className={cx("rp-permRow", on && "is-on")}>
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={!canManageRoles}
                                    onChange={() => togglePermission(p.key)}
                                  />
                                  <div className="rp-permRowMain">
                                    <div className="rp-permKey">{p.key}</div>
                                    <div className="rp-permDesc">{p.description || "—"}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!canManageRoles ? (
                    <div className="rp-hint">
                      You can view permissions, but cannot edit. Required: <code>roles.manage</code>
                    </div>
                  ) : null}
                </section>
              ) : (
                // Users Tab
                <section className="rp-tabBody">
                  <div className="rp-userToolbar">
                    <div className="rp-userToolbarLeft">
                      <div className="rp-panelTitleSm">Assigned users</div>
                      <div className="rp-mutedSm">
                        Add users to <b>{roleDetail.role.name}</b>
                      </div>
                    </div>

                    <div className="rp-userToolbarRight">
                      <div className="rp-search rp-searchWide">
                        <input
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Search users by name or email…"
                          disabled={!canManageRoles}
                        />
                      </div>
                    </div>
                  </div>

                  {userSearchLoading ? (
                    <div className="rp-loading rp-loadingSm">
                      <div className="rp-spinner" /> Searching…
                    </div>
                  ) : userSearchError ? (
                    <div className="rp-alert rp-alertError">
                      <div className="rp-alertTitle">User search failed</div>
                      <div className="rp-alertBody">{userSearchError}</div>
                    </div>
                  ) : userResults.length ? (
                    <div className="rp-card">
                      <div className="rp-cardTitle">Search results</div>
                      <div className="rp-userResults">
                        {userResults.map((u) => (
                          <div className="rp-userRow" key={u.id}>
                            <div className="rp-userMain">
                              <div className="rp-userName">{u.fullName || u.email}</div>
                              <div className="rp-userEmail">{u.email}</div>
                            </div>
                            <button
                              className="rp-btn rp-btnPrimary rp-btnSm"
                              disabled={!canManageRoles}
                              onClick={() => addUser(u.id)}
                            >
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rp-card">
                    <div className="rp-cardTitle">Users in this role</div>

                    {roleDetail.users?.length ? (
                      <div className="rp-userTable">
                        {roleDetail.users.map((u) => (
                          <div className="rp-userRow" key={u.id}>
                            <div className="rp-userMain">
                              <div className="rp-userName">{u.fullName || u.email}</div>
                              <div className="rp-userEmail">{u.email}</div>
                            </div>
                            {/* removeUser can be added if you expose the API method */}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rp-muted">No users assigned yet.</div>
                    )}

                    {!canManageRoles ? (
                      <div className="rp-hint">
                        You can view users, but cannot edit membership. Required: <code>roles.manage</code>
                      </div>
                    ) : null}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
