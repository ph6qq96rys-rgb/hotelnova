import { useMemo, useState } from "react";
import type { CreateUserDto, UpdateUserDto, UserDto } from "../types";

type BaseProps = {
  onCancel: () => void;
  busy?: boolean;
};

type CreateProps = BaseProps & {
  mode: "create";
  onSubmit: (dto: CreateUserDto) => Promise<void>;
};

type EditProps = BaseProps & {
  mode: "edit";
  initial: UserDto;
  onSubmit: (dto: UpdateUserDto) => Promise<void>;
};

type Props = CreateProps | EditProps;

export default function UserForm(props: Props) {
  const { mode, onSubmit, onCancel, busy = false } = props;

  // ✅ Only available in edit mode
  const initialUser: UserDto | null = mode === "edit" ? props.initial : null;

  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [userName, setUserName] = useState(initialUser?.userName ?? "");
  const [password, setPassword] = useState(""); // only used for create (or if you decide)
  const [roles, setRoles] = useState((initialUser as any)?.roles?.join?.(", ") ?? "");

  // ✅ Fix TS7006 by typing r
  const roleList = useMemo(
    () =>
      roles
        .split(",")
        .map((r: string) => r.trim())
        .filter(Boolean),
    [roles]
  );

  const submit = async () => {
    if (mode === "create") {
      const dto: CreateUserDto = {
        email,
        userName,
        password,
        roles: roleList as any, // adjust if your CreateUserDto uses different field name
      };
      await onSubmit(dto);
      return;
    }

    // edit
    const dto: UpdateUserDto = {
      email,
      userName,
      roles: roleList as any, // adjust if your UpdateUserDto uses different field name
    };
    await onSubmit(dto);
  };

  return (
    <div>
      <div className="modal-header">
        <h2>{mode === "create" ? "Create User" : "Edit User"}</h2>
      </div>

      <div className="modal-body">
        <div className="form">
          <label className="label">Email</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />

          <label className="label">Username</label>
          <input
            className="input"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            disabled={busy}
          />

          {mode === "create" ? (
            <>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </>
          ) : null}

          <label className="label">Roles (comma separated)</label>
          <input
            className="input"
            value={roles}
            onChange={(e) => setRoles(e.target.value)}
            disabled={busy}
            placeholder="Admin, Manager"
          />
        </div>
      </div>

      <div className="modal-footer row gap">
        <button className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void submit()} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
