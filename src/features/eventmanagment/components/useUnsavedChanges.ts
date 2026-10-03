import { useContext, useEffect, useRef } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";

/** BrowserRouter guard covering app navigation, Back/Forward, reload and tab close. */
export function useUnsavedChanges(dirty: boolean) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const current = useRef(dirty);
  current.current = dirty;
  const confirmDiscard = () => !current.current || window.confirm("Discard your unsaved changes?");
  useEffect(() => {
    if (!dirty) return;
    let index = window.history.state?.idx as number | undefined;
    let restoring = false;
    const push = navigator.push.bind(navigator);
    const replace = navigator.replace.bind(navigator);
    const guardedPush: typeof navigator.push = (...args) => {
      if (confirmDiscard()) { current.current = false; push(...args); index = window.history.state?.idx; }
    };
    const guardedReplace: typeof navigator.replace = (...args) => {
      if (confirmDiscard()) { current.current = false; replace(...args); index = window.history.state?.idx; }
    };
    navigator.push = guardedPush;
    navigator.replace = guardedReplace;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (current.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const pop = (event: PopStateEvent) => {
      const nextIndex = event.state?.idx as number | undefined;
      if (restoring) { restoring = false; index = nextIndex; return; }
      if (!confirmDiscard()) {
        if (index !== undefined && nextIndex !== undefined && index !== nextIndex) {
          event.stopImmediatePropagation();
          restoring = true;
          window.history.go(index - nextIndex);
        }
      } else { current.current = false; index = nextIndex; }
    };
    const externalLink = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || event.ctrlKey || event.metaKey || link.hasAttribute("download")) return;
      if (link.origin !== location.origin && !confirmDiscard()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const beforeBranchChange=(event:Event)=>{if((event as CustomEvent).detail?.discardConfirmed){current.current=false;return;}if(!confirmDiscard())event.preventDefault();};
    window.addEventListener("scope:before-branch-change",beforeBranchChange);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", pop, true);
    document.addEventListener("click", externalLink, true);
    return () => {
      if (navigator.push === guardedPush) navigator.push = push;
      if (navigator.replace === guardedReplace) navigator.replace = replace;
      window.removeEventListener("scope:before-branch-change",beforeBranchChange);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", pop, true);
      document.removeEventListener("click", externalLink, true);
    };
  }, [dirty, navigator]);
  return { confirmDiscard, markSaved: () => { current.current = false; } };
}
