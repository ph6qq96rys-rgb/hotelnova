import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import SettingsForm from "../components/SettingsForm";
import { companyApi } from "../api/companyApi";
import type { CompanySettingsDto } from "../types";
import { useAppContext } from "../../../app/AppContext"; // adjust path
export default function CompanySettingsPage() {
  const { companyId } = useParams<{ companyId: string }>();
   const params = useParams<{ companyId?: string }>();
 const { companyId: ctxCompanyId } = useAppContext();
  const [value, setValue] = useState<CompanySettingsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
const effectiveCompanyId = useMemo(
    () => params.companyId ?? ctxCompanyId ?? null,
    [params.companyId, ctxCompanyId]
  );
  
  useEffect(() => {
    if (!effectiveCompanyId) return;
    setIsLoading(true);
    setError(null);
    companyApi
      .getSettings(effectiveCompanyId)
      .then(setValue)
      .catch((e) => setError(e?.response?.data?.message ?? e?.message ?? "Failed to load settings"))
      .finally(() => setIsLoading(false));
  }, [effectiveCompanyId]);

  async function save() {
    if (!companyId || !value) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await companyApi.updateSettings(companyId, value);
      setValue(saved);
      setNotice("Settings saved.");
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  if (!companyId) return <div className="page">Missing companyId</div>;
  if (isLoading) return <div className="page">Loading settings…</div>;
  if (error) return <div className="page">{error}</div>;
  if (!value) return <div className="page">No settings found</div>;

  return (
    <div className="page max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Company Settings</h1>
          <div className="text-sm text-slate-500">Applies to all branches and stores under this company.</div>
        </div>
        <button className="hna-btn hna-btn-primary" onClick={save} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>

      {notice && <div className="hna-alert">{notice}</div>}
      {error && <div className="hna-alert hna-alert-error">{error}</div>}

      <SettingsForm value={value} onChange={setValue} />
    </div>
  );
}
