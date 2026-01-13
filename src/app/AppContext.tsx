import React, { createContext, useContext, useMemo, useState } from "react";

export type AppScope = {
  companyId: string | null;
  branchId: string | null;
  storeId: string | null;
  stockLocationId: string | null;

  setCompanyId: (id: string | null) => void;
  setBranchId: (id: string | null) => void;
  setStoreId: (id: string | null) => void;
  setStockLocationId: (id: string | null) => void;

  clearScope: () => void;
};

const AppContext = createContext<AppScope | null>(null);

const SCOPE_KEY = "rfnb.scope.v1";

type PersistedScope = {
  companyId?: string | null;
  branchId?: string | null;
  storeId?: string | null;
  stockLocationId?: string | null;
};

function loadScope(): PersistedScope {
  try {
    return JSON.parse(localStorage.getItem(SCOPE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveScope(next: PersistedScope) {
  localStorage.setItem(SCOPE_KEY, JSON.stringify(next));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initial = loadScope();

  const [companyId, _setCompanyId] = useState<string | null>(initial.companyId ?? null);
  const [branchId, _setBranchId] = useState<string | null>(initial.branchId ?? null);
  const [storeId, _setStoreId] = useState<string | null>(initial.storeId ?? null);
  const [stockLocationId, _setStockLocationId] = useState<string | null>(initial.stockLocationId ?? null);

  const setCompanyId = (id: string | null) => {
    _setCompanyId(id);

    // company change invalidates all downstream
    _setBranchId(null);
    _setStoreId(null);
    _setStockLocationId(null);

    saveScope({ companyId: id, branchId: null, storeId: null, stockLocationId: null });
  };

  const setBranchId = (id: string | null) => {
    _setBranchId(id);

    // branch change invalidates store/location
    _setStoreId(null);
    _setStockLocationId(null);

    saveScope({ companyId, branchId: id, storeId: null, stockLocationId: null });
  };

  const setStoreId = (id: string | null) => {
    _setStoreId(id);
    // store change may invalidate mapping
    saveScope({ companyId, branchId, storeId: id, stockLocationId });
  };

  const setStockLocationId = (id: string | null) => {
    _setStockLocationId(id);
    saveScope({ companyId, branchId, storeId, stockLocationId: id });
  };

  const clearScope = () => {
    _setCompanyId(null);
    _setBranchId(null);
    _setStoreId(null);
    _setStockLocationId(null);
    saveScope({ companyId: null, branchId: null, storeId: null, stockLocationId: null });
  };

  const api = useMemo<AppScope>(
    () => ({
      companyId,
      branchId,
      storeId,
      stockLocationId,
      setCompanyId,
      setBranchId,
      setStoreId,
      setStockLocationId,
      clearScope,
    }),
    [companyId, branchId, storeId, stockLocationId]
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside <AppProvider>");
  return ctx;
}
