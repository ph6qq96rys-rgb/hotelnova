import { useMemo, useState } from "react";
import type { CreateUserDto, UpdateUserDto, UserDto } from "../types";
import "../../../../styles/userForm.css";

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

function isValidEmail(v: string) {
  // Simple UI check (server should enforce real rules)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function splitRoles(input: string) {
  return input
    .split(",")
    .map((r: string) => r.trim())
    .filter(Boolean);
}

export default function UserForm(props: Props) {
  const { mode, onSubmit, onCancel, busy = false } = props;

  const initialUser: UserDto | null = mode === "edit" ? props.initial : null;

  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [userName, setUserName] = useState(initialUser?.userName ?? "");
  const [password, setPassword] = useState("");
  const [branchId] = useState(initialUser?.branchId ?? "");
  const [roles, setRoles] = useState(
    (initialUser as any)?.roles?.join?.(", ") ?? ""
  );

  const roleList = useMemo(() => splitRoles(roles), [roles]);

  const emailTrim = email.trim();
  const userNameTrim = userName.trim();
  const passwordTrim = password.trim();

  const emailOk = emailTrim.length > 0 && isValidEmail(emailTrim);
  const userNameOk = userNameTrim.length > 0;
  const passwordOk = mode === "create" ? passwordTrim.length >= 6 : true;

  const canSubmit = !busy && emailOk && userNameOk && passwordOk;

  const submit = async () => {
    if (!canSubmit) return;

    if (mode === "create") {
      const dto: CreateUserDto = {
        email: emailTrim,
        userName: userNameTrim,
        password: passwordTrim,
        branchId: branchId ? branchId : null,
        roles: roleList as any, // adjust if DTO differs
      };
      await onSubmit(dto);
      return;
    }

    const dto: UpdateUserDto = {
      email: emailTrim,
      userName: userNameTrim,
      roles: roleList as any, // adjust if DTO differs
    };
    await onSubmit(dto);
  };

  const removeRole = (role: string) => {
    const next = roleList.filter((r) => r.toLowerCase() !== role.toLowerCase());
    setRoles(next.join(", "));
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    // Submit on Enter, but allow newline-free inputs normally.
    if (e.key === "Enter") {
      // Avoid triggering if a button is focused and user presses Enter on it naturally
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "button") return;
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="lux-modalSheet" onKeyDown={onKeyDown}>
      {/* Header */}
      <div className="lux-modalHeader">
        <div>
          <div className="lux-kicker">Identity</div>
          <h2 className="lux-modalTitle">
            {mode === "create" ? "Create user" : "Edit user"}
          </h2>
          <p className="lux-modalSub">
            {mode === "create"
              ? "Provision a new user and set initial access."
              : "Update profile details and access fields."}
          </p>
        </div>

        <button
          className="lux-iconBtn"
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div className="lux-divider" />

      {/* Body */}
      <div className="lux-modalBody">
        <div className="lux-formGrid">
          {/* Email */}
          <label className="lux-field">
            <div className="lux-labelRow">
              <span className="lux-label">Email</span>
              {!emailTrim ? (
                <span className="lux-pill lux-pill--muted">Required</span>
              ) : emailOk ? (
                <span className="lux-pill lux-pill--ok">Valid</span>
              ) : (
                <span className="lux-pill lux-pill--warn">Check format</span>
              )}
            </div>

            <input
              className="lux-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              placeholder="name@company.com"
              inputMode="email"
              autoComplete="email"
            />

            {!emailTrim ? (
              <div className="lux-hint">We’ll use this for login and notifications.</div>
            ) : !emailOk ? (
              <div className="lux-hint lux-hint--warn">Enter a valid email address.</div>
            ) : (
              <div className="lux-hint">Looks good.</div>
            )}
          </label>

          {/* Username */}
          <label className="lux-field">
            <div className="lux-labelRow">
              <span className="lux-label">Username</span>
              {!userNameTrim ? (
                <span className="lux-pill lux-pill--muted">Required</span>
              ) : (
                <span className="lux-pill lux-pill--ok">Set</span>
              )}
            </div>

            <input
              className="lux-input"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={busy}
              placeholder="e.g. j.smith"
              autoComplete="username"
            />

            <div className="lux-hint">Used internally and in audit logs.</div>
          </label>

          {/* Password (create only) */}
          {mode === "create" ? (
            <label className="lux-field lux-field--span2">
              <div className="lux-labelRow">
                <span className="lux-label">Temporary password</span>
                <span className="lux-pill lux-pill--muted">Min 6 chars</span>
              </div>

              <input
                className="lux-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                placeholder="Create a temporary password…"
                autoComplete="new-password"
              />

              <div className={passwordTrim.length > 0 && !passwordOk ? "lux-hint lux-hint--warn" : "lux-hint"}>
                {passwordTrim.length > 0 && !passwordOk
                  ? "Password is too short."
                  : "User can change this after first login (server policy still applies)."}
              </div>
            </label>
          ) : null}

          {/* Roles */}
          <label className="lux-field lux-field--span2">
            <div className="lux-labelRow">
              <span className="lux-label">Roles</span>
              <span className="lux-pill lux-pill--muted">Comma separated</span>
            </div>

            <input
              className="lux-input"
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              disabled={busy}
              placeholder="Admin, Manager"
              autoComplete="off"
            />

            {roleList.length > 0 ? (
              <div className="lux-chipRow" aria-label="Selected roles">
                {roleList.map((r) => (
                  <span key={r} className="lux-chip">
                    {r}
                    <button
                      type="button"
                      className="lux-chipX"
                      onClick={() => removeRole(r)}
                      disabled={busy}
                      aria-label={`Remove role ${r}`}
                      title="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="lux-hint">Add roles to grant initial access.</div>
            )}
          </label>
        </div>
      </div>

      <div className="lux-divider" />

      {/* Footer */}
      <div className="lux-modalFooter">
        <button className="lux-btn" onClick={onCancel} disabled={busy} type="button">
          Cancel
        </button>

        <button
          className="lux-btn lux-btn--primary"
          onClick={() => void submit()}
          disabled={!canSubmit}
          type="button"
        >
          {busy ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
