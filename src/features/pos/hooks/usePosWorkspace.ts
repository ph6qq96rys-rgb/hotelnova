import { useCallback, useEffect, useRef, useState } from "react";

import { extractApiError } from "../utils/posUtils";
import type { PosStoreDto } from "../api/posApi";
import {
  posServiceApi,
  type PosActorDto,
  type PosFloorDto,
  type PosServiceSettingsDto,
  type PosScope,
  type PosWaiterDto,
} from "../api/posServiceApi";
import { posTipsApi, type TipSettingsDto } from "../api/posTipsApi";
import type { MenuItemDto } from "../types/posTypes";

const FLOOR_REFRESH_MS = 20_000;

/**
 * Everything the POS needs about the branch: who is signed in (waiter or cashier),
 * the live floor plan, waiters, the sellable menu and POS stores. The floor refreshes
 * on a timer so tables opened on other devices appear without reloading.
 */
export function usePosWorkspace(scope: PosScope, pollFloor: boolean) {
  const [actor, setActor] = useState<PosActorDto | null>(null);
  const [floor, setFloor] = useState<PosFloorDto | null>(null);
  const [waiters, setWaiters] = useState<PosWaiterDto[]>([]);
  const [menu, setMenu] = useState<MenuItemDto[]>([]);
  const [stores, setStores] = useState<PosStoreDto[]>([]);
  const [tipSettings, setTipSettings] = useState<TipSettingsDto | null>(null);
  const [serviceSettings, setServiceSettings] = useState<PosServiceSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [floorLoading, setFloorLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const floorAbort = useRef<AbortController | null>(null);
  const ready = !!scope.companyId && !!scope.branchId;

  const refreshFloor = useCallback(async () => {
    if (!ready) return;
    floorAbort.current?.abort();
    const controller = new AbortController();
    floorAbort.current = controller;
    setFloorLoading(true);
    try {
      const next = await posServiceApi.floor(scope, controller.signal);
      if (!controller.signal.aborted) setFloor(next);
    } catch (err) {
      if (!controller.signal.aborted) setError(extractApiError(err, "The floor plan could not be loaded."));
    } finally {
      if (!controller.signal.aborted) setFloorLoading(false);
    }
  }, [ready, scope]);

  const refreshWaiters = useCallback(async () => {
    if (!ready) return;
    try {
      setWaiters(await posServiceApi.waiters(scope));
    } catch {
      setWaiters([]);
    }
  }, [ready, scope]);

  useEffect(() => {
    let cancelled = false;
    setActor(null); setFloor(null); setWaiters([]); setMenu([]); setStores([]); setTipSettings(null); setServiceSettings(null); setError(null); setMenuError(null);
    if (!ready) { setLoading(false); return; }
    setLoading(true);

    (async () => {
      try {
        const [me, stores] = await Promise.all([posServiceApi.me(scope), posServiceApi.stores(scope)]);
        if (cancelled) return;
        setActor(me);
        setStores(stores);
      } catch (err) {
        if (!cancelled) setError(extractApiError(err, "The POS could not be loaded for this branch."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    posServiceApi.menu(scope)
      .then((items) => { if (!cancelled) setMenu(items); })
      .catch((err) => { if (!cancelled) setMenuError(extractApiError(err, "Failed to load menu items.")); });
    // Without tip settings the POS simply offers no tips.
    posTipsApi.settings(scope)
      .then((settings) => { if (!cancelled) setTipSettings(settings); })
      .catch(() => { if (!cancelled) setTipSettings(null); });
    posServiceApi.serviceSettings(scope)
      .then((settings) => { if (!cancelled) setServiceSettings(settings); })
      .catch(() => { if (!cancelled) setServiceSettings(null); });
    void refreshWaiters();
    void refreshFloor();
    return () => { cancelled = true; floorAbort.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.companyId, scope.branchId]);

  useEffect(() => {
    if (!ready || !pollFloor) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshFloor();
    }, FLOOR_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [pollFloor, ready, refreshFloor]);

  return { actor, floor, waiters, menu, stores, tipSettings, serviceSettings, loading, floorLoading, error, menuError, refreshFloor, refreshWaiters, setError };
}
