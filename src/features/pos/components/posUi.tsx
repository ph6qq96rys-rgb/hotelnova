// src/features/pos/components/posUi.tsx

import type { CSSProperties, ReactNode } from "react";
import { Button as SharedButton } from "../../../components/ui/button";
import "../../../styles/erp-tokens.css";

export const money = (n: number | null | undefined) =>
  `${Number(n || 0).toFixed(2)} ETB`;

export function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid var(--erp-border)",
        borderTopColor: "var(--erp-accent)",
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
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "gold" | "danger" | "green";
  disabled?: boolean;
  loading?: boolean;
  style?: CSSProperties;
  className?: string;
  title?: string;
}) {
  return <SharedButton type="button" className={className} title={title}
    variant={variant === "danger" ? "destructive" : variant === "ghost" ? "outline" : "default"}
    disabled={disabled || loading} aria-busy={loading} onClick={onClick} style={style}>
    {loading && <Spinner />}{children}
  </SharedButton>;
}

export function Card({
  children,
  style,
  className,
  title,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  title?: string;
}) {
  return (
    <section
      className={className}
      title={title}
      style={{
        background: "var(--erp-surface)",
        border: "1px solid var(--erp-border)",
        borderRadius: 8,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "green" | "gold" | "danger" | "red";
}) {
  const tones = {
    muted: { background: "var(--erp-surface-2)", color: "var(--erp-text-muted)" },
    green: { background: "var(--erp-success-bg)", color: "var(--erp-success)" },
    gold: { background: "var(--erp-accent-bg)", color: "var(--erp-accent)" },
    danger: { background: "var(--erp-danger-bg)", color: "var(--erp-danger)" },
    red: { background: "var(--erp-danger-bg)", color: "var(--erp-danger)" },
  };

  return (
    <span
      style={{
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "9px 0",
        borderBottom: "1px solid var(--erp-border-soft)",
      }}
    >
      <span style={{ color: "var(--erp-text-muted)", fontSize: 12 }}>{label}</span>
      <strong
        style={{
          color: accent ? "var(--erp-accent)" : "var(--erp-text)",
          fontSize: 13,
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div style={{ textAlign: "center", padding: 36, color: "var(--erp-text-muted)" }}>
      <div style={{ fontSize: 15, color: "var(--erp-text)", marginBottom: 6 }}>
        {title}
      </div>
      {detail && (
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{detail}</div>
      )}
    </div>
  );
}

export function ensurePosStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("erp-pos-styles")) return;

  const el = document.createElement("style");
  el.id = "erp-pos-styles";
  el.textContent = `
    @keyframes hn-spin {
      to {
        transform: rotate(360deg);
      }
    }

    .erp-pos-input {
      width: 100%;
      box-sizing: border-box;
      background: var(--erp-surface);
      border: 1px solid var(--erp-border);
      border-radius: 8px;
      padding: 10px 12px;
      color: var(--erp-text);
      outline: none;
      font-family: inherit;
    }

    .erp-pos-input:focus {
      border-color: rgba(212,168,83,.7);
      box-shadow: 0 0 0 3px var(--erp-accent-bg);
    }

    .erp-pos-input::placeholder {
      color: var(--erp-text-muted);
    }

    .erp-pos-label {
      display: block;
      color: var(--erp-text-muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 6px;
      margin-top: 10px;
    }

    button {
      font-family: inherit;
    }
  `;

  document.head.appendChild(el);
}
