// src/features/inventory/siv/pages/SivDraftEditorPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import SivDraftEditorScreen from "../components/SivDraftEditorScreen";
import { sivApi, type SivDetailsDto } from "../api/sivApi";
import { normalizeStatus } from "../types/sivTypes";

function isEditableDraft(value: unknown): boolean {
  const status = normalizeStatus(value);
  return status === "Draft" || status === "ChangesRequested";
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>): string {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? "";
}

export type SivDraftEditorPageProps = {
  mode?: "create" | "edit";
};

export default function SivDraftEditorPage({
  mode = "create",
}: SivDraftEditorPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    companyId: routeCompanyId,
    branchId: routeBranchId,
    draftId,
    sivId,
  } = useParams<{
    companyId?: string;
    branchId?: string;
    draftId?: string;
    sivId?: string;
  }>();

  const {
    companyId: scopeCompanyId,
    branchId: scopeBranchId,
    departmentId: scopeDepartmentId,
  } = useAppScope();

  const companyId = pickFirstNonEmpty(routeCompanyId, scopeCompanyId);
  const resolvedDraftId = pickFirstNonEmpty(draftId, sivId);

  const queryBranchId = searchParams.get("branchId") || "";
  const queryDepartmentId = searchParams.get("departmentId") || "";
  const queryToLocationId = searchParams.get("toLocationId") || "";
  const legacyQueryLocationId = searchParams.get("locationId") || "";

  const [draft, setDraft] = useState<SivDetailsDto | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "edit") {
      setDraft(null);
      setLoading(false);
      setError("");
      return;
    }

    if (!companyId || !resolvedDraftId) {
      setError("Missing route parameters.");
      setLoading(false);
      return;
    }

    let active = true;

    async function loadDraft() {
      try {
        setLoading(true);
        setError("");

        const response = await sivApi.getById(companyId, resolvedDraftId);
        const dto = ((response as any)?.data ??
          response) as SivDetailsDto | null;

        if (!active) return;

        if (!dto) {
          setError("Draft not found.");
          return;
        }

        if (!isEditableDraft(dto.docStatus ?? dto.status)) {
          navigate(`/companies/${companyId}/siv/${dto.id}`, {
            replace: true,
          });
          return;
        }

        setDraft(dto);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load SIV draft.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDraft();

    return () => {
      active = false;
    };
  }, [companyId, resolvedDraftId, mode, navigate]);

  const resolvedBranchId = useMemo(
    () =>
      pickFirstNonEmpty(
        draft?.branchId,
        routeBranchId,
        queryBranchId,
        scopeBranchId
      ),
    [draft?.branchId, routeBranchId, queryBranchId, scopeBranchId]
  );

  const resolvedDepartmentId = useMemo(
    () =>
      pickFirstNonEmpty(
        draft?.departmentId ?? undefined,
        queryDepartmentId,
        scopeDepartmentId ?? undefined
      ) || null,
    [draft?.departmentId, queryDepartmentId, scopeDepartmentId]
  );

  const resolvedToLocationId = useMemo(
    () =>
      pickFirstNonEmpty(
        draft?.toLocationId ?? undefined,
        queryToLocationId,
        legacyQueryLocationId
      ) || null,
    [draft?.toLocationId, queryToLocationId, legacyQueryLocationId]
  );

  if (loading) {
    return (
      <div className="page">
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          Loading SIV draft…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="page">
        <div className="alert alert-warn" role="alert">
          Missing company scope. Select a company workspace before creating an
          SIV.
        </div>
      </div>
    );
  }

  if (!resolvedBranchId) {
    return (
      <div className="page">
        <div className="alert alert-warn" role="alert">
          Missing branch scope. Select a branch before creating an SIV.
        </div>
      </div>
    );
  }

  return (
    <SivDraftEditorScreen
      companyId={draft?.companyId || companyId}
      branchId={resolvedBranchId}
      departmentId={resolvedDepartmentId}
      currentLocationId={resolvedToLocationId}
      mode={mode}
      draftId={draft?.id || resolvedDraftId || null}
      initialDraft={draft}
    />
  );
}