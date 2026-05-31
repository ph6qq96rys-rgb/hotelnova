// src/features/inventory/siv/pages/SivOpenRedirectPage.tsx

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sivApi } from "../api/sivApi";
import { normalizeStatus } from "../types/sivTypes";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test((v ?? "").trim());
}

export default function SivOpenRedirectPage() {
  const nav = useNavigate();
  const params = useParams();

  const companyId = String(params.companyId ?? "");
  const sivId     = String(params.id ?? params.sivId ?? params.draftId ?? "");

  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function redirect() {
      if (!isUuid(companyId) || !isUuid(sivId)) {
        setErr("Invalid SIV ID.");
        setLoading(false);
        return;
      }

      try {
        const data   = await sivApi.getById(companyId, sivId);
        const raw    = data ??  {};
        const status = normalizeStatus(raw.status ?? raw.status ?? "Draft");

        if (cancelled) return;

        let target: string;
        if (status === "Draft" || status === "ChangesRequested") {
          target = `/companies/${companyId}/siv/drafts/${sivId}/edit`;
        } else if (status === "Submitted") {
          target = `/companies/${companyId}/siv/approval/${sivId}`;
        } else {
          target = `/companies/${companyId}/siv/${sivId}`;
        }

        nav(target, { replace: true });
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.response?.data?.message ?? e?.message ?? "Failed to open SIV.");
        setLoading(false);
        nav(`/companies/${companyId}/siv/${sivId}`, { replace: true });
      }
    }

    void redirect();
    return () => { cancelled = true; };
  }, [companyId, sivId, nav]);

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: 48, textAlign: "center",
          color: "var(--text-muted)", fontSize: 13 }}>
          Opening SIV…
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="page">
        <div className="alert alert-danger">{err}</div>
      </div>
    );
  }

  return null;
}
