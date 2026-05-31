import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import SivDraftEditorScreen from "../components/SivDraftEditorScreen";
import { sivApi, type SivDetailsDto } from "../api/sivApi";
import { normalizeStatus } from "../types/sivTypes";

function isDraft(value: unknown): boolean {
  const s = normalizeStatus(value as string);
  return s === "Draft" ||  s === "ChangesRequested";
}

export type SivDraftEditorPageProps = { mode?: "create" | "edit" };

export default function SivDraftEditorPage({ mode = "create" }: SivDraftEditorPageProps) {
  const nav = useNavigate();
  const { companyId: routeCompanyId, draftId, sivId } = useParams<{
    companyId?: string;
    draftId?: string;
    sivId?: string;
  }>();

  const {
    companyId:        scopeCompanyId,
    branchId:         scopeBranchId,
    departmentId:     scopeDepartmentId,
    currentLocationId,
  } = useAppScope();

  // Derive stable scalars once — keeps the effect dep array readable.
  const companyId      = routeCompanyId || scopeCompanyId || "";
  const resolvedDraftId = draftId || sivId || "";

  // FIX: was `any` — typed correctly so property accesses are checked.
  const [draft,   setDraft]   = useState<SivDetailsDto | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [error,   setError]   = useState("");

  useEffect(() => {
    // FIX: original had a double-nested if that merged three unrelated early
    // exits. Separated into clear, sequential guards.
    if (mode !== "edit") return;
    if (!companyId || !resolvedDraftId) {
      setError("Missing route parameters.");
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      // Batch the loading/error reset into a single render.
      setLoading(true);
      setError("");

      try {
        const data = await sivApi.getById(companyId, resolvedDraftId);
        if (!active) return;

        if (!data) {
          setError("Draft not found.");
          return;
        }

        if (!isDraft(data.status)) {
          // Not a draft — redirect to read-only view.
          nav(`/companies/${companyId}/siv/${data.data.id}`, { replace: true });
          return;
        }

        setDraft(data.data);
      } catch (e: unknown) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : "Failed to load SIV draft.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [companyId, resolvedDraftId, mode, nav]);

  // ── Guards (render path) ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Loading draft…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="page">
        <div className="alert alert-warn">Missing company scope.</div>
      </div>
    );
  }

  // FIX: branchId guard was create-only. In edit mode, if the draft has no
  // branchId and the scope also has none, SivDraftEditorScreen can't load
  // stock locations. Guard both modes.
  const resolvedBranchId = draft?.branchId || scopeBranchId || "";
  if (!resolvedBranchId) {
    return (
      <div className="page">
        <div className="alert alert-warn">Missing branch scope.</div>
      </div>
    );
  }

  return (
    <SivDraftEditorScreen
      companyId={draft?.companyId      || companyId}
      branchId={resolvedBranchId}
      departmentId={draft?.departmentId  ?? scopeDepartmentId  ?? null}
      currentLocationId={draft?.fromLocationId ?? currentLocationId ?? null}
      mode={mode}
      draftId={draft?.id || resolvedDraftId || null}
    />
  );
}