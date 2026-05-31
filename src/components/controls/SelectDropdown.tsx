import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

type PanelPos = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
};

function calcPosition(el: HTMLElement): PanelPos {
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward = spaceBelow < 320 && spaceAbove > spaceBelow;
  // At least as wide as the trigger, grows up to 480px, never overflows viewport.
  const width = Math.min(
    Math.max(rect.width, 480),
    window.innerWidth - rect.left - 12
  );
  return {
    left: rect.left,
    width,
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 }),
  };
}

function optionStyle(active: boolean, isDisabled?: boolean): React.CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    padding: "10px 14px",
    background: active ? "#f0f4ff" : "#fff",
    border: "none",
    borderBottom: "1px solid #f5f5f5",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.4 : 1,
    fontSize: 14,
    color: active ? "#2563eb" : "inherit",
    fontWeight: active ? 600 : 400,
    whiteSpace: "normal",
    wordBreak: "break-word",
    lineHeight: 1.4,
  };
}

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
  const [pos, setPos] = useState<PanelPos | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Open/close ────────────────────────────────────────────────────────────

  const closePanel = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);

  const openPanel = useCallback(() => {
    if (disabled || !triggerRef.current) return;
    // Synchronous position calculation — panel renders with correct coords
    // on its very first paint, no useEffect delay.
    setPos(calcPosition(triggerRef.current));
    setOpen(true);
  }, [disabled]);

  const toggle = useCallback(() => {
    if (open) closePanel();
    else openPanel();
  }, [open, openPanel, closePanel]);

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !panelRef.current?.contains(t)
      ) {
        closePanel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closePanel]);

  // ── Close on scroll (panel position would drift) ──────────────────────────
  // Only close when the scroll happens outside the panel itself — scrolling
  // through the options list should not dismiss the dropdown.

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      closePanel();
    };
    window.addEventListener("scroll", handler, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handler, { capture: true });
  }, [open, closePanel]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [q, options]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={triggerRef} style={{ position: "relative" }}>
      {label && (
        <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>{label}</div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: disabled ? "#f6f6f6" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            opacity: selected ? 1 : 0.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 14,
          }}
        >
          {loading ? "Loading…" : selected?.label ?? placeholder}
        </span>
        <span style={{ opacity: 0.4, flexShrink: 0 }}>▾</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            zIndex: 9999,
            left: pos.left,
            width: pos.width,
            top: pos.top,
            bottom: pos.bottom,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#fff",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ padding: 10, borderBottom: "1px solid #eee" }}>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e5e5",
                boxSizing: "border-box",
                outline: "none",
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {clearable && (
              <button
                type="button"
                onClick={() => { onChange(null); closePanel(); }}
                style={optionStyle(false)}
              >
                <span style={{ opacity: 0.4 }}>Clear selection</span>
              </button>
            )}

            {filtered.length === 0 ? (
              <div style={{ padding: "12px 14px", opacity: 0.5, fontSize: 13 }}>
                {loading ? "Loading…" : "No results"}
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => { onChange(o.value); closePanel(); }}
                  style={optionStyle(o.value === value, o.disabled)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}