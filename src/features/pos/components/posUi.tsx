import type { ReactNode } from "react";

export const money = (n: number | null | undefined) => `$${Number(n || 0).toFixed(2)}`;

export function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid rgba(255,255,255,0.18)",
        borderTopColor: "#D4A853",
        borderRadius: "50%",
        animation: "hn-spin 0.7s linear infinite",
      }}
    />
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  disabled = false,
  loading = false,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "gold" | "danger" | "green";
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
}) {
  const variants = {
    ghost: { background: "#1F1F23", color: "#A1A09A", border: "1px solid rgba(255,255,255,0.08)" },
    gold: { background: "#D4A853", color: "#000", border: "1px solid #D4A853" },
    danger: { background: "rgba(248,113,113,.12)", color: "#F87171", border: "1px solid rgba(248,113,113,.25)" },
    green: { background: "rgba(74,222,128,.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,.25)" },
  } as const;

  return (
    <button
      type="button"
      onClick={!disabled && !loading ? onClick : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
        ...variants[variant],
        ...style,
      }}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        background: "#18181B",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "green" | "gold" | "danger" }) {
  const tones = {
    muted: { background: "#27272C", color: "#A1A09A" },
    green: { background: "rgba(74,222,128,.12)", color: "#4ADE80" },
    gold: { background: "rgba(212,168,83,.12)", color: "#D4A853" },
    danger: { background: "rgba(248,113,113,.12)", color: "#F87171" },
  };
  return <span style={{ borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700, ...tones[tone] }}>{children}</span>;
}

export function Field({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <span style={{ color: "#71717A", fontSize: 12 }}>{label}</span>
      <strong style={{ color: accent ? "#D4A853" : "#FAFAF9", fontSize: 13, textAlign: "right" }}>{value}</strong>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={{ textAlign: "center", padding: 36, color: "#71717A" }}>
      <div style={{ fontSize: 15, color: "#FAFAF9", marginBottom: 6 }}>{title}</div>
      {detail && <div style={{ fontSize: 13, lineHeight: 1.5 }}>{detail}</div>}
    </div>
  );
}

export function ensurePosStyles() {
  if (document.getElementById("erp-pos-styles")) return;
  const el = document.createElement("style");
  el.id = "erp-pos-styles";
  el.textContent = `
    @keyframes hn-spin { to { transform: rotate(360deg); } }
    .erp-pos-input {
      width: 100%;
      box-sizing: border-box;
      background: #1F1F23;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 8px;
      padding: 10px 12px;
      color: #FAFAF9;
      outline: none;
      font-family: inherit;
    }
    .erp-pos-label {
      display: block;
      color: #71717A;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 6px;
    }
  `;
  document.head.appendChild(el);
}
