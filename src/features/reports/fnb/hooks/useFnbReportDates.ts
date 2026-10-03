import { useEffect, useState } from "react";

type Dates = { scope: string; initialized: boolean; from: string; to: string; asOfDate: string };
const EMPTY: Dates = { scope: "", initialized: false, from: "", to: "", asOfDate: "" };

export function useFnbReportDates(
  companyId: string | null | undefined,
  branchId: string | null | undefined,
  defaultDate: string | null,
) {
  const scope = companyId && branchId ? `${companyId}/${branchId}` : "";
  const [dates, setDates] = useState<Dates>(EMPTY);

  useEffect(() => {
    if (!scope || !defaultDate || !/^\d{4}-\d{2}-\d{2}$/.test(defaultDate)) return;
    setDates((current) => {
      if (current.scope === scope && current.initialized) return current;
      const pending = current.scope === scope ? current : EMPTY;
      return {
        scope, initialized: true,
        from: pending.from || defaultDate,
        to: pending.to || defaultDate,
        asOfDate: pending.asOfDate || defaultDate,
      };
    });
  }, [scope, defaultDate]);

  const update = (field: "from" | "to" | "asOfDate", value: string) => {
    setDates((current) => ({
      ...(current.scope === scope ? current : EMPTY), scope, [field]: value,
    }));
  };
  const current = dates.scope === scope ? dates : EMPTY;
  return {
    from: current.from, to: current.to, asOfDate: current.asOfDate,
    setFrom: (value: string) => update("from", value),
    setTo: (value: string) => update("to", value),
    setAsOfDate: (value: string) => update("asOfDate", value),
  };
}
