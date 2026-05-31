import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import "./security.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

function userDisplayName(u: any): string {
  return u?.fullName ?? u?.email ?? u?.id ?? "Unknown";
}

function uniqSorted(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function toTitleCase(s: string): string {
  return s
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function groupLabel(group?: string | null): string {
  const g = normalize(group);
  return g ? toTitleCase(g) : "General";
}

function extractError(e: unknown): string {
  const err = e as any;
  return (
    err?.response?.data?.message ??
    err?.response?.data?.title ??
    err?.message ??
    "An unexpected error occurred."
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PermSwitch({ checked, disabled, onChange }: {
  checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`sec-switch${checked ? " is-on" : ""}`}
      onClick={onChange}
    >
      <span className="sec-switch__thumb" />
    </button>
  );
}

function PermRow({ title, subtitle, checked, disabled, onToggle }: {
  title: string; subtitle?: string | null;
  checked: boolean; disabled?: boolean; onToggle: () => void;
}) {
  return (
    <div
      className="sec-perm-row"
      aria-disabled={disabled ? "true" : undefined}
      onClick={disabled ? undefined : onToggle}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault(); onToggle();
        }
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="sec-perm-row__key">{title}</div>
        {subtitle && <div className="sec-perm-row__desc">{subtitle}</div>}
      </div>
      <PermSwitch checked={checked} disabled={disabled} onChange={onToggle} />
    </div>
  );
}

function SkeletonLines() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[70, 80, 60].map((w, i) => (
        <span key={i} className="sec-skeleton" style={{ height: 10, width: `${w}%` }} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RolesPermissionsPage() {
  const { companyId } = useAppScope();

  // FIX: treat empty string the same as null/undefined.
  // useAppScope returns "" as the default, which is falsy but typeof string,
  // so guards like `if (!companyId)` work — but passing "" to API calls
  // produces a malformed URL (/companies//security/...). Normalize to null.
  const cid = companyId;

  // ── User search + list ─────────────────────────────────────────────────────

  const [userQuery, setUserQuery] = useState("");

  const { users: allUsers = [],   loading: usersLoading,  error: usersError,  refresh: refreshUsers } = useUsers(cid);
  const { results: searchedUsers = [], loading: searchLoading, error: searchError } = useUserSearch(userQuery);

  const userOptions = useMemo(
    () => (normalize(userQuery) ? searchedUsers : allUsers),
    [userQuery, searchedUsers, allUsers]
  );

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { user: userDetail, loading: userLoading, error: userError, refresh: refreshUser } =
    useUser(cid, selectedUserId);

  // ── Branches ───────────────────────────────────────────────────────────────

  const { branches = [], loading: branchesLoading, error: branchesError } = useBranches(cid);

  // ── Roles ──────────────────────────────────────────────────────────────────

  const [roles,        setRoles]        = useState<RoleDto[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError,   setRolesError]   = useState<string | null>(null);

  const loadRoles = useCallback(async (signal?: AbortSignal) => {
    if (!cid) return;
    setRolesLoading(true);
    setRolesError(null);
    try {
      // FIX: securityApi.listRoles returns RoleDto[] directly (not { data: [] }).
      // The original read .data off the resolved value, making roles always undefined.
      const res = await securityApi.listRoles(cid);
      if (!signal?.aborted) setRoles(Array.isArray(res) ? res : []);
    } catch (e) {
      if (!signal?.aborted) setRolesError(extractError(e));
    } finally {
      if (!signal?.aborted) setRolesLoading(false);
    }
  }, [cid]);

  useEffect(() => {
    if (!cid) return;
    const ctrl = new AbortController();
    void loadRoles(ctrl.signal);
    return () => ctrl.abort();
  }, [cid, loadRoles]);

  // ── Permission catalog ─────────────────────────────────────────────────────

  const [directPerms,        setDirectPerms]        = useState<Set<string>>(new Set());
  const [permQuery,          setPermQuery]          = useState("");
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionCatalogItem[]>([]);
  const [permLoading,        setPermLoading]        = useState(false);
  const [permError,          setPermError]          = useState<string | null>(null);

  const loadPermsCatalog = useCallback(async (signal?: AbortSignal) => {
    if (!cid) return;
    setPermLoading(true);
    setPermError(null);
    try {
      // FIX: same unwrap bug — securityApi.listPermissions returns the array directly.
      const res = await securityApi.listPermissions(cid);
      if (!signal?.aborted) setPermissionsCatalog(Array.isArray(res) ? res : []);
    } catch (e) {
      if (!signal?.aborted) setPermError(extractError(e));
    } finally {
      if (!signal?.aborted) setPermLoading(false);
    }
  }, [cid]);

  useEffect(() => {
    if (!cid) return;
    const ctrl = new AbortController();
    void loadPermsCatalog(ctrl.signal);
    return () => ctrl.abort();
  }, [cid, loadPermsCatalog]);

  // Load user's direct permissions when selection changes
  const directPermsRef = useRef<AbortController | null>(null);
  useEffect(() => {
    directPermsRef.current?.abort();
    if (!cid || !selectedUserId) { setDirectPerms(new Set()); return; }
    const ctrl = new AbortController();
    directPermsRef.current = ctrl;
    usersApi.getUserPermissions(cid, selectedUserId)
      .then((keys) => { if (!ctrl.signal.aborted) setDirectPerms(new Set((keys ?? []).filter(Boolean))); })
      .catch(() => { if (!ctrl.signal.aborted) setDirectPerms(new Set()); });
    return () => ctrl.abort();
  }, [cid, selectedUserId]);

  // Filtered + grouped catalog
  const filteredPerms = useMemo(() => {
    const q = normalize(permQuery);
    if (!q) return permissionsCatalog;
    return permissionsCatalog.filter((p) =>
      [p.key, p.group, p.description].map(normalize).join(" ").includes(q)
    );
  }, [permissionsCatalog, permQuery]);

  const groupedPerms = useMemo(() => {
    const map = new Map<string, PermissionCatalogItem[]>();
    for (const p of filteredPerms) {
      const g = groupLabel(p.group);
      map.set(g, [...(map.get(g) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPerms]);

  const toggleDirectPerm = useCallback((key: string) => {
    setDirectPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // ── Effective permissions ──────────────────────────────────────────────────

  const roleAssignments = useMemo(() => {
    if (!selectedUserId) return [];
    return (userDetail?.assignments ?? []).map((x: any) => ({
      roleId: x.roleId, branchId: x.branchId ?? null,
    }));
  }, [selectedUserId, userDetail]);

  const { state: effectiveState, effective } = useEffectivePermissions(
    cid,
    roleAssignments,
    selectedUserId ? [...directPerms] : []
  );

  // ── UI state ───────────────────────────────────────────────────────────────

  const [newBranchId,  setNewBranchId]  = useState("");
  const [newRoleId,    setNewRoleId]    = useState("");
  const [savingRole,   setSavingRole]   = useState(false);
  const [savingPerms,  setSavingPerms]  = useState(false);
  const [errorBanner,  setErrorBanner]  = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<"direct" | "effective">("direct");

  const canInteract = !!cid && !!selectedUserId;
  const assignments = userDetail?.assignments ?? [];

  useEffect(() => {
    setErrorBanner(null);
    setNewRoleId("");
    setNewBranchId("");
    setActiveTab("direct");
  }, [selectedUserId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const onAddAssignment = useCallback(async () => {
    if (!canInteract) return;
    if (!newRoleId) { setErrorBanner("Select a role before adding."); return; }
    setErrorBanner(null);
    setSavingRole(true);
    try {
      await addUserRoleAssignment(cid!, {
        userId: selectedUserId!, roleId: newRoleId, branchId: newBranchId || null,
      });
      await Promise.all([refreshUser(), refreshUsers()]);
      setNewRoleId("");
    } catch (e) {
      setErrorBanner(extractError(e));
    } finally {
      setSavingRole(false);
    }
  }, [canInteract, cid, selectedUserId, newRoleId, newBranchId, refreshUser, refreshUsers]);

  const onRemoveAssignment = useCallback(async (assignmentId: string) => {
    if (!canInteract) return;
    if (!window.confirm("Remove this role assignment?")) return;
    setErrorBanner(null);
    setSavingRole(true);
    try {
      await removeUserRoleAssignment(cid!, { userId: selectedUserId!, assignmentId });
      await refreshUser();
    } catch (e) {
      setErrorBanner(extractError(e));
    } finally {
      setSavingRole(false);
    }
  }, [canInteract, cid, selectedUserId, refreshUser]);

  const onSaveDirectPermissions = useCallback(async () => {
    if (!canInteract) return;
    setErrorBanner(null);
    setSavingPerms(true);
    try {
      await usersApi.setUserPermissions(cid!, {
        userId: selectedUserId!, permissionKeys: uniqSorted([...directPerms]),
      });
      const keys = await usersApi.getUserPermissions(cid!, selectedUserId!);
      setDirectPerms(new Set((keys ?? []).filter(Boolean)));
    } catch (e) {
      setErrorBanner(extractError(e));
    } finally {
      setSavingPerms(false);
    }
  }, [canInteract, cid, selectedUserId, directPerms]);

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!cid) {
    return (
      <div className="sec-page">
        <div className="sec-guard">
          <div className="sec-guard__inner">
            <div className="sec-guard__icon">🔐</div>
            <div className="sec-guard__title">Company required</div>
            <div className="sec-guard__text">
              Navigate via a company context to manage access control.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedUserName = selectedUserId
    ? userDisplayName(userOptions.find((u: any) => u.id === selectedUserId) ?? userDetail)
    : "No user selected";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="sec-page">
      {/* Header */}
      <div className="sec-page-header">
        <div>
          <p className="sec-kicker">Security · Access control</p>
          <h1 className="sec-page-title">Access management</h1>
          <p className="sec-page-subtitle">
            Assign branch-scoped roles, configure direct permissions, and review the effective access set.
          </p>
        </div>

        <div className="sec-stats">
          <div className="sec-stat">
            <span className="sec-stat__label">Selected user</span>
            <span className="sec-stat__value" style={{ fontSize: 13, fontWeight: 600 }} title={selectedUserName}>
              {selectedUserName.length > 22 ? selectedUserName.slice(0, 20) + "…" : selectedUserName}
            </span>
          </div>
          <div className="sec-stat">
            <span className="sec-stat__label">Assignments</span>
            <span className="sec-stat__value">{canInteract ? assignments.length : "—"}</span>
          </div>
          <div className="sec-stat">
            <span className="sec-stat__label">Effective perms</span>
            <span className="sec-stat__value">
              {canInteract
                ? effectiveState.status === "loading" ? "…" : effective.length
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {errorBanner && (
        <div className="sec-alert sec-alert--error" role="alert" style={{ marginBottom: 16 }}>
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16 }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="sec-access-layout">

        {/* ── LEFT: User + Role assignments ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* User selector */}
          <div className="sec-panel">
            <div className="sec-panel__head">
              <span className="sec-panel__title">Select user</span>
              <span className="sec-panel__count">
                {usersLoading || searchLoading ? "Loading…" : `${userOptions.length} shown`}
              </span>
            </div>
            <div className="sec-panel__body">
              <input
                className="sec-search"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search users…"
                aria-label="Search users"
              />

              {(usersError || searchError) && (
                <div className="sec-alert sec-alert--error" role="alert" style={{ fontSize: 12 }}>
                  {usersError ?? searchError}
                </div>
              )}

              <select
                className="sec-select"
                value={selectedUserId ?? ""}
                onChange={(e) => setSelectedUserId(e.target.value || null)}
                aria-label="Selected user"
              >
                <option value="">— Select user —</option>
                {userOptions.map((u: any) => (
                  <option key={u.id} value={u.id}>{userDisplayName(u)}</option>
                ))}
              </select>

              {selectedUserId && userLoading && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Loading user detail…</div>
              )}
              {selectedUserId && userError && (
                <div className="sec-alert sec-alert--error" style={{ fontSize: 12 }}>{userError}</div>
              )}
            </div>
          </div>

          {/* Role assignments */}
          <div className="sec-panel">
            <div className="sec-panel__head">
              <span className="sec-panel__title">Role assignments</span>
              <span className="sec-panel__count">{canInteract ? `${assignments.length} assigned` : "—"}</span>
            </div>
            <div className="sec-panel__body">

              <div className="sec-inset">
                <div className="sec-inset__label">Add assignment</div>

                <div>
                  <label className="sec-field-label" htmlFor="new-branch">Branch scope</label>
                  <select
                    id="new-branch"
                    className="sec-select"
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    disabled={!canInteract || savingRole || branchesLoading}
                  >
                    <option value="">All branches (global scope)</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name ?? b.branchName ?? b.id}</option>
                    ))}
                  </select>
                  {branchesError && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{branchesError}</div>
                  )}
                </div>

                <div>
                  <label className="sec-field-label" htmlFor="new-role">Role</label>
                  <select
                    id="new-role"
                    className="sec-select"
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(e.target.value)}
                    disabled={!canInteract || savingRole || rolesLoading}
                  >
                    <option value="">— Select role —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {rolesError && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{rolesError}</div>
                  )}
                </div>

                <button
                  type="button"
                  className="sec-btn sec-btn--primary"
                  onClick={onAddAssignment}
                  disabled={!canInteract || savingRole || !newRoleId}
                >
                  {savingRole
                    ? <><span className="sec-spinner" />Saving…</>
                    : "Add assignment"}
                </button>
              </div>

              {canInteract && assignments.length === 0 && !userLoading && (
                <div className="sec-placeholder" style={{ padding: "14px 0" }}>
                  No role assignments yet.
                </div>
              )}

              {assignments.map((a: any) => (
                <div key={a.id} className="sec-assignment">
                  <div style={{ minWidth: 0 }}>
                    <div className="sec-assignment__role">{a.roleName}</div>
                    <div className="sec-assignment__branch">
                      Branch: {a.branchName ?? "All branches"}
                    </div>
                    <div className="sec-assignment__meta">
                      <span className="sec-chip">
                        {a.permissionCount} perm{a.permissionCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="sec-btn sec-btn--danger sec-btn--sm"
                    onClick={() => onRemoveAssignment(a.id)}
                    disabled={!canInteract || savingRole}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Permissions ── */}
        <div className="sec-panel">
          <div className="sec-panel__head">
            <div>
              <span className="sec-panel__title">Permissions</span>
              {canInteract && (
                <div className="sec-card__subtitle" style={{ marginTop: 2 }}>
                  Manage direct permissions and review the effective set.
                </div>
              )}
            </div>

            {canInteract && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="sec-tab-bar" role="tablist" aria-label="Permission view">
                  <button
                    role="tab"
                    aria-selected={activeTab === "direct"}
                    className={`sec-tab${activeTab === "direct" ? " is-active" : ""}`}
                    onClick={() => setActiveTab("direct")}
                  >
                    Direct
                  </button>
                  <button
                    role="tab"
                    aria-selected={activeTab === "effective"}
                    className={`sec-tab${activeTab === "effective" ? " is-active" : ""}`}
                    onClick={() => setActiveTab("effective")}
                  >
                    Effective
                  </button>
                </div>

                {activeTab === "direct" && (
                  <button
                    type="button"
                    className="sec-btn sec-btn--primary sec-btn--sm"
                    onClick={onSaveDirectPermissions}
                    disabled={!canInteract || savingPerms}
                  >
                    {savingPerms
                      ? <><span className="sec-spinner" />Saving…</>
                      : "Save"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="sec-panel__body">
            {!canInteract && (
              <div className="sec-placeholder">
                Select a user to manage their permissions.
              </div>
            )}

            {/* Effective tab */}
            {canInteract && activeTab === "effective" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Effective permissions</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
                    {effectiveState.status === "loading" ? "Calculating…"
                      : effectiveState.status === "error" ? "Error"
                      : `${effective.length} total`}
                  </span>
                </div>

                {effectiveState.status === "error" && (
                  <div className="sec-alert sec-alert--error" style={{ fontSize: 12 }}>
                    {effectiveState.message}
                  </div>
                )}

                {effectiveState.status === "loading" ? <SkeletonLines /> : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {effective.slice(0, 60).map((k) => (
                      <span key={k} className="sec-chip">{k}</span>
                    ))}
                    {effective.length > 60 && (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        +{effective.length - 60} more
                      </span>
                    )}
                    {effective.length === 0 && (
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>No effective permissions.</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Direct tab */}
            {canInteract && activeTab === "direct" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Direct permissions</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      Saved explicitly for this user — not inherited from roles.
                    </div>
                  </div>
                  <input
                    className="sec-search"
                    value={permQuery}
                    onChange={(e) => setPermQuery(e.target.value)}
                    placeholder="Search permissions…"
                    style={{ maxWidth: 240 }}
                    aria-label="Search permissions"
                  />
                </div>

                {permLoading && <SkeletonLines />}
                {permError && (
                  <div className="sec-alert sec-alert--error" style={{ fontSize: 12 }}>{permError}</div>
                )}

                {!permLoading && !permError && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {groupedPerms.map(([group, items]) => (
                      <div key={group} className="sec-perm-group">
                        <div className="sec-perm-group__head">
                          <span className="sec-perm-group__name">{group}</span>
                          <span className="sec-perm-group__count">{items.length}</span>
                        </div>
                        <div className="sec-perm-group__body">
                          {items.map((p) => (
                            <PermRow
                              key={p.key}
                              title={p.key}
                              subtitle={p.description ?? p.group ?? null}
                              checked={directPerms.has(p.key)}
                              disabled={!canInteract || savingPerms}
                              onToggle={() => toggleDirectPerm(p.key)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {filteredPerms.length === 0 && (
                      <div className="sec-placeholder">No permissions match your search.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}