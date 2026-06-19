// src/routes/useCompanyNavigation.ts

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../app/useAppScope";
import { companyPath, toCompanyPath } from "./navigation";

export function useCompanyNavigation() {
  const navigate = useNavigate();
  const { companyId } = useAppScope();

  const go = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (!companyId) {
        navigate("/login", { replace: true });
        return;
      }

      navigate(toCompanyPath(companyId, path), options);
    },
    [companyId, navigate]
  );

  const href = useCallback(
    (path: string) => {
      if (!companyId) return "/login";
      return companyPath(companyId, path);
    },
    [companyId]
  );

  return {
    companyId,
    go,
    href,
  };
}