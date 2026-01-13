import { useEffect, useMemo, useState } from "react";
import { locationsApi, type LocationLiteDto } from "../api/locationsApi";
import { useAppContext } from "../../../../app/AppContext";

type Props = {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeId?: string | null; // prevent selecting same as the other dropdown
};

export default function LocationSelect({
  label,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  excludeId,
}: Props) {
  const { companyId,branchId } = useAppContext();

  const [items, setItems] = useState<LocationLiteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!companyId) return;
      setLoading(true);
      setErr(null);
      try {
        const data = await locationsApi.list(companyId,branchId);
        if (!alive) return;
        setItems(data ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load locations");
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [companyId]);

  const options = useMemo(() => {
    const filtered = excludeId ? items.filter((x) => x.id !== excludeId) : items;
    return filtered;
  }, [items, excludeId]);

  return (
    <div>
      <label className="label">{label}</label>

      <div className="relative">
        <select
          className="input pr-10"
          value={value ?? ""}
          disabled={disabled || loading || !companyId}
          onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        >
          <option value="">
            {loading ? "Loading…" : placeholder}
          </option>

          {options.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
              {x.code ? ` (${x.code})` : ""}
              {x.branchName ? ` — ${x.branchName}` : ""}
            </option>
          ))}
        </select>

        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          ▾
        </div>
      </div>

      {err && <div className="mt-1 text-xs text-rose-600">{err}</div>}
      {!err && (
        <div className="hint">
          {loading ? "Fetching available locations…" : "Only active locations are shown."}
        </div>
      )}
    </div>
  );
}
