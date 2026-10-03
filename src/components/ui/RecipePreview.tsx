import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";
import "./recipe-preview.css";

export type RecipePreviewDetails = {
  description?: string | null;
  ingredients?: readonly string[] | null;
  allergenInformation?: string | null;
};
type Props = {
  name: string;
  details?: RecipePreviewDetails | null;
  loadDetails?: (signal: AbortSignal) => Promise<RecipePreviewDetails | null>;
  language?: "en" | "am";
  children?: (trigger: ReactNode) => ReactNode;
};
const eventName = "menu-recipe-preview-open";
export function RecipePreview({ name, details, loadDetails, language = "en", children }: Props) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const [requested, setRequested] = useState(false);
  const [loaded, setLoaded] = useState<RecipePreviewDetails | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const data = loadDetails ? loaded : details;
  const ingredients = data?.ingredients?.filter(value => value.trim()) ?? [];
  const hasContent = Boolean(data?.description?.trim() || ingredients.length || data?.allergenInformation?.trim());
  const visible = requested && hasContent;
  const labels = language === "am"
    ? { ingredients: "ግብዓቶች", allergens: "የአለርጂ መረጃ" }
    : { ingredients: "Ingredients", allergens: "Allergen information" };
  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function close() { clearTimer(); setRequested(false); }
  function open() {
    clearTimer();
    if (!loadDetails && !hasContent) return;
    window.dispatchEvent(new CustomEvent(eventName, { detail: id }));
    setRequested(true);
    if (loadDetails && !request.current) {
      const controller = new AbortController();
      request.current = controller;
      // A failed or empty response never falls back to an internal recipe.
      loadDetails(controller.signal).then(value => {
        if (!controller.signal.aborted) setLoaded(value);
      }).catch(() => {
        if (!controller.signal.aborted) setLoaded(null);
      }).finally(() => { if (request.current === controller) request.current = null; });
    }
  }
  function leave() { clearTimer(); timer.current = setTimeout(() => setRequested(false), 180); }
  function inside(target: EventTarget | null) {
    return target instanceof Node && (anchor.current?.contains(target) || panel.current?.contains(target));
  }
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!inside(e.target)) close(); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const other = (e: Event) => { if ((e as CustomEvent).detail !== id) close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener(eventName, other);
    return () => {
      clearTimer(); request.current?.abort();
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener(eventName, other);
    };
  }, [id]);
  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      if (!anchor.current || !panel.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const box = panel.current.getBoundingClientRect();
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - box.width - 12));
      const below = rect.bottom + 6;
      const top = below + box.height <= window.innerHeight - 12
        ? below : Math.max(12, rect.top - box.height - 6);
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [visible, data, language]);
  const trigger = hasContent || loadDetails
    ? <Button type="button" variant="ghost" className="recipe-preview-trigger"
        aria-describedby={visible ? id : undefined} aria-expanded={visible}
        onFocus={open}>{name}</Button>
    : <span>{name}</span>;
  return <div ref={anchor} className="recipe-preview-anchor" onClick={open}
    onPointerEnter={e => { if (e.pointerType !== "touch") open(); }}
    onPointerLeave={e => { if (e.pointerType !== "touch") leave(); }}
    onBlur={e => { if (!inside(e.relatedTarget)) close(); }}>
    {children ? children(trigger) : trigger}
    {visible && createPortal(<div id={id} ref={panel} role="tooltip" tabIndex={0}
      className="recipe-preview-panel" lang={language} style={position}
      onPointerEnter={clearTimer}
      onPointerLeave={e => { if (e.pointerType !== "touch") leave(); }}
      onFocus={clearTimer} onBlur={e => { if (!inside(e.relatedTarget)) close(); }}>
      <p className="recipe-preview-name">{name}</p>
      {data?.description?.trim() && <p>{data.description}</p>}
      {ingredients.length > 0 && <div><h4>{labels.ingredients}</h4><p>{ingredients.join(", ")}</p></div>}
      {data?.allergenInformation?.trim() && <div><h4>{labels.allergens}</h4><p>{data.allergenInformation}</p></div>}
    </div>, document.body)}
  </div>;
}
