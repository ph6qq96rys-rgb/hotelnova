import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sivApi } from "../api/sivApi";
import {
  buildSivDetailsRoute,
  buildSivWorkflowRoute,
} from "../../../../routes/sivWorkflowRoutes";

function safeString(value: unknown): string {
  return value == null ? "" : String(value);
}

function isUuid(value: string): boolean {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function getStatusFromResponse(input: any): string | number | null {
  const raw = input?.data ?? input ?? {};

  return (
    raw?.docStatus ??
    raw?.status ??
    raw?.header?.docStatus ??
    raw?.header?.status ??
    null
  );
}

export default function SivOpenRedirectPage() {
  const navigate = useNavigate();
  const params = useParams();

  const companyId = safeString(params.companyId);
  const sivId = safeString(params.id || params.sivId || params.draftId);

  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function redirect() {
      if (!isUuid(companyId) || !isUuid(sivId)) {
        setError("Invalid companyId or SIV id.");
        setLoading(false);
        return;
      }

      try {
        const result = await sivApi.getById(companyId, sivId);

        if (!result) {
          throw new Error("SIV not found.");
        }

        const status = getStatusFromResponse(result);
        const normalized = normalizeStatus(status);

        let target: string;

        if (
          normalized === "draft" ||
          normalized === "0" ||
          normalized === "10"
        ) {
          target = `/companies/${companyId}/siv/drafts/${sivId}/edit`;
        } else {
          target = buildSivWorkflowRoute(companyId, sivId, status);
        }

        if (cancelled) return;

        navigate(target, { replace: true });
      } catch (e: any) {
        if (cancelled) return;

        setError(
          e?.response?.data?.title ||
            e?.response?.data?.message ||
            e?.message ||
            "Failed to resolve the SIV workflow route."
        );

        setLoading(false);

        navigate(buildSivDetailsRoute(companyId, sivId), { replace: true });
      }
    }

    void redirect();

    return () => {
      cancelled = true;
    };
  }, [companyId, sivId, navigate]);

  if (loading) {
    return <div style={{ padding: 24 }}>Opening SIV...</div>;
  }

  if (error) {
    return <div style={{ padding: 24 }}>{error}</div>;
  }

  return null;
}