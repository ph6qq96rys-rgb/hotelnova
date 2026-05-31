import { useEffect, useMemo, useRef, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { useAuth } from "../../../auth/AuthProvider";
import { usePageMeta } from "../../../hooks/usePageMeta";

import {
  securityApi,
  type PermissionDto,
  type RoleDto,
  type RoleDetailDto,
  type UserLiteDto,
} from "../api/securityApi";

import {
  groupPermissions,
  isPermissionsDirty,
  extractSecurityError,
  userDisplayName,
  userInitials,
} from "../utils/security.utils";

import {
  T, Btn, Input, Alert, Badge, Avatar, StatCard,
  PermDot, SkeletonRows, EmptyState, SectionHead,
  Drawer, Field, Spinner,
} from "../components/security.ui";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = "permissions" | "users";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RolesPermissionsPage() {
  usePageMeta({ title: "Roles & Permissions", subtitle: "Role-based access control" });

  const { companyId } = useAppScope();
  const { hasPermission } = useAuth();

  const canView        = hasPermission("roles.view") || hasPermission("users.view");
  const canManageRoles = hasPermission("roles.manage");

  // ── Core state ─────────────────────────────────────────────────────────────

  const [roles,          setRoles]          = useState<RoleDto[]>([]);
  const [permissions,    setPermissions]    = useState<PermissionDto[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleDetail,     setRoleDetail]     = useState<RoleDetailDto | null>(null);

  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState<string | null>(null);
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [saveOk,        setSaveOk]        = useState(false);

  const [tab, setTab] = useState<TabKey>("permissions");

  // ── Search ─────────────────────────────────────────────────────────────────

  const [roleSearch, setRoleSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");

  // ── Permissions staging ────────────────────────────────────────────────────

  const [staged, setStaged] = useState<string[]>([]);
  const stagedSet = useMemo(() => new Set(staged), [staged]);
  const isDirty   = useMemo(() => isPermissionsDirty(roleDetail?.permissionKeys ?? [], staged), [roleDetail, staged]);

  const permGroups = useMemo(() => groupPermissions(permissions), [permissions]);

  // ── Users tab ──────────────────────────────────────────────────────────────

  const [userSearch,        setUserSearch]        = useState("");
  const [userResults,       setUserResults]       = useState<UserLiteDto[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError,   setUserSearchError]   = useState<string | null>(null);
  const userSearchTimer = useRef<number | null>(null);

  // ── Drawers ────────────────────────────────────────────────────────────────

  const [showRoleDrawer,  setShowRoleDrawer]  = useState(false);
  const [editingRole,     setEditingRole]     = useState<RoleDto | null>(null);
  const [roleName,        setRoleName]        = useState("");
  const [roleDesc,        setRoleDesc]        = useState("");
  const [roleSaving,      setRoleSaving]      = useState(false);
  const [roleDrawerError, setRoleDrawerError] = useState<string | null>(null);

  // ── Unmount guard ──────────────────────────────────────────────────────────

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // ── Load roles + permissions ───────────────────────────────────────────────

  useEffect(() => {
    if (!canView || !companyId) return;
    setLoading(true); setError(null);
    Promise.all([securityApi.listRoles(companyId), securityApi.listPermissions(companyId)])
      .then(([r, p]) => {
        if (!alive.current) return;
        setRoles(r ?? []); setPermissions(p ?? []);
      })
      .catch((e) => { if (alive.current) setError(extractSecurityError(e, "Failed to load security data")); })
      .finally(() => { if (alive.current) setLoading(false); });
  }, [canView, companyId]);

  // ── Load role detail ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedRoleId || !companyId) {
      setRoleDetail(null); setStaged([]); setDetailError(null); return;
    }
    setDetailLoading(true); setDetailError(null); setSaveError(null); setSaveOk(false);
    securityApi.getRole(companyId, selectedRoleId)
      .then((r) => {
        if (!alive.current) return;
        setRoleDetail(r); setStaged(r.permissionKeys ?? []);
      })
      .catch((e) => { if (alive.current) setDetailError(extractSecurityError(e, "Failed to load role")); })
      .finally(() => { if (alive.current) setDetailLoading(false); });
  }, [selectedRoleId, companyId]);

  // ── Filtered roles ─────────────────────────────────────────────────────────

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      `${r.name} ${r.description ?? ""}`.toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);

  // ── Permission actions ─────────────────────────────────────────────────────

  const togglePermission = (key: string) => {
    setStaged((prev) => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return [...s].sort();
    });
  };

  const bulkToggle = (group: string, on: boolean) => {
    const items = permGroups.find((g) => g.group === group)?.items ?? [];
    setStaged((prev) => {
      const s = new Set(prev);
      for (const p of items) on ? s.add(p.key) : s.delete(p.key);
      return [...s].sort();
    });
  };

  async function savePermissions() {
    if (!canManageRoles || !roleDetail || !companyId) return;
    setSaveError(null); setSaveOk(false);
    try {
      await securityApi.setRolePermissions(companyId, roleDetail.role.id, staged);
      const d = await securityApi.getRole(companyId, roleDetail.role.id);
      if (!alive.current) return;
      setRoleDetail(d); setStaged(d.permissionKeys ?? []);
      setSaveOk(true);
      setTimeout(() => { if (alive.current) setSaveOk(false); }, 3000);
    } catch (e) {
      setSaveError(extractSecurityError(e, "Failed to save permissions"));
    }
  }

  // ── User search (debounced) ────────────────────────────────────────────────

  useEffect(() => {
    if (tab !== "users" || !selectedRoleId || !companyId) return;
    if (userSearchTimer.current) window.clearTimeout(userSearchTimer.current);
    const q = userSearch.trim();
    if (!q) { setUserResults([]); return; }
    userSearchTimer.current = window.setTimeout(async () => {
      setUserSearchLoading(true); setUserSearchError(null);
      try {
        const r = await securityApi.searchUsers(companyId, q);
        if (alive.current) setUserResults(r ?? []);
      } catch (e) {
        if (alive.current) setUserSearchError(extractSecurityError(e, "User search failed"));
      } finally {
        if (alive.current) setUserSearchLoading(false);
      }
    }, 350);
    return () => { if (userSearchTimer.current) window.clearTimeout(userSearchTimer.current); };
  }, [userSearch, tab, selectedRoleId, companyId]);

  async function addUser(userId: string) {
    if (!canManageRoles || !roleDetail || !companyId) return;
    try {
      await securityApi.addUserToRole(companyId, roleDetail.role.id, userId);
      const d = await securityApi.getRole(companyId, roleDetail.role.id);
      if (!alive.current) return;
      setRoleDetail(d); setUserSearch(""); setUserResults([]);
    } catch (e) {
      setUserSearchError(extractSecurityError(e, "Failed to add user"));
    }
  }

  async function removeUser(userId: string) {
    if (!canManageRoles || !roleDetail || !companyId) return;
    try {
      await securityApi.removeUserFromRole(companyId, roleDetail.role.id, userId);
      const d = await securityApi.getRole(companyId, roleDetail.role.id);
      if (alive.current) setRoleDetail(d);
    } catch (e) {
      setUserSearchError(extractSecurityError(e, "Failed to remove user"));
    }
  }

  // ── Role drawer ────────────────────────────────────────────────────────────

  function openCreateDrawer() {
    setEditingRole(null); setRoleName(""); setRoleDesc(""); setRoleDrawerError(null); setShowRoleDrawer(true);
  }

  function openEditDrawer(role: RoleDto) {
    setEditingRole(role); setRoleName(role.name); setRoleDesc(role.description ?? ""); setRoleDrawerError(null); setShowRoleDrawer(true);
  }

  async function saveRole() {
    if (!companyId) return;
    const name = roleName.trim();
    if (!name) { setRoleDrawerError("Name is required."); return; }
    setRoleSaving(true); setRoleDrawerError(null);
    try {
      if (editingRole) {
        await securityApi.updateRole(companyId, editingRole.id, { name, description: roleDesc.trim() || null });
      } else {
        const newId = await securityApi.createRole(companyId, { name, description: roleDesc.trim() || null });
        if (newId) setSelectedRoleId(newId);
      }
      const refreshed = await securityApi.listRoles(companyId);
      if (alive.current) { setRoles(refreshed ?? []); setShowRoleDrawer(false); }
    } catch (e) {
      if (alive.current) setRoleDrawerError(extractSecurityError(e, "Failed to save role"));
    } finally {
      if (alive.current) setRoleSaving(false);
    }
  }

  async function deleteRole(role: RoleDto) {
    if (!canManageRoles || !companyId) return;
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await securityApi.deleteRole(companyId, role.id);
      const refreshed = await securityApi.listRoles(companyId);
      if (!alive.current) return;
      setRoles(refreshed ?? []);
      if (selectedRoleId === role.id) setSelectedRoleId(null);
    } catch (e) {
      setError(extractSecurityError(e, "Failed to delete role"));
    }
  }

  function switchRole(id: string) {
    if (isDirty && !window.confirm("Discard unsaved permission changes?")) return;
    setSelectedRoleId(id); setTab("permissions"); setUserSearch(""); setUserResults([]);
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!canView) {
    return (
      <div style={shell}>
        <EmptyState icon="🔒" title="Access denied" sub="You don't have permission to view this page." />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={shell}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: T.text, margin: 0, fontFamily: T.font }}>
            Roles & Permissions
          </h1>
          <p style={{ fontSize: 13, color: T.muted, margin: "4px 0 0", fontFamily: T.font }}>
            Role-based access control across all modules
          </p>
        </div>
        {canManageRoles && (
          <Btn variant="primary" onClick={openCreateDrawer}>+ New role</Btn>
        )}
      </div>

      {error && <Alert type="error" title="Failed to load" body={error} />}

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>

        {/* ── Left: Role list ── */}
        <aside style={{ ...card, overflow: "hidden" }}>
          <div style={panelHead}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Roles</span>
            <Badge label={String(roles.length)} />
          </div>

          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
            <Input
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              placeholder="Search roles…"
            />
          </div>

          {loading ? (
            <SkeletonRows count={5} />
          ) : filteredRoles.length === 0 ? (
            <EmptyState icon="🎭" title="No roles" sub={roleSearch ? "No matches." : "Create your first role."} />
          ) : (
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredRoles.map((r) => {
                const active = r.id === selectedRoleId;
                return (
                  <button
                    key={r.id}
                    onClick={() => switchRole(r.id)}
                    style={{
                      width: "100%", display: "flex", gap: 10, alignItems: "center",
                      justifyContent: "space-between", padding: "10px 12px",
                      borderRadius: T.radiusLg, cursor: "pointer", textAlign: "left",
                      fontFamily: T.font,
                      background: active ? T.accent : T.bgSec,
                      border: `1px solid ${active ? T.accent : T.border}`,
                      color: active ? "#fff" : T.text,
                      transition: "all 0.1s",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {r.name}
                        {r.isSystem && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 999,
                            background: active ? "rgba(255,255,255,0.2)" : T.bgTer,
                            color: active ? "#fff" : T.hint,
                            border: `1px solid ${active ? "rgba(255,255,255,0.3)" : T.border}`,
                          }}>
                            System
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.description}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 10, opacity: 0.65 }}>Users</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.userCount ?? "—"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* ── Right: Role detail ── */}
        <main style={{ ...card, minHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {!selectedRoleId ? (
            <EmptyState icon="🧩" title="Select a role" sub="Choose a role from the list to manage its permissions and members." />
          ) : detailLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 20, color: T.muted, fontSize: 13 }}>
              <Spinner /> Loading role…
            </div>
          ) : detailError ? (
            <div style={{ padding: 16 }}><Alert type="error" title="Couldn't load role" body={detailError} /></div>
          ) : !roleDetail ? null : (
            <>
              {/* Role header */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 8, fontFamily: T.font }}>
                      {roleDetail.role.name}
                      {roleDetail.role.isSystem && <Badge label="System" variant="system" />}
                    </div>
                    <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                      {roleDetail.role.description || "No description"}
                    </div>
                  </div>
                  {canManageRoles && !roleDetail.role.isSystem && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant="ghost" onClick={() => openEditDrawer(roleDetail.role)}>Edit</Btn>
                      <Btn variant="danger" onClick={() => deleteRole(roleDetail.role)}>Delete</Btn>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <StatCard label="Permissions" value={staged.length} />
                  <StatCard label="Users" value={roleDetail.users?.length ?? 0} />
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, padding: "10px 20px", borderBottom: `1px solid ${T.border}` }}>
                {(["permissions", "users"] as TabKey[]).map((t) => (
                  <Btn
                    key={t}
                    variant={tab === t ? "primary" : "ghost"}
                    onClick={() => setTab(t)}
                    style={{ padding: "7px 14px", fontSize: 13 }}
                  >
                    {t === "permissions" ? "Permissions" : "Users"}
                  </Btn>
                ))}
              </div>

              {/* ── Permissions tab ── */}
              {tab === "permissions" && (
                <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
                  {saveError && <Alert type="error" title="Save failed" body={saveError} />}
                  {saveOk    && <Alert type="success" title="Permissions saved" />}

                  {/* Toolbar */}
                  <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Input
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Search permissions…"
                      style={{ maxWidth: 280 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant="ghost" disabled={!isDirty} onClick={() => setStaged(roleDetail.permissionKeys ?? [])}>
                        Reset
                      </Btn>
                      <Btn variant="primary" disabled={!canManageRoles || !isDirty} onClick={savePermissions}>
                        {isDirty ? "Save changes" : "Saved"}
                      </Btn>
                    </div>
                  </div>

                  {/* Permission groups grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {permGroups.map((g) => {
                      const q = permSearch.trim().toLowerCase();
                      const visible = q
                        ? g.items.filter((p) =>
                            p.key.toLowerCase().includes(q) ||
                            (p.description ?? "").toLowerCase().includes(q)
                          )
                        : g.items;
                      if (!visible.length) return null;

                      const allOn  = visible.every((p) => stagedSet.has(p.key));
                      const someOn = visible.some((p) => stagedSet.has(p.key));

                      return (
                        <div key={g.group} style={{ ...card, overflow: "hidden", margin: 0, border: `1px solid ${T.border}` }}>
                          {/* Group header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{g.group}</span>
                              <span style={{ fontSize: 11, color: T.hint, background: T.bgSec, padding: "1px 7px", borderRadius: 999, border: `1px solid ${T.border}` }}>
                                {visible.length}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Btn variant="mini" disabled={!canManageRoles} onClick={() => bulkToggle(g.group, true)}>All</Btn>
                              <Btn variant="mini" disabled={!canManageRoles} onClick={() => bulkToggle(g.group, false)}>None</Btn>
                              <PermDot state={allOn ? "all" : someOn ? "some" : "none"} />
                            </div>
                          </div>

                          {/* Permission rows */}
                          <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                            {visible.map((p) => {
                              const on = stagedSet.has(p.key);
                              return (
                                <label
                                  key={p.key}
                                  style={{
                                    display: "flex", gap: 10, alignItems: "flex-start",
                                    padding: "9px 10px", borderRadius: T.radius,
                                    border: `1px solid ${on ? T.borderSec : T.border}`,
                                    background: on ? T.accentBg : T.bgSec,
                                    cursor: canManageRoles ? "pointer" : "default",
                                    transition: "all 0.1s",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={!canManageRoles}
                                    onChange={() => togglePermission(p.key)}
                                    style={{ marginTop: 2, accentColor: T.accent }}
                                  />
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: T.mono }}>{p.key}</div>
                                    <div style={{ fontSize: 11, color: T.muted, marginTop: 3, lineHeight: 1.3 }}>{p.description || "—"}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!canManageRoles && (
                    <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: T.radius, border: `1px dashed ${T.border}`, fontSize: 12, color: T.muted }}>
                      View only — editing requires the <code>roles.manage</code> permission.
                    </div>
                  )}
                </div>
              )}

              {/* ── Users tab ── */}
              {tab === "users" && (
                <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
                  <SectionHead
                    title="Members"
                    sub={`Users assigned to ${roleDetail.role.name}`}
                  />

                  {canManageRoles && (
                    <div style={{ marginTop: 14 }}>
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search users by name or email to add…"
                      />

                      {userSearchLoading && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: T.muted }}>
                          <Spinner size={14} /> Searching…
                        </div>
                      )}
                      {userSearchError && <Alert type="error" title="Search failed" body={userSearchError} />}

                      {!userSearchLoading && userResults.length > 0 && (
                        <div style={{ ...card, margin: "10px 0 0", padding: 0, overflow: "hidden" }}>
                          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, color: T.muted }}>
                            Search results
                          </div>
                          {userResults.map((u) => (
                            <div key={u.id} style={userRow}>
                              <Avatar initials={userInitials(u)} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{userDisplayName(u)}</div>
                                <div style={{ fontSize: 11, color: T.muted }}>{u.email}</div>
                              </div>
                              <Btn variant="primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => addUser(u.id)}>
                                Add
                              </Btn>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Current members */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      Current members ({roleDetail.users?.length ?? 0})
                    </div>

                    {roleDetail.users?.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {roleDetail.users.map((u) => (
                          <div key={u.id} style={userRow}>
                            <Avatar initials={userInitials(u)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{userDisplayName(u)}</div>
                              <div style={{ fontSize: 11, color: T.muted }}>{u.email}</div>
                            </div>
                            {canManageRoles && !roleDetail.role.isSystem && (
                              <Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12, color: T.danger }} onClick={() => removeUser(u.id)}>
                                Remove
                              </Btn>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon="👥" title="No members" sub="Search above to add users to this role." />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Role create/edit drawer ── */}
      <Drawer
        open={showRoleDrawer}
        title={editingRole ? "Edit role" : "Create role"}
        onClose={() => setShowRoleDrawer(false)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setShowRoleDrawer(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveRole} disabled={roleSaving || !roleName.trim()}>
              {roleSaving ? "Saving…" : editingRole ? "Save changes" : "Create role"}
            </Btn>
          </>
        }
      >
        {roleDrawerError && <Alert type="error" title="Error" body={roleDrawerError} />}
        <Field label="Role name *" hint="Must be unique across the company.">
          <Input
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. Inventory Manager"
            autoFocus
          />
        </Field>
        <Field label="Description" hint="Optional — helps users understand what this role allows.">
          <textarea
            value={roleDesc}
            onChange={(e) => setRoleDesc(e.target.value)}
            placeholder="Describe the responsibilities of this role…"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", padding: "8px 12px",
              borderRadius: T.radius, fontSize: 13, border: `1px solid ${T.border}`,
              background: T.bg, color: T.text, outline: "none",
              fontFamily: T.font, resize: "vertical",
            }}
          />
        </Field>
      </Drawer>
    </div>
  );
}

// ── Layout constants ──────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  padding: "24px 28px",
  maxWidth: 1400,
  margin: "0 auto",
  fontFamily: T.font,
};

const card: React.CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusLg,
  marginTop: 0,
};

const panelHead: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 14px 10px",
  borderBottom: `1px solid ${T.border}`,
};

const userRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
  borderBottom: `1px solid ${T.border}`,
};