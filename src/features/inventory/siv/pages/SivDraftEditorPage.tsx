// src/features/inventory/siv/pages/SivDraftEditorPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { getApiError } from "../../../../api/getApiError";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { sivApi, type SivDetailsDto } from "../api/sivApi";
import SivDraftEditorScreen from "../components/SivDraftEditorScreen";
import { normalizeStatus } from "../types/sivTypes";
import { sivDetailsPath } from "../utils/sivWorkflowRoutes";

export type SivDraftEditorPageProps = {
  mode?: "create" | "edit";
};

type RouteParams = {
  companyId?: string;
  branchId?: string;
  draftId?: string;
  sivId?: string;
  id?: string;
};

type LoadState = {
  loading: boolean;
  error: string;
  draft: SivDetailsDto | null;
};

const EDITABLE_STATUSES = new Set([
  "Draft",
  "ChangesRequested",
]);

function isEditableDraft(status: unknown): boolean {
  return EDITABLE_STATUSES.has(normalizeStatus(status));
}

function nonEmpty(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function firstNonEmpty(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    const normalized = nonEmpty(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function nullableFirstNonEmpty(
  ...values: Array<string | null | undefined>
): string | null {
  return firstNonEmpty(...values) || null;
}

export default function SivDraftEditorPage({
  mode = "create",
}: SivDraftEditorPageProps) {
  const navigate = useErpNavigate();
  const [searchParams] = useSearchParams();

  const {
    companyId: routeCompanyId,
    branchId: routeBranchId,
    draftId,
    sivId,
    id,
  } = useParams<RouteParams>();

  const {
    companyId: scopeCompanyId,
    branchId: scopeBranchId,
    departmentId: scopeDepartmentId,
    userId: scopeUserId,
    currentUserId,
  } = useAppScope() as ReturnType<typeof useAppScope> & {
    userId?: string | null;
    currentUserId?: string | null;
  };

  const companyId = firstNonEmpty(
    routeCompanyId,
    scopeCompanyId,
  );

  const resolvedDraftId = firstNonEmpty(
    draftId,
    sivId,
    id,
  );

  const queryBranchId = nonEmpty(
    searchParams.get("branchId"),
  );

  const queryDepartmentId = nonEmpty(
    searchParams.get("departmentId"),
  );

  const queryToLocationId = nonEmpty(
    searchParams.get("toLocationId"),
  );

  const legacyQueryLocationId = nonEmpty(
    searchParams.get("locationId"),
  );

  const requestedByUserId = nullableFirstNonEmpty(
    scopeUserId,
    currentUserId,
  );

  const [{ loading, error, draft }, setLoadState] =
    useState<LoadState>({
      loading: mode === "edit",
      error: "",
      draft: null,
    });

  useEffect(() => {
    if (mode !== "edit") {
      setLoadState({
        loading: false,
        error: "",
        draft: null,
      });

      return;
    }

    if (!companyId || !resolvedDraftId) {
      setLoadState({
        loading: false,
        error: "Missing SIV draft route parameters.",
        draft: null,
      });

      return;
    }

    const abortController = new AbortController();

    async function loadDraft() {
      setLoadState((current) => ({
        ...current,
        loading: true,
        error: "",
      }));

      try {
        const dto = await sivApi.getById(
          companyId,
          resolvedDraftId,
        );

        if (abortController.signal.aborted) {
          return;
        }

        if (!dto?.id) {
          setLoadState({
            loading: false,
            error: "SIV draft not found.",
            draft: null,
          });

          return;
        }

        const status = dto.docStatus ?? dto.status;

        if (!isEditableDraft(status)) {
          const detailsCompanyId = firstNonEmpty(
            dto.companyId,
            companyId,
          );

          navigate(
            sivDetailsPath(detailsCompanyId, dto.id),
            { replace: true },
          );

          return;
        }

        setLoadState({
          loading: false,
          error: "",
          draft: dto,
        });
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        setLoadState({
          loading: false,
          error: getApiError(
            err,
            "Failed to load SIV draft.",
          ),
          draft: null,
        });
      }
    }

    void loadDraft();

    return () => {
      abortController.abort();
    };
  }, [
    companyId,
    mode,
    navigate,
    resolvedDraftId,
  ]);

  const resolvedBranchId = useMemo(
    () =>
      firstNonEmpty(
        draft?.branchId,
        routeBranchId,
        queryBranchId,
        scopeBranchId,
      ),
    [
      draft?.branchId,
      queryBranchId,
      routeBranchId,
      scopeBranchId,
    ],
  );

  const resolvedDepartmentId = useMemo(
    () =>
      nullableFirstNonEmpty(
        draft?.departmentId,
        queryDepartmentId,
        scopeDepartmentId,
      ),
    [
      draft?.departmentId,
      queryDepartmentId,
      scopeDepartmentId,
    ],
  );

  const resolvedToLocationId = useMemo(
    () =>
      nullableFirstNonEmpty(
        draft?.toLocationId,
        queryToLocationId,
        legacyQueryLocationId,
      ),
    [
      draft?.toLocationId,
      legacyQueryLocationId,
      queryToLocationId,
    ],
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
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="page">
        <div
          className="alert alert-warn"
          role="alert"
        >
          Missing company scope. Select a company workspace
          before creating an SIV.
        </div>
      </div>
    );
  }

  if (!resolvedBranchId) {
    return (
      <div className="page">
        <div
          className="alert alert-warn"
          role="alert"
        >
          Missing branch scope. Select a branch before creating
          or editing an SIV draft.
        </div>
      </div>
    );
  }

  if (mode === "edit" && !draft) {
    return (
      <div className="page">
        <div
          className="alert alert-danger"
          role="alert"
        >
          SIV draft could not be loaded for editing.
        </div>
      </div>
    );
  }

  return (
    <SivDraftEditorScreen
      companyId={firstNonEmpty(
        draft?.companyId,
        companyId,
      )}
      branchId={resolvedBranchId}
      departmentId={resolvedDepartmentId}
      currentLocationId={resolvedToLocationId}
      requestedByUserId={requestedByUserId}
      mode={mode}
      draftId={
        firstNonEmpty(
          draft?.id,
          resolvedDraftId,
        ) || null
      }
      initialDraft={draft}
    />
  );
}