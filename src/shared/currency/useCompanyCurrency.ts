import { useEffect, useMemo, useState } from "react";

import { useAppScope } from "../../app/useAppScope";
import { useAuth } from "../../auth/AuthProvider";
import { companyApi } from "../../features/company/api/companyApi";
import {
  normalizeCurrencyCode,
  readActiveCurrencyCode,
  writeActiveCurrencyCode,
} from "./currencyFormat";

const currencyCache = new Map<string, string>();

export function useCompanyCurrency(): string {
  const { companyId } = useAppScope();
  const { isAuthenticated, hasPermission } = useAuth();
  const canReadSettings = isAuthenticated && hasPermission("settings.view");
  const [currency, setCurrency] = useState(() => {
    return companyId ? currencyCache.get(companyId) ?? readActiveCurrencyCode() : "ETB";
  });

  useEffect(() => {
    let cancelled = false;

    if (!companyId) {
      setCurrency("ETB");
      writeActiveCurrencyCode("ETB");
      return;
    }

    const cached = currencyCache.get(companyId);
    if (cached) {
      setCurrency(cached);
      writeActiveCurrencyCode(cached);
      return;
    }

    if (!canReadSettings) {
      setCurrency("ETB");
      writeActiveCurrencyCode("ETB");
      return;
    }

    companyApi
      .getSettings(companyId)
      .then((settings) => {
        if (cancelled) return;
        const next = normalizeCurrencyCode(
          settings.baseCurrency || (settings as any).defaultCurrency,
        );

        currencyCache.set(companyId, next);
        writeActiveCurrencyCode(next);
        if (!cancelled) setCurrency(next);
      })
      .catch(() => {
        if (cancelled) return;
        writeActiveCurrencyCode("ETB");
        if (!cancelled) setCurrency("ETB");
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, canReadSettings]);

  return useMemo(() => normalizeCurrencyCode(currency), [currency]);
}
