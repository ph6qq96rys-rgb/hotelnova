const DEFAULT_CURRENCY = "ETB";
const ACTIVE_CURRENCY_KEY = "restaurantfnb.activeCurrency";

export function normalizeCurrencyCode(value?: string | null): string {
  const code = String(value ?? "").trim().toUpperCase();
  return code || DEFAULT_CURRENCY;
}

export function readActiveCurrencyCode(): string {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;

  return normalizeCurrencyCode(
    window.sessionStorage.getItem(ACTIVE_CURRENCY_KEY) ??
      window.localStorage.getItem(ACTIVE_CURRENCY_KEY),
  );
}

export function writeActiveCurrencyCode(value?: string | null): void {
  if (typeof window === "undefined") return;

  const currency = normalizeCurrencyCode(value);
  window.sessionStorage.setItem(ACTIVE_CURRENCY_KEY, currency);
  window.localStorage.setItem(ACTIVE_CURRENCY_KEY, currency);
}

export function formatCurrency(
  value?: number | string | null,
  currencyCode?: string | null,
  locale?: string,
): string {
  const numeric = Number(value ?? 0);
  const amount = Number.isFinite(numeric) ? numeric : 0;
  const currency = currencyCode
    ? normalizeCurrencyCode(currencyCode)
    : readActiveCurrencyCode();

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
