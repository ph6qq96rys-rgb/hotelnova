// src/features/inventory/siv/pages/SivOpenRedirectPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { sivApi } from "../api/sivApi";
import { normalizeStatus } from "../types/sivTypes";
import {
  getSivWorkspacePath,
  sivDetailsPath,
} from "../utils/sivWorkflowRoutes";
import "./siv-draft.css";

type RouteParams = {
  companyId?: string;
  branchId?: string;
  id?: string;
  sivId?: string;
  draftId?: string;
};

function isUuid(value?: string | null): boolean {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function nonEmpty(value?: string | null): string {
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

function getResponseBody<T>(response: unknown): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response
  ) {
    const wrapped = response as { data?: unknown };

    if (wrapped.data !== undefined) {
      return wrapped.data as T;
    }
  }

  return response as T;
}

export default function SivOpenRedirectPage() {
  const navigate = useErpNavigate();

  const {
    companyId: routeCompanyId,
    branchId: routeBranchId,
    id,
    sivId,
    draftId,
  } = useParams<RouteParams>();

  const companyId = nonEmpty(routeCompanyId);
  const branchId = nonEmpty(routeBranchId) || null;

  const resolvedSivId = firstNonEmpty(
    sivId,
    draftId,
    id,
  );

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const detailsUrl = useMemo(() => {
    if (!isUuid(companyId) || !isUuid(resolvedSivId)) {
      return "";
    }

    return sivDetailsPath(companyId, resolvedSivId);
  }, [companyId, resolvedSivId]);

  useEffect(() => {
    let cancelled = false;

    async function redirectToWorkspace() {
      if (!isUuid(companyId) || !isUuid(resolvedSivId)) {
        setError(
          "Invalid or missing SIV reference. Open the voucher from the SIV list.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await sivApi.getById(
          companyId,
          resolvedSivId,
        );

        if (cancelled) return;

        const raw = getResponseBody<{
          docStatus?: unknown;
          status?: unknown;
          branchId?: string | null;
        }>(response);

        const status = normalizeStatus(
          raw.docStatus ?? raw.status,
        );

        const resolvedBranchId =
          nonEmpty(raw.branchId) ||
          branchId ||
          null;

        const target = getSivWorkspacePath(
          companyId,
          resolvedSivId,
          status,
          resolvedBranchId,
        );

        navigate(target, {
          replace: true,
        });
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to open SIV.",
        );
        setLoading(false);
      }
    }

    void redirectToWorkspace();

    return () => {
      cancelled = true;
    };
  }, [
    branchId,
    companyId,
    navigate,
    resolvedSivId,
  ]);

  if (loading) {
    return (
      <div
        className="page siv-route-state"
        aria-busy="true"
      >
        <div className="siv-route-state__card">
          <div
            className="siv-route-state__spinner"
            aria-hidden="true"
          />

          <div className="siv-route-state__title">
            Opening SIV…
          </div>

          <div className="siv-route-state__desc">
            Checking workflow status and routing you to the
            correct workspace.
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page siv-route-state">
        <div
          className="siv-route-state__card"
          role="alert"
        >
          <div className="siv-route-state__title">
            Unable to open SIV
          </div>

          <div className="siv-route-state__desc">
            {error}
          </div>

          {detailsUrl && (
            <button
              type="button"
              className="btn"
              onClick={() =>
                navigate(detailsUrl, {
                  replace: true,
                })
              }
            >
              Open detail page instead →
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}