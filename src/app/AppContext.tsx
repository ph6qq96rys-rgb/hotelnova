// src/app/AppContext.tsx

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { loadAuth } from "../auth/auth.storage";
import {
  loadWorkspaceAuth,
  saveWorkspaceAuth,
  clearWorkspaceAuth,
  type WorkspaceAuth,
} from "../auth/workspace-auth.storage";

export type AppScopeMode = "platform" | "tenant";

export type AppScopeState = {
  mode: AppScopeMode;

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

export type SetCompanyInput = {
  id: string;
  name: string;
  tenantSlug?: string | null;
};

export type SetBranchInput = {
  id: string | null;
  name?: string | null;
};

export type SetStoreInput = {
  id: string | null;
  name?: string | null;
};

export type SetStockLocationInput = {
  id: string | null;
  name?: string | null;
};

export type AppContextValue = AppScopeState & {
  setCompany: (company: SetCompanyInput) => void;
  setWorkspace: (workspace: WorkspaceAuth) => void;
  clearCompany: () => void;

  setBranch: (branch: SetBranchInput) => void;
  setStore: (store: SetStoreInput) => void;
  setStockLocation: (location: SetStockLocationInput) => void;

  refreshScope: () => void;
};

const APP_SCOPE_KEY = "rfnb.scope.v3";

const EMPTY_SCOPE: AppScopeState = {
  mode: "platform",

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

const AppContext = createContext<AppContextValue | null>(null);

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function normalizeTenantSlug(value: unknown): string | null {
  return clean(value)?.toLowerCase() ?? null;
}

function normalizeScope(
  value: Partial<AppScopeState> | null | undefined,
): AppScopeState {
  const companyId = clean(value?.companyId);

  return {
    mode: companyId ? "tenant" : "platform",

    companyId,
    companyName: clean(value?.companyName),
    tenantSlug: normalizeTenantSlug(value?.tenantSlug),

    branchId: clean(value?.branchId),
    branchName: clean(value?.branchName),

    storeId: clean(value?.storeId),
    storeName: clean(value?.storeName),

    stockLocationId: clean(value?.stockLocationId),
    stockLocationName: clean(value?.stockLocationName),
  };
}

function readPersistedScope(): AppScopeState | null {
  const raw =
    sessionStorage.getItem(APP_SCOPE_KEY) ??
    localStorage.getItem(APP_SCOPE_KEY);

  if (!raw) return null;

  try {
    return normalizeScope(
      JSON.parse(raw) as Partial<AppScopeState>,
    );
  } catch {
    sessionStorage.removeItem(APP_SCOPE_KEY);
    localStorage.removeItem(APP_SCOPE_KEY);
    return null;
  }
}

function loadInitialScope(): AppScopeState {
  /*
   * A delegated SystemAdmin workspace must take precedence over
   * direct tenant authentication.
   */
  const workspace = loadWorkspaceAuth();

  if (workspace?.accessToken && clean(workspace.companyId)) {
    return normalizeScope({
      mode: "tenant",
      companyId: workspace.companyId,
      companyName: workspace.companyName,
      tenantSlug: workspace.tenantSlug,
      branchId: workspace.branchId,
      branchName: workspace.branchName,
      storeId: null,
      storeName: null,
      stockLocationId: null,
      stockLocationName: null,
    });
  }

  const persistedScope = readPersistedScope();

  if (persistedScope?.companyId) {
    return persistedScope;
  }

  const auth = loadAuth();

  if (auth?.accessToken) {
    return normalizeScope({
      mode: auth.companyId ? "tenant" : "platform",
      companyId: auth.companyId,
      companyName: auth.companyName,
      tenantSlug: auth.tenantSlug,
      branchId: auth.branchId,
      branchName: auth.branchName,
      storeId: auth.storeId,
      storeName: null,
      stockLocationId: auth.stockLocationId,
      stockLocationName: null,
    });
  }

  return EMPTY_SCOPE;
}

function persistScope(scope: AppScopeState): void {
  const serialized = JSON.stringify(scope);

  /*
   * Keep scope tab-scoped when a delegated workspace exists.
   * Otherwise use local storage for direct tenant login.
   */
  if (loadWorkspaceAuth()?.accessToken) {
    sessionStorage.setItem(APP_SCOPE_KEY, serialized);
    localStorage.removeItem(APP_SCOPE_KEY);
  } else {
    localStorage.setItem(APP_SCOPE_KEY, serialized);
    sessionStorage.removeItem(APP_SCOPE_KEY);
  }

  if (scope.companyId) {
    localStorage.setItem("companyId", scope.companyId);
    sessionStorage.setItem("companyId", scope.companyId);
  } else {
    localStorage.removeItem("companyId");
    sessionStorage.removeItem("companyId");
  }

  if (scope.tenantSlug) {
    localStorage.setItem("tenantSlug", scope.tenantSlug);
    sessionStorage.setItem("tenantSlug", scope.tenantSlug);
  } else {
    localStorage.removeItem("tenantSlug");
    sessionStorage.removeItem("tenantSlug");
  }

  if (scope.branchId) {
    localStorage.setItem("branchId", scope.branchId);
    sessionStorage.setItem("branchId", scope.branchId);
  } else {
    localStorage.removeItem("branchId");
    sessionStorage.removeItem("branchId");
  }
}

function clearPersistedScope(): void {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(APP_SCOPE_KEY);
    storage.removeItem("companyId");
    storage.removeItem("tenantSlug");
    storage.removeItem("branchId");
  }
}

export function AppProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [scope, setScope] =
    useState<AppScopeState>(loadInitialScope);

  const commitScope = useCallback(
    (
      updater:
        | AppScopeState
        | ((current: AppScopeState) => AppScopeState),
    ) => {
      setScope((current) => {
        const next =
          typeof updater === "function"
            ? updater(current)
            : updater;

        const normalized = normalizeScope(next);
        persistScope(normalized);
        return normalized;
      });
    },
    [],
  );

  const setCompany = useCallback(
    (company: SetCompanyInput) => {
      const companyId = clean(company.id);

      if (!companyId) {
        throw new Error("company.id is required.");
      }

      commitScope((current) => ({
        ...current,
        mode: "tenant",
        companyId,
        companyName:
          clean(company.name) ?? "Tenant workspace",
        tenantSlug: normalizeTenantSlug(
          company.tenantSlug,
        ),

        /*
         * Never carry branch/location scope into another company.
         */
        branchId: null,
        branchName: null,
        storeId: null,
        storeName: null,
        stockLocationId: null,
        stockLocationName: null,
      }));
    },
    [commitScope],
  );

  const setWorkspace = useCallback(
    (workspace: WorkspaceAuth) => {
      const companyId = clean(workspace.companyId);
      const accessToken = clean(workspace.accessToken);

      if (!companyId) {
        throw new Error(
          "workspace.companyId is required.",
        );
      }

      if (!accessToken) {
        throw new Error(
          "workspace.accessToken is required.",
        );
      }

      /*
       * Persist auth and reactive scope in one operation.
       */
      saveWorkspaceAuth({
        ...workspace,
        companyId,
        accessToken,
        companyName:
          clean(workspace.companyName) ??
          "Tenant workspace",
        tenantSlug:
          normalizeTenantSlug(workspace.tenantSlug) ??
          "",
        branchId: clean(workspace.branchId),
        branchName: clean(workspace.branchName),
        roles: Array.isArray(workspace.roles)
          ? workspace.roles
          : [],
        permissions: Array.isArray(
          workspace.permissions,
        )
          ? workspace.permissions
          : [],
      });

      commitScope({
        mode: "tenant",
        companyId,
        companyName:
          clean(workspace.companyName) ??
          "Tenant workspace",
        tenantSlug: normalizeTenantSlug(
          workspace.tenantSlug,
        ),

        branchId: clean(workspace.branchId),
        branchName: clean(workspace.branchName),

        storeId: null,
        storeName: null,
        stockLocationId: null,
        stockLocationName: null,
      });
    },
    [commitScope],
  );

  const clearCompany = useCallback(() => {
    clearWorkspaceAuth();
    clearPersistedScope();
    setScope(EMPTY_SCOPE);
  }, []);

  const setBranch = useCallback(
    (branch: SetBranchInput) => {
      commitScope((current) => ({
        ...current,
        branchId: clean(branch.id),
        branchName: clean(branch.name),

        /*
         * Child location choices may no longer be valid.
         */
        storeId: null,
        storeName: null,
        stockLocationId: null,
        stockLocationName: null,
      }));
    },
    [commitScope],
  );

  const setStore = useCallback(
    (store: SetStoreInput) => {
      commitScope((current) => ({
        ...current,
        storeId: clean(store.id),
        storeName: clean(store.name),
      }));
    },
    [commitScope],
  );

  const setStockLocation = useCallback(
    (location: SetStockLocationInput) => {
      commitScope((current) => ({
        ...current,
        stockLocationId: clean(location.id),
        stockLocationName: clean(location.name),
      }));
    },
    [commitScope],
  );

  const refreshScope = useCallback(() => {
    setScope(loadInitialScope());
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...scope,
      setCompany,
      setWorkspace,
      clearCompany,
      setBranch,
      setStore,
      setStockLocation,
      refreshScope,
    }),
    [
      scope,
      setCompany,
      setWorkspace,
      clearCompany,
      setBranch,
      setStore,
      setStockLocation,
      refreshScope,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error(
      "useAppContext must be used inside <AppProvider>.",
    );
  }

  return context;
}
