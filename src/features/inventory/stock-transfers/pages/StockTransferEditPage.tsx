import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { Button } from "../../../../components/ui/button";
import { StateMessage } from "../../../../components/ui/Feedback";
import { DocHeader } from "../../../../shared/ui/DocUI";
import { stockTransfersApi, toUpdateBody } from "../api/stockTransfersApi";
import { StockTransferForm } from "../components/StockTransferForm";
import { buildStockTransferPaths } from "../routing/stockTransferRoutes";
import type { StockTransferDocumentDto, StockTransferFormValues } from "../types";
import { getApiError, isoToDateOnly } from "../utils/apiUtils";
import { normalizeTransferType, transferStatusLabel } from "../utils/stockTransferLabels";

function toFormValues(doc: StockTransferDocumentDto): StockTransferFormValues {
  const type = normalizeTransferType(doc.transferType);
  return {
    transferType: type,
    toBranchId: doc.toBranchId,
    fromDepartmentId: doc.fromDepartmentId ?? "",
    toDepartmentId: doc.toDepartmentId ?? "",
    fromLocationId: doc.fromLocationId,
    toLocationId: doc.toLocationId,
    transferDate: isoToDateOnly(doc.transferDateUtc) || isoToDateOnly(doc.createdAtUtc),
    notes: doc.reference ?? "",
    lines: [...doc.items]
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((line) => ({ itemId: line.itemId, unitId: line.uomId, quantity: line.quantity, notes: line.notes ?? "" })),
  };
}

export default function StockTransferEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const { companyId, branchId: selectedBranchId } = useAppScope();
  const branchId = search.get("branchId") || selectedBranchId;
  const scoped = (target: string) =>
    branchId !== selectedBranchId && branchId ? `${target}?branchId=${encodeURIComponent(branchId)}` : target;
  const paths = useMemo(() => buildStockTransferPaths(companyId), [companyId]);

  const [doc, setDoc] = useState<StockTransferDocumentDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    (location.state as { error?: string } | null)?.error ?? null
  );

  useEffect(() => {
    if (!companyId || !branchId || !id) return;
    let alive = true;
    stockTransfersApi
      .get(companyId, branchId, id)
      .then((data) => alive && setDoc(data))
      .catch((e) => alive && setLoadError(getApiError(e)));
    return () => {
      alive = false;
    };
  }, [companyId, branchId, id]);

  const initial = useMemo(() => (doc ? toFormValues(doc) : null), [doc]);

  if (!companyId || !branchId || !paths) return <div style={{ padding: 16 }}>Select a company and branch first.</div>;
  if (loadError) return <div style={{ padding: 16 }}><StateMessage tone="error">{loadError}</StateMessage></div>;
  if (!doc || !initial) return <div style={{ padding: 16 }}><StateMessage tone="loading">Loading transfer…</StateMessage></div>;

  if (!doc.allowedActions.includes("edit")) {
    return (
      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        <StateMessage tone="warning">
          {doc.transferNumber} is {transferStatusLabel(doc.status, normalizeTransferType(doc.transferType)).toLowerCase()} and can no longer be edited.
        </StateMessage>
        <div><a href={paths.detail(id)} onClick={(e) => { e.preventDefault(); navigate(scoped(paths.detail(id))); }}>Open the transfer</a></div>
      </div>
    );
  }

  const save = async (values: StockTransferFormValues, submit: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await stockTransfersApi.update(companyId, branchId, id, toUpdateBody(values));
      if (submit) await stockTransfersApi.submit(companyId, branchId, id);
      navigate(scoped(paths.detail(id)));
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
      <DocHeader title={`Edit ${doc.transferNumber}`} subtitle={doc.rejectionReason ? `Returned: ${doc.rejectionReason}` : "Draft"} />
      <StockTransferForm
        companyId={companyId}
        branchId={branchId}
        initial={initial}
        busy={busy}
        error={error}
        saveLabel="Save changes"
        onSave={(values, submit) => void save(values, submit)}
        onCancel={() => navigate(scoped(paths.detail(id)))}
      />
    </div>
  );
}
