// src/context/AppContext.tsx

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type AppMode = "platform" | "tenant";

export type AppScopeState = {
  mode: AppMode;

  companyId: string | null;
  companyName: string | null;
  tenantSlug: string | null;

  branchId: string | null;
  branchName: string | null;

  storeId: string | null;
  storeName: string | null;

  stockLocationId: string | null;
  stockLocationName: string | null;
};

export type AppScopeContextValue = AppScopeState & {
  isPlatformMode: boolean;
  isTenantMode: boolean;

  hasCompany: boolean;
  hasBranch: boolean;
  hasOperationalScope: boolean;

  enterPlatformMode: () => void;

  setCompany: (company: {
    id: string;
    name?: string | null;
    tenantSlug?: string | null;
  } | null) => void;

  setBranch: (branch: { id: string; name?: string | null } | null) => void;
  setStore: (store: { id: string; name?: string | null } | null) => void;
  setStockLocation: (location: { id: string; name?: string | null } | null) => void;

  clearBranchScope: () => void;
  clearScope: () => void;
};

const SCOPE_KEY = "rfnb.scope.v3";

const emptyScope: AppScopeState = {
  mode: "tenant",

  companyId: null,
  companyName: null,
  tenantSlug: null,

  branchId: null,
  branchName: null,

  storeId: null,
  storeName: null,

  stockLocationId: null,
  stockLocationName: null,
};

const platformScope: AppScopeState = {
  ...emptyScope,
  mode: "platform",
};

const AppContext = createContext<AppScopeContextValue | null>(null);

function normalizeId(value?: string | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeText(value?: string | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function loadScope(): AppScopeState {
  try {
    const current = localStorage.getItem(SCOPE_KEY);

    if (current) {
      const parsed = JSON.parse(current) as Partial<AppScopeState>;

      return {
        ...emptyScope,
        ...parsed,
        mode: parsed.mode === "platform" ? "platform" : "tenant",
        companyId: normalizeId(parsed.companyId),
        companyName: normalizeText(parsed.companyName),
        tenantSlug: normalizeText(parsed.tenantSlug)?.toLowerCase() ?? null,
        branchId: normalizeId(parsed.branchId),
        branchName: normalizeText(parsed.branchName),
        storeId: normalizeId(parsed.storeId),
        storeName: normalizeText(parsed.storeName),
        stockLocationId: normalizeId(parsed.stockLocationId),
        stockLocationName: normalizeText(parsed.stockLocationName),
      };
    }

    const legacy =
      localStorage.getItem("rfnb.scope.v2") ??
      localStorage.getItem("rfnb.scope.v1");

    if (!legacy) return emptyScope;

    const parsed = JSON.parse(legacy) as Partial<AppScopeState>;

    return {
      ...emptyScope,
      mode: normalizeId(parsed.companyId) ? "tenant" : "platform",
      companyId: normalizeId(parsed.companyId),
      companyName: normalizeText(parsed.companyName),
      tenantSlug: normalizeText(parsed.tenantSlug)?.toLowerCase() ?? null,
      branchId: normalizeId(parsed.branchId),
      branchName: normalizeText(parsed.branchName),
      storeId: normalizeId(parsed.storeId),
      storeName: normalizeText(parsed.storeName),
      stockLocationId: normalizeId(parsed.stockLocationId),
      stockLocationName: normalizeText(parsed.stockLocationName),
    };
  } catch {
    return emptyScope;
  }
}

function saveScope(scope: AppScopeState): void {
  localStorage.setItem(SCOPE_KEY, JSON.stringify(scope));
}

function clearLegacyScope(): void {
  localStorage.removeItem("rfnb.scope.v1");
  localStorage.removeItem("rfnb.scope.v2");
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = useState<AppScopeState>(() => loadScope());

  const updateScope = useCallback((next: AppScopeState) => {
    setScopeState(next);
    saveScope(next);
    clearLegacyScope();
  }, []);

  const enterPlatformMode = useCallback(() => {
    localStorage.removeItem("tenantSlug");
    localStorage.removeItem("tenantId");
    sessionStorage.removeItem("tenantSlug");
    sessionStorage.removeItem("tenantId");

    updateScope(platformScope);
  }, [updateScope]);

  const setCompany = useCallback(
    (company: {
      id: string;
      name?: string | null;
      tenantSlug?: string | null;
    } | null) => {
      const companyId = normalizeId(company?.id);

      if (!companyId) {
        updateScope(emptyScope);
        return;
      }

      const tenantSlug =
        normalizeText(company?.tenantSlug)?.toLowerCase() ??
        null;

      if (tenantSlug) {
        localStorage.setItem("tenantSlug", tenantSlug);
        localStorage.removeItem("tenantId");
      }

      updateScope({
        ...emptyScope,
        mode: "tenant",
        companyId,
        companyName: company?.name ?? null,
        tenantSlug,
      });
    },
    [updateScope]
  );

  const setBranch = useCallback(
    (branch: { id: string; name?: string | null } | null) => {
      const branchId = normalizeId(branch?.id);

      updateScope({
        ...scope,
        branchId,
        branchName: branchId ? branch?.name ?? null : null,
        storeId: null,
        storeName: null,
        stockLocationId: null,
        stockLocationName: null,
      });
    },
    [scope, updateScope]
  );

  const setStore = useCallback(
    (store: { id: string; name?: string | null } | null) => {
      const storeId = normalizeId(store?.id);

      updateScope({
        ...scope,
        storeId,
        storeName: storeId ? store?.name ?? null : null,
      });
    },
    [scope, updateScope]
  );

  const setStockLocation = useCallback(
    (location: { id: string; name?: string | null } | null) => {
      const stockLocationId = normalizeId(location?.id);

      updateScope({
        ...scope,
        stockLocationId,
        stockLocationName: stockLocationId ? location?.name ?? null : null,
      });
    },
    [scope, updateScope]
  );

  const clearBranchScope = useCallback(() => {
    updateScope({
      ...scope,
      branchId: null,
      branchName: null,
      storeId: null,
      storeName: null,
      stockLocationId: null,
      stockLocationName: null,
    });
  }, [scope, updateScope]);

  const clearScope = useCallback(() => {
    localStorage.removeItem("tenantSlug");
    localStorage.removeItem("tenantId");
    sessionStorage.removeItem("tenantSlug");
    sessionStorage.removeItem("tenantId");

    updateScope(emptyScope);
  }, [updateScope]);

  const value = useMemo<AppScopeContextValue>(
    () => {
      const isPlatformMode = scope.mode === "platform";
      const isTenantMode = scope.mode === "tenant";

      return {
        ...scope,

        isPlatformMode,
        isTenantMode,

        hasCompany: isPlatformMode || Boolean(scope.companyId),
        hasBranch: isPlatformMode || Boolean(scope.branchId),
        hasOperationalScope:
          isPlatformMode || Boolean(scope.companyId && scope.branchId),

        enterPlatformMode,
        setCompany,
        setBranch,
        setStore,
        setStockLocation,
        clearBranchScope,
        clearScope,
      };
    },
    [
      scope,
      enterPlatformMode,
      setCompany,
      setBranch,
      setStore,
      setStockLocation,
      clearBranchScope,
      clearScope,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppScopeContextValue {
  const ctx = useContext(AppContext);

  if (!ctx) {
    throw new Error("useAppContext must be used inside <AppProvider>.");
  }

  return ctx;
}