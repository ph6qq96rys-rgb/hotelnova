import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHasPermission } from "../../../auth/usePermissions";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { toUserFriendlyError } from "../../../shared/errors/errorMessage.utils";
import {
  approvePurchaseRequisitionFinance,
  approvePurchaseRequisitionFnb,
  cancelPurchaseRequisition,
  closePurchaseRequisition,
  convertPurchaseRequisitionToPurchaseOrders,
  decidePurchaseRequisition,
  getPurchaseRequisition,
  submitPurchaseRequisition,
  type CommandResult,
  type PurchaseRequisition,
} from "../api/procurementApi";
import { suppliersApi, type SupplierLookup } from "../api/purchasingApi";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";
import type { StockLocationDto } from "../../inventory/stock-locations/types";
import { Button } from "../../../components/ui/button";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/input";
import { ActionDialog, LabeledSelect, apiError } from "../components/p2pShared";
import { useI18n } from "../../../i18n";
import "./procurement.css";
import RequisitionDocuments from "../components/RequisitionDocuments";
import RequisitionAmendmentPanel from "../components/RequisitionAmendmentPanel";
import RequisitionApprovalRoute from "../components/RequisitionApprovalRoute";
import { approvalsApi, type ApprovalRoute } from "../api/procurementApprovalsApi";

const CANCELLABLE = new Set(["Draft", "Returned", "Submitted", "PendingApproval", "PendingFnbApproval", "PendingFinanceApproval"]);
const CONVERTIBLE = new Set(["Approved", "Sourcing"]);
const CLOSABLE = new Set(["Approved", "Sourcing", "Ordered", "Completed"]);

const money = {
  format: (value: number | string | null | undefined) => formatCurrency(value),
};

function formatDateTime(value?: string | null) {
  return formatAppDateTime(value);
}

function statusClass(status: string) {
  return `prq-chip prq-chip--${status.toLowerCase()}`;
}

/** Approved quantity in force: the requested quantity until an approver reduces it. */
function effectiveApproved(line: { quantity: number; approvedQuantity: number; approvedQuantityOverridden?: boolean }) {
  return line.approvedQuantityOverridden || line.approvedQuantity > 0 ? line.approvedQuantity : line.quantity;
}

function canDecision(status: string) {
  return status === "PendingFnbApproval" || status === "PendingFinanceApproval";
}

