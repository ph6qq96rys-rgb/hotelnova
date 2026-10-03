import { useEffect, useRef } from "react";

/** Keep keyboard focus inside the active form and return it to its opener. */
export function useDialogFocus(open: boolean, busy: boolean, close: () => void) {
  const latest = useRef({ busy, close });
  latest.current = { busy, close };
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const controls = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')].filter(el => el.offsetParent !== null);
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      const all=document.querySelectorAll<HTMLElement>('[role="dialog"]');
      if(all[all.length-1]!==dialog)return;
      if (event.key === "Escape" && !latest.current.busy) { event.preventDefault(); latest.current.close(); }
      if (event.key !== "Tab") return;
      const elements = controls(), first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); opener?.focus(); };
  }, [open]);
}
