import { useEffect, useRef, useState } from "react";
import type { UserDto } from "../api/securityApi";
import { displayUser, isStrongPassword } from "../utils/userManagement.utils";

export function ResetPasswordDialog({
  user,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  user: UserDto;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(): Promise<void> {
    const normalized = password.trim();
    if (!isStrongPassword(normalized)) {
      setValidationError("Password must be at least 8 characters and include uppercase, lowercase, and a number.");
      return;
    }
    await onSubmit(normalized);
  }

  return (
    <div className="lux-resetPw">
      <div className="lux-resetPw__title">Reset password</div>
      <div className="lux-resetPw__subtitle">For <strong>{displayUser(user)}</strong></div>
      <label className="lux-label">
        New password
        <input
          ref={inputRef}
          className="lux-input"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setValidationError(null);
          }}
          autoComplete="new-password"
          placeholder="Minimum 8 characters, uppercase, lowercase, number…"
          disabled={busy}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy) void submit();
          }}
        />
      </label>
      {(validationError || error) && <div className="lux-alert lux-alert--danger">{validationError || error}</div>}
      <div className="lux-row">
        <button className="lux-btn" onClick={onCancel} disabled={busy} type="button">Cancel</button>
        <button
          className="lux-btn lux-btn--primary"
          onClick={() => void submit()}
          disabled={busy || !isStrongPassword(password.trim())}
          type="button"
        >
          Update password
        </button>
      </div>
    </div>
  );
}
