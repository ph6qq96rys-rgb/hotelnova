import type { CSSProperties } from "react";

/* =========================================================
   Card & Layout
   ========================================================= */

export const cardStyle: CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#ffffff",
  color: "#0f172a",
};

export const stickyBar: CSSProperties = {
  position: "sticky",
  bottom: 0,
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,

  // GRN floating feel
  zIndex: 20,
  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
};

/* =========================================================
   Form
   ========================================================= */

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.75,
  marginBottom: 6,
};

export const inputStyle = (invalid = false): CSSProperties => ({
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: invalid
    ? "1px solid rgba(220, 38, 38, 0.9)"
    : "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  color: "#0f172a",
  background: "#ffffff",

  // GRN control feel
  fontSize: 14,
  lineHeight: "20px",
  boxSizing: "border-box",

  // normalize native select to look like GRN inputs
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
});

export const errorStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "rgb(220, 38, 38)",
};

export const disabledStyle: CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};

/* =========================================================
   Table
   ========================================================= */

export const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#ffffff",
  color: "#0f172a",
};

export const thStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  padding: "10px 10px",
  whiteSpace: "nowrap",
  background: "rgba(15,23,42,0.04)",
  borderBottom: "1px solid rgba(0,0,0,0.10)",
};

export const tdStyle: CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  verticalAlign: "top",
  background: "#ffffff",
  color: "#0f172a",
};

export const totRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
};

/* =========================================================
   Buttons
   ========================================================= */

const baseBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
};

export const primaryBtn: CSSProperties = {
  ...baseBtn,
};

export const secondaryBtn: CSSProperties = {
  ...baseBtn,
};

export const dangerBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(220, 38, 38, 0.35)",
  background: "rgba(220, 38, 38, 0.08)",
  color: "rgb(220, 38, 38)",
  fontWeight: 800,
  cursor: "pointer",
};

/* =========================================================
   KPI / Metric tiles (GRN surface language)
   ========================================================= */

export const softTile: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "#ffffff",
  border: "1px solid rgba(0,0,0,0.10)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

export const mutedMeta: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.7,
};

export const metricValue: CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 800,
};
