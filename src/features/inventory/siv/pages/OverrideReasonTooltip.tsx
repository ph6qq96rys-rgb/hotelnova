import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function OverrideReasonTooltip({ label, reason }: { label: string; reason: string }) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const tip = tooltip.current?.getBoundingClientRect();
      if (!rect || !tip) return;
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - tip.width - 8)),
        top: Math.max(8, rect.bottom + tip.height + 8 <= window.innerHeight
          ? rect.bottom + 6 : rect.top - tip.height - 6),
      });
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("keydown", dismiss);
    };
  }, [open, reason]);

  return <>
    <button ref={anchor} type="button" className="siv-override-badge"
      aria-describedby={open ? id : undefined}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      onClick={(event) => { event.stopPropagation(); show(); }}>
      {label}
    </button>
    {open && createPortal(
      <div ref={tooltip} id={id} role="tooltip" className="siv-override-tooltip"
        style={position} onMouseEnter={show} onMouseLeave={hide}
        onClick={(event) => event.stopPropagation()}>
        {reason}
      </div>, document.body)}
  </>;
}