export default function PurchaseRequisitionDetailPage() {
  const { tx } = useI18n();
  const { companyId, id } = useParams<{ companyId: string; id: string }>();
  const navigate = useNavigate();
  const canCreatePurchaseRequisition = useHasPermission("purchasing.create");
  const canApprovePurchaseRequisition = useHasPermission("purchasing.approve");
  const canApproveFnbPurchaseRequisition = useHasPermission("purchasing.fnbapprove");
  const canApproveFinancePurchaseRequisition = useHasPermission("purchasing.financeapprove");
  const canManagePurchasing = useHasPermission("purchasing.manage");
  const [dialog, setDialog] = useState<"cancel" | "close" | "convert" | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [conversion, setConversion] = useState({ supplierId: "", deliveryLocationId: "", expectedDeliveryDate: "" });
  const [row, setRow] = useState<PurchaseRequisition | null>(null);
  const [approvalRoute,setApprovalRoute]=useState<ApprovalRoute|null>(null);
  const [comment, setComment] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!companyId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [document,route]=await Promise.all([getPurchaseRequisition(companyId,id),approvalsApi.route(companyId,id)]);
      setRow(document);setApprovalRoute(route);
    } catch {
      setError(tx("Unable to load purchase requisition."));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!companyId || !id || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const result = await submitPurchaseRequisition(companyId, id);
      if (!result.success) {
        setError(tx(result.error ?? "Unable to submit requisition."));
        return;
      }
      await load();
    } catch (e) {
      setError(tx(toUserFriendlyError(e, "Unable to submit requisition.")));
      await load();
    } finally {
      setActionBusy(false);
    }
  }

  async function approve(stage: "fnb" | "finance") {
    if (!companyId || !id || actionBusy) return;
    const decisionComment = comment.trim();
    const lineAdjustments: { lineId: string; approvedQuantity: number }[] = [];
    for (const line of row?.lines ?? []) {
      const raw = adjustments[line.id];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > effectiveApproved(line)) {
        setError(`${line.itemName}: ${tx("approved quantity can only be reduced, not increased.")}`);
        return;
      }
      if (value < effectiveApproved(line)) lineAdjustments.push({ lineId: line.id, approvedQuantity: value });
    }
    if (lineAdjustments.length > 0 && !decisionComment) {
      setError(tx("Add a comment explaining why approved quantities were reduced."));
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      const result = stage === "fnb"
        ? await approvePurchaseRequisitionFnb(companyId, id, decisionComment || undefined, row?.version, lineAdjustments)
        : await approvePurchaseRequisitionFinance(companyId, id, decisionComment || undefined, row?.version, lineAdjustments);
      if (!result.success) {
        setError(tx(result.error ?? "Unable to approve requisition."));
        return;
      }
      setComment("");
      setAdjustments({});
      await load();
    } catch (e) {
      setError(tx(toUserFriendlyError(e, "Unable to approve requisition.")));
      await load();
    } finally {
      setActionBusy(false);
    }
  }

  async function decide(decision: "reject" | "return" | "cancel") {
    if (!companyId || !id || actionBusy) return;

    const decisionComment = comment.trim();
    if ((decision === "return" || decision === "reject") && !decisionComment) {
      setError(tx(decision === "return"
        ? "Return comment is required before sending the requisition back for correction."
        : "Rejection comment is required before rejecting the requisition."));
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      const result = await decidePurchaseRequisition(companyId, id, decision, decisionComment || undefined, row?.version);
      if (!result.success) {
        setError(tx(result.error ?? "Unable to update requisition decision."));
        return;
      }
      setComment("");
      await load();
    } catch (e) {
      setError(tx(toUserFriendlyError(e, "Unable to update requisition decision.")));
      await load();
    } finally {
      setActionBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId, id]);

  async function runCommand(action: () => Promise<CommandResult>, fallback: string) {
    if (actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const result = await action();
      if (!result.success) setError(tx(result.error ?? fallback));
      setDialog(null);
      await load();
    } catch (e) {
      setError(tx(apiError(e, fallback)));
      setDialog(null);
      await load();
    } finally {
      setActionBusy(false);
    }
  }

  async function openConversion() {
    if (!companyId || !row) return;
    setConversion({
      supplierId: row.suggestedSupplierId ?? "",
      deliveryLocationId: row.deliveryLocationId ?? row.requiredStockLocationId ?? "",
      expectedDeliveryDate: "",
    });
    setDialog("convert");
    try {
      const [sup, locs] = await Promise.all([suppliersApi.lookup(companyId), stockLocationsApi.list(companyId)]);
      setSuppliers(sup);
      const active = locs.filter((l) => l.isActive !== false);
      const receiving = active.filter((l) => (l as { canReceiveGrn?: boolean }).canReceiveGrn === true);
      setLocations(receiving.length > 0 ? receiving : active);
    } catch (e) {
      setError(tx(apiError(e, "Unable to load suppliers.")));
    }
  }

  async function convert() {
    if (!companyId || !id || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const orders = await convertPurchaseRequisitionToPurchaseOrders(companyId, id, {
        defaultSupplierId: conversion.supplierId || null,
        deliveryLocationId: conversion.deliveryLocationId || null,
        expectedDeliveryDate: conversion.expectedDeliveryDate || null,
      });
      setDialog(null);
      navigate(orders.length === 1
        ? `/companies/${companyId}/procurement/purchase-orders/${orders[0].id}`
        : `/companies/${companyId}/procurement/purchase-orders`);
    } catch (e) {
      setError(tx(apiError(e, "Unable to create purchase orders from this requisition.")));
      setDialog(null);
      await load();
    } finally {
      setActionBusy(false);
    }
  }

  if (!companyId || !id) return null;

  // Mirrors PurchaseRequisitionSecurity.EnsureStagePermission: purchasing.approve, or the current stage's permission.
  const canDecideStage = !!row && canDecision(row.status) && (
    canApprovePurchaseRequisition
    || (row.status === "PendingFnbApproval" && canApproveFnbPurchaseRequisition)
    || (row.status === "PendingFinanceApproval" && canApproveFinancePurchaseRequisition));
  const decisionAvailable = !!row && (
    (row.status === "PendingFnbApproval" && canApproveFnbPurchaseRequisition)
    || (row.status === "PendingFinanceApproval" && canApproveFinancePurchaseRequisition)
    || (canDecideStage));
  const quantityReduced = !!row?.lines.some((line) => line.approvedQuantityOverridden);
  const canAdjustQuantities = !!row && approvalRoute?.status !== "Pending" && (
    (row.status === "PendingFnbApproval" && canApproveFnbPurchaseRequisition)
    || (row.status === "PendingFinanceApproval" && canApproveFinancePurchaseRequisition));

  return (
    <main className="prq-page">
      <header className="prq-page-header">
        <div>
          <div className="prq-kicker">{tx("Procurement / Purchase Requisitions")}</div>
          <h1>{row?.requisitionNo ?? tx("Purchase Requisition")}</h1>
          <p>{row ? `${row.purchaseCategory} ${tx("demand from")} ${row.branchName ?? tx("company scope")}` : tx("Loading requisition")}</p>
        </div>
        <div className="prq-actions">
          <button className="prq-btn" type="button" onClick={() => navigate(-1)}>{tx("Back")}</button>
          {canCreatePurchaseRequisition && row && ["Draft","Returned"].includes(row.status) && <Button variant="outline" onClick={()=>navigate(`/companies/${companyId}/procurement/requisitions/${id}/edit`)}>{tx("Edit")}</Button>}
          {canCreatePurchaseRequisition && (row?.status === "Draft" || row?.status === "Returned") ? (
            <button className="prq-btn prq-btn--primary" type="button" onClick={submit} disabled={actionBusy}>{tx("Submit")}</button>
          ) : null}
        </div>
      </header>

      {error && <div className="prq-alert">{tx(error)}</div>}
      {loading && <div className="prq-panel prq-empty">{tx("Loading purchase requisition...")}</div>}

      {row && (
        <>
          <section className="prq-metrics">
            <div><span>{tx("Status")}</span><strong><span className={statusClass(row.status)}>{tx(row.status === "Returned" ? "Changes Requested" : row.status)}</span></strong></div>
            <div><span>{tx("Priority")}</span><strong>{tx(row.priority)}</strong></div>
            <div><span>{tx("Required by")}</span><strong>{formatDateTime(row.requiredByDateUtc)}</strong></div>
            <div><span>{tx("Estimated total")}</span><strong>{money.format(row.estimatedTotal || 0)}</strong></div>
          </section>

          <section className="prq-panel prq-detail-grid">
            <div><span>{tx("Requester")}</span><strong>{row.requestedByName ?? "-"}</strong></div>
            <div><span>{tx("Branch")}</span><strong>{row.branchName ?? tx("Company scope")}</strong></div>
            <div><span>{tx("Department")}</span><strong>{row.departmentName ?? "-"}</strong></div>
            <div><span>{tx("Suggested supplier")}</span><strong>{row.suggestedSupplierName ?? "-"}</strong></div>
            <div><span>{tx("Required location")}</span><strong>{row.requiredStockLocationName ?? "-"}</strong></div>
            <div><span>{tx("Delivery location")}</span><strong>{row.deliveryLocationName ?? "-"}</strong></div>
            <div className="prq-span-2"><span>{tx("Business justification")}</span><strong>{row.businessJustification}</strong></div>
            {row.stockAvailabilityNote && <div className="prq-span-2"><span>{tx("Stock note")}</span><strong>{row.stockAvailabilityNote}</strong></div>}
          </section>

          <section className="prq-panel">
            <div className="prq-section-title"><h2>{tx("Lines")}</h2></div>
            <div className="prq-table-wrap">
              <table className="prq-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{tx("Type")}</th>
                    <th>{tx("Item or Service")}</th>
                    <th>{tx("UOM")}</th>
                    <th className="prq-right">{tx("Qty")}</th>
                    <th className="prq-right">{tx("Approved")}</th>
                    <th className="prq-right">{tx("Ordered")}</th>
                    <th className="prq-right">{tx("Received")}</th>
                    <th className="prq-right">{tx("Outstanding to order")}</th>
                    <th className="prq-right">{tx("Outstanding to fulfil")}</th>
                    <th className="prq-right">{tx("Unit Price")}</th>
                    <th className="prq-right">{tx("Total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.lineNo}</td>
                      <td>{tx(line.lineType.replace(/([a-z])([A-Z])/g, "$1 $2"))}</td>
                      <td><strong>{line.itemName}</strong><br /><span>{line.specification ?? "-"}</span></td>
                      <td>{line.uomName}</td>
                      <td className="prq-right">{line.quantity}</td>
                      <td className="prq-right">
                        {canAdjustQuantities ? (
                          <Input
                            aria-label={`${tx("Approved quantity")} · ${line.itemName}`}
                            type="number"
                            min={0}
                            max={effectiveApproved(line)}
                            step="0.0001"
                            value={adjustments[line.id] ?? String(effectiveApproved(line))}
                            onChange={(e) => setAdjustments((a) => ({ ...a, [line.id]: e.target.value }))}
                          />
                        ) : (
                          <>{line.approvedQuantity}{line.approvedQuantityOverridden ? <span title={tx("Approved quantity was reduced by the approver.")}> *</span> : null}</>
                        )}
                      </td>
                      <td className="prq-right">{line.orderedQuantity ?? 0}</td>
                      <td className="prq-right">{line.receivedQuantity ?? 0}</td>
                      <td className="prq-right">{line.outstandingToOrder ?? 0}</td>
                      <td className="prq-right">{line.outstandingToFulfil ?? Math.max(0,line.approvedQuantity-(line.receivedQuantity??0))}</td>
                      <td className="prq-right">{money.format(line.estimatedUnitPrice)}</td>
                      <td className="prq-right">{money.format(line.estimatedLineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {quantityReduced && <p className="p2p-muted">* {tx("Approved quantity was reduced by the approver.")}</p>}
          </section>

          <RequisitionDocuments companyId={companyId} id={id} editable={canCreatePurchaseRequisition && ["Draft","Returned"].includes(row.status)} onChanged={()=>void load()}/>
          {canCreatePurchaseRequisition&&["Approved","Sourcing","Ordered","Completed"].includes(row.status)&&<RequisitionAmendmentPanel companyId={companyId} id={id} lines={row.lines}/>}

          {(decisionAvailable || !!approvalRoute) && <section className="prq-panel prq-approval">
            <div>
              <h2>{tx("Approval Decision")}</h2>
              {approvalRoute&&companyId&&id&&<RequisitionApprovalRoute companyId={companyId} id={id} route={approvalRoute} onChanged={load}/>}
              <p>{tx("Store Keeper submits the request. F&B validates operational need, then Finance gives final budget approval.")}</p>
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={tx("Decision comment (required for return or rejection)")} />
            {canAdjustQuantities && <p className="p2p-muted">{tx("You can reduce approved quantities in the Lines table before approving. Explain the change in the comment.")}</p>}
            <div className="prq-actions">
              {approvalRoute?.status!=="Pending" && row.status === "PendingFnbApproval" && canApproveFnbPurchaseRequisition && (
                <button className="prq-btn prq-btn--primary" type="button" onClick={() => approve("fnb")} disabled={actionBusy}>{tx("F&B approve")}</button>
              )}
              {approvalRoute?.status!=="Pending" && row.status === "PendingFinanceApproval" && canApproveFinancePurchaseRequisition && (
                <button className="prq-btn prq-btn--primary" type="button" onClick={() => approve("finance")} disabled={actionBusy}>{tx("Finance approve")}</button>
              )}
              {approvalRoute?.status!=="Pending" && canDecideStage && (
                <button className="prq-btn" type="button" onClick={() => decide("return")} disabled={actionBusy}>{tx("Return")}</button>
              )}
              {approvalRoute?.status!=="Pending" && canDecideStage && (
                <button className="prq-btn prq-btn--danger" type="button" onClick={() => decide("reject")} disabled={actionBusy}>{tx("Reject")}</button>
              )}
            </div>
          </section>}

          {(CONVERTIBLE.has(row.status) || CLOSABLE.has(row.status) || CANCELLABLE.has(row.status)) && (
            <section className="prq-panel prq-approval">
              <div>
                <h2>{tx("Ordering")}</h2>
                <p>{tx("Convert approved quantities into draft purchase orders (one per supplier), close the requisition when no more ordering is needed, or withdraw it before approval.")}</p>
              </div>
              <div className="prq-actions">
                {CONVERTIBLE.has(row.status) && canCreatePurchaseRequisition && (
                  <Button onClick={() => void openConversion()} disabled={actionBusy}>{tx("Create purchase orders")}</Button>
                )}
                {CLOSABLE.has(row.status) && canManagePurchasing && (
                  <Button variant="outline" onClick={() => setDialog("close")} disabled={actionBusy}>{tx("Close requisition")}</Button>
                )}
                {CANCELLABLE.has(row.status) && (
                  <Button variant="destructive" onClick={() => setDialog("cancel")} disabled={actionBusy}>{tx("Cancel requisition")}</Button>
                )}
              </div>
            </section>
          )}

          <section className="prq-panel">
            <div className="prq-section-title"><h2>{tx("Decision History")}</h2><Link to={`/companies/${companyId}/procurement/requisitions`}>{tx("All requisitions")}</Link></div>
            {row.decisions.length === 0 ? <p className="prq-empty">{tx("No decisions recorded.")}</p> : (
              <div className="prq-history">
                {row.decisions.map((decision) => (
                  <div key={decision.id}>
                    <strong>{tx(decision.decision)}{decision.decidedByName ? ` · ${decision.decidedByName}` : ""}</strong>
                    <span>{formatDateTime(decision.decidedAtUtc)}</span>
                    <p>{decision.comment ?? "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ActionDialog
        open={dialog === "cancel"}
        title={tx("Cancel requisition")}
        message={tx("Only requisitions that are not yet approved can be cancelled.")}
        confirmText={tx("Cancel requisition")}
        danger
        commentLabel={tx("Reason")}
        busy={actionBusy}
        onConfirm={(reason) => void runCommand(() => cancelPurchaseRequisition(companyId, id, reason || undefined, row?.version), "Unable to cancel requisition.")}
        onClose={() => setDialog(null)}
      />
      <ActionDialog
        open={dialog === "close"}
        title={tx("Close requisition")}
        message={tx("Stops further ordering. Purchase orders already raised are not affected.")}
        confirmText={tx("Close requisition")}
        commentLabel={tx("Reason")}
        commentRequired
        busy={actionBusy}
        onConfirm={(reason) => void runCommand(() => closePurchaseRequisition(companyId, id, reason, row?.version), "Unable to close requisition.")}
        onClose={() => setDialog(null)}
      />
      <ActionDialog
        open={dialog === "convert"}
        title={tx("Create purchase orders")}
        message={tx("Creates draft purchase orders for the approved quantities not yet ordered. Prices default from the supplier price list.")}
        confirmText={tx("Create purchase orders")}
        busy={actionBusy}
        onConfirm={() => void convert()}
        onClose={() => setDialog(null)}
      >
        <LabeledSelect label={tx("Supplier")} required value={conversion.supplierId} onChange={(e) => setConversion((c) => ({ ...c, supplierId: e.target.value }))}>
          <option value="">{tx("Select supplier")}</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
        </LabeledSelect>
        <LabeledSelect label={tx("Deliver to")} value={conversion.deliveryLocationId} onChange={(e) => setConversion((c) => ({ ...c, deliveryLocationId: e.target.value }))}>
          <option value="">{tx("Use requisition delivery location")}</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </LabeledSelect>
        <FormField label={tx("Expected delivery")} type="date" value={conversion.expectedDeliveryDate} onChange={(e) => setConversion((c) => ({ ...c, expectedDeliveryDate: e.target.value }))} />
      </ActionDialog>
    </main>
  );
}
