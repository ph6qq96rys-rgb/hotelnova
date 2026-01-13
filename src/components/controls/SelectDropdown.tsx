import { useEffect, useMemo, useRef, useState } from "react";

export type SelectOption<T = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type Props<T> = {
  label?: string;
  value?: T | null;
  options: SelectOption<T>[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  onChange: (value: T | null) => void;
};

export function SelectDropdown<T extends string | number>({
  label,
  value,
  options,
  placeholder = "Select…",
  loading,
  disabled,
  clearable = true,
  onChange,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [q, options]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {label && <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>{label}</div>}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: disabled ? "#f6f6f6" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span style={{ opacity: selected ? 1 : 0.6 }}>
          {loading ? "Loading…" : selected?.label ?? placeholder}
        </span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            left: 0,
            right: 0,
            marginTop: 6,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#fff",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ padding: 10, borderBottom: "1px solid #eee" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e5e5",
              }}
            />
          </div>

          <div style={{ maxHeight: 260, overflow: "auto" }}>
            {clearable && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQ("");
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  background: "#fff",
                  border: "none",
                  borderBottom: "1px solid #f1f1f1",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}

            {filtered.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.7 }}>No results</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ("");
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    background: o.value === value ? "#f6f6ff" : "#fff",
                    border: "none",
                    borderBottom: "1px solid #f7f7f7",
                    cursor: o.disabled ? "not-allowed" : "pointer",
                    opacity: o.disabled ? 0.5 : 1,
                  }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
