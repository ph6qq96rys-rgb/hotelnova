import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { DocHeader } from "../../../../shared/ui/DocUI";
import { stockTransfersApi, toCreateBody } from "../api/stockTransfersApi";
import { StockTransferForm, emptyTransferForm } from "../components/StockTransferForm";
import { buildStockTransferPaths } from "../routing/stockTransferRoutes";
import { STOCK_TRANSFER_TYPE, type StockTransferFormValues } from "../types";
import { getApiError } from "../utils/apiUtils";

export default function StockTransferCreatePage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { companyId, branchId: selectedBranchId } = useAppScope();
  const paths = useMemo(() => buildStockTransferPaths(companyId), [companyId]);

  // Opened from procurement's stock check: the stock sits in `branchId`, the need is in the user's branch.
  const sourceBranch = search.get("branchId") || selectedBranchId;
  const initial = useMemo<StockTransferFormValues>(() => {
    const draft = emptyTransferForm();
    const itemId = search.get("itemId");
    if (itemId && search.get("fromLocationId")) {
      const crossBranch = Boolean(selectedBranchId && sourceBranch && sourceBranch !== selectedBranchId);
      draft.transferType = crossBranch ? STOCK_TRANSFER_TYPE.InterBranch : STOCK_TRANSFER_TYPE.InterDepartment;
      draft.toBranchId = crossBranch ? selectedBranchId ?? "" : sourceBranch ?? "";
      draft.fromLocationId = search.get("fromLocationId") ?? "";
      draft.toLocationId = search.get("toLocationId") ?? "";
      draft.notes = "Prepared from procurement stock availability review.";
      const quantity = Number(search.get("quantity"));
      draft.lines = [{ itemId, unitId: search.get("unitId") ?? "", quantity: quantity > 0 ? quantity : 1, notes: "" }];
    }
    return draft;
  }, [search, selectedBranchId, sourceBranch]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (!sourceBranch) return <div style={{ padding: 16 }}>Select a branch first.</div>;
  if (!paths) return <div style={{ padding: 16 }}>Company path could not be resolved.</div>;

  const scoped = (target: string) =>
    sourceBranch !== selectedBranchId ? `${target}?branchId=${encodeURIComponent(sourceBranch)}` : target;

  const save = async (values: StockTransferFormValues, submit: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const id = await stockTransfersApi.create(companyId, sourceBranch, toCreateBody(values));
      if (submit) {
        try {
          await stockTransfersApi.submit(companyId, sourceBranch, id);
        } catch (e) {
          // The draft is saved; open it so the user can fix what blocked submission.
          navigate(scoped(paths.edit(id)), { state: { error: getApiError(e) } });
          return;
        }
      }
      navigate(scoped(paths.detail(id)));
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
      <DocHeader
        title="New stock transfer"
        subtitle="Choose where the stock leaves and where it goes. A location in this branch is posted in one step; a location in another branch is dispatched and then received there."
      />
      <StockTransferForm
        companyId={companyId}
        branchId={sourceBranch}
        initial={initial}
        busy={busy}
        error={error}
        saveLabel="Save draft"
        onSave={(values, submit) => void save(values, submit)}
        onCancel={() => navigate(paths.list)}
      />
    </div>
  );
}
