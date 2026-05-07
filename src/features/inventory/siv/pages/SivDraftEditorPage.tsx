import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import SivDraftEditorScreen from "../components/SivDraftEditorScreen";
import { sivApi } from "../api/sivApi";

export type SivDraftEditorPageProps = {
  mode?: "create" | "edit";
};

function isDraftStatus(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;

  const status = String(value).trim().toLowerCase();

  return status === "draft" || status === "10" || status === "0";
}

export default function SivDraftEditorPage({
  mode = "create",
}: SivDraftEditorPageProps) {
  const navigate = useNavigate();

  const params = useParams<{
    companyId?: string;
    draftId?: string;
    sivId?: string;
  }>();

  const {
    companyId: scopeCompanyId,
    branchId: scopeBranchId,
    departmentId: scopeDepartmentId,
    currentLocationId,
  } = useAppScope();

  const companyId = params.companyId || scopeCompanyId || "";
  const draftId = params.draftId || params.sivId || "";

  const [loading, setLoading] = useState(mode === "edit");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<any | null>(null);

  useEffect(() => {
    if (mode !== "edit") return;

    if (!companyId || !draftId) {
      setError("Missing draft route parameters.");
      setLoading(false);
      return;
    }

    let active = true;

    async function loadDraft() {
      try {
        setLoading(true);
        setError("");

        const data = await sivApi.getById(companyId, draftId);

        if (!active) return;

        if (!data) {
          setError("Draft not found.");
          return;
        }

        if (!isDraftStatus(data.docStatus)) {
          navigate(`/companies/${companyId}/siv/open/${data.id}`, {
            replace: true,
          });
          return;
        }

        setDraft(data);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load SIV draft.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDraft();

    return () => {
      active = false;
    };
  }, [companyId, draftId, mode, navigate]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading SIV draft...</div>;
  }

  if (error) {
    return <div style={{ padding: 24 }}>{error}</div>;
  }

  if (!companyId) {
    return <div style={{ padding: 24 }}>Missing company scope.</div>;
  }

  if (mode === "create" && !scopeBranchId) {
    return <div style={{ padding: 24 }}>Missing branch scope.</div>;
  }

  return (
    <SivDraftEditorScreen
      companyId={draft?.companyId || companyId}
      branchId={draft?.branchId || scopeBranchId}
      departmentId={draft?.departmentId ?? scopeDepartmentId ?? null}
      currentLocationId={draft?.fromLocationId ?? currentLocationId ?? null}
      mode={mode}
      draftId={draft?.id || draftId || null}
    />
  );
}