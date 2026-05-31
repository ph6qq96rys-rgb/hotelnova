// src/modules/security/hooks/useAbortable.ts
// Shared abort-controller primitive used by all data-fetching hooks.

import { useCallback, useEffect, useRef } from "react";

export function useAbortable() {
  const ctrl = useRef<AbortController | null>(null);

  const begin = useCallback((): AbortSignal => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    return ctrl.current.signal;
  }, []);

  const abort = useCallback(() => { ctrl.current?.abort(); }, []);

  // Cancel on unmount
  useEffect(() => () => { ctrl.current?.abort(); }, []);

  return { begin, abort };
}