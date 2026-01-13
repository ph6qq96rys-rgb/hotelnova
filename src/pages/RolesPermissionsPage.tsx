import { useEffect, useMemo, useState } from "react";
import type { AssignRoleRequest, PermissionDto, RoleUserDto } from "../api/identity/identityTypes";
import { assignRole, getPermissions, getRoleUsers } from "../modules/security/api/rolesApi";


type LoadState =
  | { status: "loading" }
  | { status: "loaded"; permissions: PermissionDto[]; roleUsers: RoleUserDto[] }
  | { status: "error"; message: string };

export default function RolesPermissionsPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [permQuery, setPermQuery] = useState("");
  const [assign, setAssign] = useState<AssignRoleRequest>({ userId: "", roleName: "" });

  async function load() {
    try {
      setState({ status: "loading" });
      const [permissions, roleUsers] = await Promise.all([getPermissions(), getRoleUsers()]);
      setState({ status: "loaded", permissions, roleUsers });
    } catch (err: any) {
      setState({ status: "error", message: err?.message ?? "Failed to load roles & permissions." });
    }
  }

  useEffect(() => { load(); }, []);

  const filteredPerms = useMemo(() => {
    if (state.status !== "loaded") return [];
    const q = permQuery.trim().toLowerCase();
    if (!q) return state.permissions;
    return state.permissions.filter(p =>
      (p.key ?? "").toLowerCase().includes(q) ||
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q) ||
      (p.group ?? "").toLowerCase().includes(q)
    );
  }, [state, permQuery]);

  async function onAssign() {
    if (!assign.userId || !assign.roleName) {
      alert("Select a user and enter a role name.");
      return;
    }
    await assignRole(assign);
    alert("Role assigned.");
    setAssign({ userId: "", roleName: "" });
    await load();
  }

  if (state.status === "loading") {
    return <div className="hna-page"><h1>Roles & Permissions</h1><p>Loading...</p></div>;
  }

  if (state.status === "error") {
    return (
      <div className="hna-page">
        <h1>Roles & Permissions</h1>
        <div className="hna-alert hna-alert-error">
          <div className="hna-alert-title">Couldn’t load</div>
          <div className="hna-alert-body">{state.message}</div>
          <button className="hna-btn" onClick={load} type="button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hna-page">
      <div className="hna-page-header">
        <div>
          <h1>Roles & Permissions</h1>
          <p>View permissions and assign roles to users</p>
        </div>
      </div>

      <div className="hna-grid" style={{ gridTemplateColumns: "1.25fr .75fr" }}>
        <div className="hna-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800 }}>Permissions</div>
            <input
              value={permQuery}
              onChange={(e) => setPermQuery(e.target.value)}
              placeholder="Search permissions..."
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "transparent" }}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {filteredPerms.map(p => (
              <div key={p.key} style={{ border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>{p.name ?? p.key}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{p.group ?? ""}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>{p.description ?? p.key}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}><code>{p.key}</code></div>
              </div>
            ))}
            {filteredPerms.length === 0 && <div style={{ opacity: 0.8 }}>No permissions found.</div>}
          </div>
        </div>

        <div className="hna-card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Assign Role</div>

          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>User</span>
            <select
              value={assign.userId}
              onChange={(e) =>
                  setAssign(a => ({ ...a, userId: e.target.value }))}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "transparent" }}
            >
              <option value="">Select user...</option>
              {state.roleUsers.map(u => (
                <option key={u.userId} value={u.userId}>
                  {(u.userName ?? u.email ?? u.userId)} {u.roles?.length ? `(${u.roles.join(", ")})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Role name</span>
            <input
              value={assign.roleName}
             onChange={(e) =>
              setAssign(a => ({ ...a, roleName: e.target.value }))}
              placeholder="e.g. Admin, Manager, Cashier"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "transparent" }}
            />
          </label>

          <button className="hna-btn hna-btn-primary" onClick={onAssign} type="button">
            Assign
          </button>

          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,.10)", margin: "14px 0" }} />

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Users & Roles</div>
          <div style={{ display: "grid", gap: 8 }}>
            {state.roleUsers.map(u => (
              <div key={u.userId} style={{ border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 10 }}>
                <div style={{ fontWeight: 800 }}>{u.userName ?? u.email ?? u.userId}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{u.email ?? ""}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                  Roles: {u.roles?.length ? u.roles.join(", ") : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
