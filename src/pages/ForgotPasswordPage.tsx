import { useState } from "react";
import { Link } from "react-router-dom";
import {authApi} from "../auth/auth.api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);

    try {
      await authApi.forgotPassword(email);
      setMsg("If that email exists, a reset link/code was sent.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto" }}>
      <h2>Forgot password</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        {msg && <div style={{ color: "green" }}>{msg}</div>}
        {error && <div style={{ color: "crimson" }}>{error}</div>}
        <button disabled={busy}>{busy ? "Sending..." : "Send reset"}</button>
      </form>

      <div style={{ marginTop: 12 }}>
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  );
}
