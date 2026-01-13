import React from "react";

export function Card(props: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={styles.card}>
      {(props.title || props.right) && (
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>{props.title}</div>
          <div>{props.right}</div>
        </div>
      )}
      <div style={styles.cardBody}>{props.children}</div>
    </div>
  );
}

export function Badge(props: { text: string; tone?: "gray" | "green" | "red" | "blue" }) {
  const bg =
    props.tone === "green" ? "#eaf7ee" : props.tone === "red" ? "#fdecec" : props.tone === "blue" ? "#eaf2ff" : "#f2f4f7";
  const fg =
    props.tone === "green" ? "#1f7a3f" : props.tone === "red" ? "#b42318" : props.tone === "blue" ? "#1d4ed8" : "#344054";
  return (
    <span style={{ ...styles.badge, background: bg, color: fg, borderColor: fg + "22" }}>
      {props.text}
    </span>
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = props.variant ?? "primary";
  const s =
    v === "primary"
      ? styles.btnPrimary
      : v === "danger"
      ? styles.btnDanger
      : styles.btnGhost;
  return <button {...props} style={{ ...styles.btnBase, ...s, ...(props.style ?? {}) }} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...styles.input, ...(props.style ?? {}) }} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...styles.textarea, ...(props.style ?? {}) }} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...styles.select, ...(props.style ?? {}) }} />;
}

export function Table(props: { columns: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>{props.columns}</thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  );
}

export function Field(props: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={styles.labelRow}>
        <div style={styles.label}>{props.label}</div>
        {props.hint && <div style={styles.hint}>{props.hint}</div>}
      </div>
      {props.children}
      {props.error && <div style={styles.error}>{props.error}</div>}
    </div>
  );
}

export function Split(props: { children: React.ReactNode }) {
  return <div style={styles.split}>{props.children}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
    marginBottom: 14,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderBottom: "1px solid #eaecf0",
  },
  cardTitle: { fontWeight: 700, fontSize: 14, color: "#101828" },
  cardBody: { padding: 14 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid #eaecf0",
    fontWeight: 600,
  },
  btnBase: {
    borderRadius: 10,
    padding: "9px 12px",
    fontWeight: 700,
    fontSize: 13,
    border: "1px solid transparent",
    cursor: "pointer",
  },
  btnPrimary: { background: "#2563eb", color: "#fff" },
  btnDanger: { background: "#b42318", color: "#fff" },
  btnGhost: { background: "#fff", color: "#101828", borderColor: "#d0d5dd" },
  input: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #d0d5dd",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  },
  textarea: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #d0d5dd",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    minHeight: 90,
    resize: "vertical",
  },
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #d0d5dd",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  tableWrap: { overflowX: "auto", border: "1px solid #eaecf0", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse" },
  labelRow: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 12, color: "#344054", fontWeight: 700 },
  hint: { fontSize: 12, color: "#667085" },
  error: { fontSize: 12, color: "#b42318", marginTop: 6, fontWeight: 600 },
  split: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
};
