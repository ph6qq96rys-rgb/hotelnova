import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { safeReturnUrl } from "../auth/returnUrl";

export default function LoginPage() {
  const { login, isAuthenticated, isReady } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = sp.get("returnUrl");

    const state = location.state as any;
    const from = state?.from;
    const fromPath = typeof from === "string" ? from : from?.pathname;

    return safeReturnUrl(raw ?? fromPath, "/dashboard");
  }, [location.search, location.state]);

  const redirected = useRef(false);

  useEffect(() => {
    if (!isReady) return;

    if (isAuthenticated && !redirected.current) {
      redirected.current = true;
      nav(redirectTo, { replace: true });
    }
  }, [isReady, isAuthenticated, nav, redirectTo]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await login({ email, password });
      // redirect happens in effect once isAuthenticated flips true
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Login failed");
      setBusy(false); // keep here so user can retry immediately on error
      return;
    }

    setBusy(false);
  }

  if (!isReady) return null;

  if (isAuthenticated) {
    return <div style={{ padding: 24, opacity: 0.8 }}>Redirecting…</div>;
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto" }}>
      <h2>Sign in</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          required
          autoComplete="email"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          required
          autoComplete="current-password"
        />

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        <button disabled={busy}>{busy ? "Signing in..." : "Login"}</button>
      </form>

      <div style={{ marginTop: 12 }}>
        {/* Important: don’t pass current /login?returnUrl=... into /register */}
        <Link to="/register">Create account</Link>
      </div>
    </div>
  );
}
