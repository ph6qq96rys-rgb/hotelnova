import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../auth/auth.api";

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Auto-fill from reset link: /reset-password?email=...&token=...
  useEffect(() => {
    const qEmail = sp.get("email") ?? "";
    const qToken = sp.get("token") ?? "";

    // Some systems URL-encode token; keep as-is. If your backend expects + not space:
    // const normalizedToken = qToken.replace(/ /g, "+");
    // setToken(normalizedToken);

    if (!email && qEmail) setEmail(qEmail);
    if (!token && qToken) setToken(qToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const canSubmit = useMemo(() => {
    return !!email && !!token && newPassword.length >= 6 && !busy;
  }, [email, token, newPassword, busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await authApi.resetPassword({ email, token, newPassword });
      nav("/login", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm bg-white">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Reset password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your email, the reset token, and a new password.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring"
              placeholder="you@example.com"
              disabled={busy}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Reset token</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="text"
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring"
              placeholder="Paste the token from the email link"
              disabled={busy}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Tip: If you clicked a link, this may auto-fill.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">New password</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring"
              placeholder="••••••••"
              disabled={busy}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm">
          <Link className="text-blue-600 hover:underline" to="/forgot-password">
            Back to forgot password
          </Link>
          <Link className="text-gray-600 hover:underline" to="/login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
