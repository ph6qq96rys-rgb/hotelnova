import type { UserDto } from "../types";

type Props = {
  items: UserDto[];
  onEdit: (u: UserDto) => void;
  onToggleActive: (u: UserDto) => Promise<void>;
  onResetPassword: (u: UserDto) => Promise<void>;
  busy?: boolean;
};

export default function UsersTable({
  items,
  onEdit,
  onToggleActive,
  onResetPassword,
  busy = false,
}: Props) {
  if (!items || items.length === 0) {
    return <div className="muted">No users found.</div>;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Users</h2>
      </div>

      <div className="card-body" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Username</th>
              <th>Status</th>
              <th style={{ width: 260 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.userName ?? "-"}</td>
                <td>{u.email ?? "-"}</td>
                <td>{u.userName ?? "-"}</td>
                <td>
                  <span className={`badge ${u.isActive ? "success" : "muted"}`}>
                    {u.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td>
                  <div className="row gap">
                    <button
                      className="btn"
                      type="button"
                      onClick={() => onEdit(u)}
                      disabled={busy}
                    >
                      Edit
                    </button>

                    <button
                      className="btn"
                      type="button"
                      onClick={() => void onToggleActive(u)}
                      disabled={busy}
                    >
                      {u.isActive ? "Disable" : "Enable"}
                    </button>

                    <button
                      className="btn"
                      type="button"
                      onClick={() => void onResetPassword(u)}
                      disabled={busy}
                    >
                      Reset PW
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {busy ? <div className="muted" style={{ marginTop: 10 }}>Working...</div> : null}
      </div>
    </div>
  );
}
