import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { useI18n } from "../../../../i18n";
import { sivApi } from "../api/sivApi";
import type { ApproveSivLineRequest } from "../api/sivApi";
import { SivRecommendationCard } from "../components/SivRecommendationCard";
import SivWorkflowBar from "../components/SivWorkflowBar";
import type {
  SivApprovalLineInput,
  SivLineRecommendation,
  SivRecommendationResult,
} from "../types/sivRecommendation";
import {
  fmtDate,
  fmtQty,
  getApiError,
  mapToVm,
  normalizeStatus,
  STATUS_BADGE,
  type SivVm,
} from "../types/sivTypes";
import {
  getSivWorkspacePath,
  sivDetailsPath,
  sivDraftPath,
} from "../utils/sivWorkflowRoutes";
import "./siv-approval-copilot.css";
import "./siv-draft.css";

type RouteParams = {
  companyId?: string;
  branchId?: string;
  sivId?: string;
  id?: string;
};

type DialogMode = "reject" | "requestChanges" | null;

function firstNonEmpty(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }

  return "";
}

function isExpiredDate(value?: string | null): boolean {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return date < endOfToday;
}

function parseApprovedQty(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCoverWeeks(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "No usage history";
  if (value <= 0) return "No cover";

  return `${fmtQty(value)} wk cover`;
}

function guidanceLabel(line: SivLineRecommendation): string {
  switch (line.decision) {
    case "Approve":
      return "Approve as requested";
    case "PartiallyApprove":
      return "Reduce quantity";
    case "Review":
      return "Needs review";
    case "Reject":
      return "Do not approve";
    default:
      return line.riskLevel;
  }
}

export default function SivApprovalPage() {
  const navigate = useErpNavigate();
  const { tx } = useI18n();

  const {
    companyId: routeCompanyId,
    branchId: routeBranchId,
    sivId: routeSivId,
    id: routeId,
  } = useParams<RouteParams>();

  const {
    companyId: scopeCompanyId,
    branchId: scopeBranchId,
  } = useAppScope();

  const companyId = firstNonEmpty(
    routeCompanyId,
    scopeCompanyId,
  );

  const routeBranchIdResolved = firstNonEmpty(
    routeBranchId,
    scopeBranchId,
  );

  const sivId = firstNonEmpty(
    routeSivId,
    routeId,
  );

  const [document, setDocument] = useState<SivVm | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [approvedQtys, setApprovedQtys] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  const [recommendation, setRecommendation] =
    useState<SivRecommendationResult | null>(null);

  const [overrideReason, setOverrideReason] = useState("");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [changeRequestReason, setChangeRequestReason] = useState("");

  const effectiveBranchId = firstNonEmpty(
    document?.branchId,
    routeBranchIdResolved,
  );

  const clearMessages = useCallback(() => {
    setPageError("");
    setSuccessMessage("");
  }, []);

  const loadDocument = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId || !sivId) {
        setDocument(null);
        setPageError(
          "Company and SIV route parameters are required.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setPageError("");

      try {
        const raw = await sivApi.getById(companyId, sivId);

        if (signal?.aborted) return;

        const vm = mapToVm(raw);
        const status = normalizeStatus(vm.docStatus);

        if (status !== "Submitted") {
          navigate(
            getSivWorkspacePath(
              companyId,
              sivId,
              status,
              firstNonEmpty(vm.branchId, routeBranchIdResolved) || null,
            ),
            { replace: true },
          );
          return;
        }

        setDocument(vm);

        setApprovedQtys((current) => {
          const next: Record<string, string> = {};

          for (const line of vm.lines) {
            next[line.id] =
              current[line.id] ?? String(line.qty);
          }

          return next;
        });
      } catch (error) {
        if (signal?.aborted) return;

        setDocument(null);
        setPageError(
          getApiError(error, "Failed to load SIV."),
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      companyId,
      navigate,
      routeBranchIdResolved,
      sivId,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadDocument(controller.signal);

    return () => controller.abort();
  }, [loadDocument]);

  const recommendationByLine = useMemo(
    () =>
      new Map(
        (recommendation?.lines ?? []).map((line) => [
          line.sivLineId,
          line,
        ]),
      ),
    [recommendation],
  );

  const getApprovedQty = useCallback(
    (lineId: string, requestedQty: number): number =>
      parseApprovedQty(
        approvedQtys[lineId],
        requestedQty,
      ),
    [approvedQtys],
  );

  const totals = useMemo(() => {
    const lines = document?.lines ?? [];

    return lines.reduce(
      (accumulator, line) => {
        const approvedQty = getApprovedQty(
          line.id,
          line.qty,
        );

        accumulator.requested += line.qty;

        if (Number.isFinite(approvedQty)) {
          accumulator.approved += approvedQty;

          if (approvedQty < line.qty) {
            accumulator.partialCount += 1;
          }
        }

        return accumulator;
      },
      {
        requested: 0,
        approved: 0,
        partialCount: 0,
      },
    );
  }, [document?.lines, getApprovedQty]);

  const linesAboveRecommendation = useMemo(() => {
    if (!document || !recommendation) return [];

    return document.lines.filter((line) => {
      const lineRecommendation =
        recommendationByLine.get(line.id);

      if (!lineRecommendation) return false;

      const approvedQty = getApprovedQty(
        line.id,
        line.qty,
      );

      return (
        Number.isFinite(approvedQty) &&
        approvedQty > lineRecommendation.recommendedQty
      );
    });
  }, [
    document,
    getApprovedQty,
    recommendation,
    recommendationByLine,
  ]);

  const validateApprovedQuantities = useCallback(() => {
    const nextErrors: Record<string, string> = {};

    for (const line of document?.lines ?? []) {
      const approvedQty = getApprovedQty(
        line.id,
        line.qty,
      );

      if (!Number.isFinite(approvedQty)) {
        nextErrors[line.id] = "Enter a valid quantity.";
      } else if (approvedQty < 0) {
        nextErrors[line.id] = "Quantity cannot be negative.";
      } else if (approvedQty > line.qty) {
        nextErrors[line.id] =
          `Maximum allowed: ${fmtQty(line.qty)}.`;
      }
    }

    setLineErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }, [document?.lines, getApprovedQty]);

  const applyRecommendations = useCallback(
    (lines: SivApprovalLineInput[]) => {
      setApprovedQtys((current) => ({
        ...current,
        ...Object.fromEntries(
          lines.map((line) => [
            line.lineId,
            String(line.approvedQty),
          ]),
        ),
      }));

      setLineErrors((current) => {
        const next = { ...current };

        for (const line of lines) {
          delete next[line.lineId];
        }

        return next;
      });
    },
    [],
  );

  const applyLineRecommendation = useCallback(
    (line: SivLineRecommendation) => {
      applyRecommendations([
        {
          lineId: line.sivLineId,
          approvedQty: line.recommendedQty,
        },
      ]);
    },
    [applyRecommendations],
  );

  const runAction = useCallback(
    async (
      successText: string,
      action: () => Promise<void>,
    ) => {
      if (actionBusy) return;

      setActionBusy(true);
      clearMessages();

      try {
        await action();
        setSuccessMessage(successText);
      } catch (error) {
        setPageError(
          getApiError(error, `${successText} failed.`),
        );
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, clearMessages],
  );

  const handleApprove = useCallback(() => {
    if (!document) return;

    if (document.lines.length === 0) {
      setPageError(
        "Cannot approve an SIV with no line items.",
      );
      return;
    }

    if (!validateApprovedQuantities()) return;

    if (
      linesAboveRecommendation.length > 0 &&
      !overrideReason.trim()
    ) {
      setPageError(
        "An override reason is required because one or more approved quantities exceed the latest recommendation.",
      );
      return;
    }

    const lines: ApproveSivLineRequest[] =
      document.lines.map((line) => ({
        lineId: line.id,
        approvedQty: getApprovedQty(
          line.id,
          line.qty,
        ),
      }));

    void runAction(
      "SIV approved successfully.",
      async () => {
        await sivApi.approve(companyId, sivId, {
          rowVersion: document.rowVersion ?? null,
          lines,
          overrideReason:
            overrideReason.trim() || null,
          recommendationEvaluatedAtUtc:
            recommendation?.evaluatedAtUtc ?? null,
        });

        navigate(
          sivDetailsPath(companyId, sivId),
          { replace: true },
        );
      },
    );
  }, [
    companyId,
    document,
    getApprovedQty,
    linesAboveRecommendation.length,
    navigate,
    overrideReason,
    recommendation?.evaluatedAtUtc,
    runAction,
    sivId,
    validateApprovedQuantities,
  ]);

  const handleReject = useCallback(() => {
    if (!document) return;

    const remarks = rejectReason.trim();

    if (!remarks) {
      setPageError("Rejection reason is required.");
      return;
    }

    void runAction(
      "SIV rejected successfully.",
      async () => {
        await sivApi.reject(companyId, sivId, {
          rowVersion: document.rowVersion ?? null,
          remarks,
        });

        navigate(
          sivDetailsPath(companyId, sivId),
          { replace: true },
        );
      },
    );
  }, [
    companyId,
    document,
    navigate,
    rejectReason,
    runAction,
    sivId,
  ]);

  const handleRequestChanges = useCallback(() => {
    if (!document) return;

    const remarks = changeRequestReason.trim();

    if (!remarks) {
      setPageError(
        "Feedback is required before requesting changes.",
      );
      return;
    }

    if (!effectiveBranchId) {
      setPageError(
        "Branch context is required to return this SIV to draft editing.",
      );
      return;
    }

    void runAction(
      "Change request sent successfully.",
      async () => {
        await sivApi.requestChanges(
          companyId,
          sivId,
          {
            rowVersion:
              document.rowVersion ?? null,
            remarks,
          },
        );

        navigate(
          sivDraftPath(
            companyId,
            effectiveBranchId,
            sivId,
          ),
          { replace: true },
        );
      },
    );
  }, [
    changeRequestReason,
    companyId,
    document,
    effectiveBranchId,
    navigate,
    runAction,
    sivId,
  ]);

  const closeDialog = useCallback(() => {
    setDialogMode(null);
    setRejectReason("");
    setChangeRequestReason("");
    setPageError("");
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div
          className="siv-approval-loading"
          aria-busy="true"
        >
          {tx("Loading SIV approval workspace...")}
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="page">
        <div
          className="alert alert-danger"
          role="alert"
        >
          {pageError || tx("SIV could not be loaded.")}
        </div>
      </div>
    );
  }

  if (!sivId) {
    return (
      <div className="page">
        <div className="alert alert-danger" role="alert">
          Missing SIV route identifier. Open this page through the canonical
          approval route: /siv/approval/:sivId.
        </div>
      </div>
    );
  }

  const status = normalizeStatus(
    document.docStatus,
  );

  return (
    <div className="page siv-approval-page">
      <SivWorkflowBar status={status} />

      <header className="siv-approval-page-header">
        <div>
          <div className="page-kicker">
            {tx("Inventory - SIV - F&B Controller Approval")}
          </div>

          <div className="page-title siv-approval-document-number">
            {document.number || tx("Pending SIV number")}
          </div>

          <div className="page-sub">
            {tx("Review the request, inspect inventory evidence, and record a controlled approval decision.")}
          </div>
        </div>

        <div className="siv-approval-header-actions">
          <span className={STATUS_BADGE[status]}>
            {tx(status)}
          </span>

          <button
            type="button"
            className="btn btn-success"
            disabled={
              actionBusy ||
              document.lines.length === 0
            }
            onClick={handleApprove}
          >
            {actionBusy ? tx("Working...") : tx("Approve")}
          </button>

          <button
            type="button"
            className="btn"
            disabled={actionBusy}
            onClick={() =>
              setDialogMode("requestChanges")
            }
          >
             {tx("Request Changes")}
          </button>

          <button
            type="button"
            className="btn btn-danger"
            disabled={actionBusy}
            onClick={() => setDialogMode("reject")}
          >
             {tx("Reject")}
          </button>

          <button
            type="button"
            className="btn"
            disabled={actionBusy}
            onClick={() => navigate(-1)}
          >
            {tx("Back")}
          </button>
        </div>
      </header>

      {pageError && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {pageError}
        </div>
      )}

      {successMessage && (
        <div
          className="alert alert-success"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {totals.partialCount > 0 && (
        <div className="alert alert-warn siv-approval-summary-alert">
          <strong>
            {totals.partialCount} {tx(totals.partialCount === 1 ? "line" : "lines")} {tx("will be partially approved.")}
          </strong>

          <span>
            {tx("Total approved")}: {fmtQty(totals.approved)} {tx("of")} {fmtQty(totals.requested)} {tx("requested")}.
          </span>
        </div>
      )}

      <div className="siv-approval-workspace">
        <main className="siv-approval-main">
          <section className="card siv-approval-summary-card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  {tx("Document Summary")}
                </div>

                <div className="card-subtitle">
                  {tx("Request context and destination details")}
                </div>
              </div>
            </div>

            <div className="card-body siv-document-summary-grid">
              {[
                {
                  label: tx("Issue Date"),
                  value: fmtDate(document.issueDate),
                },
                {
                  label: tx("From Location"),
                  value:
                    document.fromLocationName || "-",
                },
                {
                  label: tx("To Location"),
                  value:
                    document.toLocationName || "-",
                },
                {
                  label: tx("Department"),
                  value:
                    document.departmentName || "-",
                },
                {
                  label: tx("Remarks"),
                  value: document.remarks || "-",
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="siv-summary-field"
                >
                  <div className="siv-summary-label">
                    {label}
                  </div>

                  <div className="siv-summary-value">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card siv-lines-card">
            <div className="card-header siv-lines-card-header">
              <div>
                <div className="card-title">
                  {tx("Line Items - Set Approved Quantities")}
                </div>

                <div className="card-subtitle">
                  Recommendations are advisory. The controller
                  remains accountable for the final decision.
                </div>
              </div>

              <div className="siv-line-summary-badges">
                <span className="badge badge-neutral">
                  {document.lines.length} {tx("lines")}
                </span>

                <span className="badge badge-neutral">
                  {tx("Requested")}: {fmtQty(totals.requested)}
                </span>

                <span
                  className={
                    totals.partialCount > 0
                      ? "badge badge-warn"
                      : "badge badge-neutral"
                  }
                >
                  {tx("Approved")}: {fmtQty(totals.approved)}
                </span>
              </div>
            </div>

            {document.lines.length === 0 ? (
              <div className="siv-empty-lines">
                {tx("No lines are available on this voucher.")}
              </div>
            ) : (
              <div className="siv-table-scroll">
                <table className="table siv-approval-table">
                  <thead>
                    <tr>
                      <th style={{ width: 42 }}>#</th>
                      <th>{tx("Item")}</th>
                      <th>{tx("UOM")}</th>
                      <th className="siv-number-cell">
                        Requested
                      </th>
                      <th className="siv-number-cell">
                        Recommended
                      </th>
                      <th
                        className="siv-number-cell"
                        style={{ width: 155 }}
                      >
                        {tx("Approved Qty")}
                      </th>
                      <th>{tx("Stock Guidance")}</th>
                      <th>{tx("Batch")}</th>
                      <th>{tx("Expiry")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {document.lines.map(
                      (line, index) => {
                        const currentValue =
                          approvedQtys[line.id] ??
                          String(line.qty);

                        const currentNumber =
                          Number(currentValue);

                        const partial =
                          Number.isFinite(currentNumber) &&
                          currentNumber < line.qty;

                        const lineRecommendation =
                          recommendationByLine.get(
                            line.id,
                          );

                        const aboveRecommendation =
                          Boolean(lineRecommendation) &&
                          Number.isFinite(currentNumber) &&
                          currentNumber >
                            lineRecommendation!.recommendedQty;

                        const expired = isExpiredDate(
                          line.expiryDate,
                        );

                        return (
                          <tr
                            key={line.id}
                            className={[
                              partial
                                ? "is-partial"
                                : "",
                              aboveRecommendation
                                ? "is-above-recommendation"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <td className="siv-line-number">
                              {String(
                                line.lineNo ||
                                  index + 1,
                              ).padStart(2, "0")}
                            </td>

                            <td>
                              <div className="siv-item-link">
                                {line.itemName || "-"}
                              </div>

                              <div className="siv-item-code">
                                {line.itemCode || "-"}
                              </div>
                            </td>

                            <td className="siv-mono-cell">
                              {line.uomCode || "-"}
                            </td>

                            <td className="siv-number-cell">
                              {fmtQty(line.qty)}
                            </td>

                            <td className="siv-number-cell">
                              {lineRecommendation ? (
                                <button
                                  type="button"
                                  className="siv-recommended-qty-button"
                                  title={tx("Apply this recommended quantity")}
                                  onClick={() =>
                                    applyLineRecommendation(
                                      lineRecommendation,
                                    )
                                  }
                                >
                                  {fmtQty(
                                    lineRecommendation.recommendedQty,
                                  )}
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>

                            <td className="siv-approval-qty-cell">
                              <input
                                type="number"
                                min={0}
                                max={line.qty}
                                step="0.001"
                                className="input"
                                value={currentValue}
                                disabled={actionBusy}
                                onChange={(event) => {
                                  const value =
                                    event.target.value;

                                  setApprovedQtys(
                                    (current) => ({
                                      ...current,
                                      [line.id]: value,
                                    }),
                                  );

                                  setLineErrors(
                                    (current) => {
                                      const next = {
                                        ...current,
                                      };

                                      delete next[line.id];
                                      return next;
                                    },
                                  );
                                }}
                                aria-label={`Approved quantity for ${
                                  line.itemName ||
                                  `line ${line.lineNo}`
                                }`}
                              />

                              {lineErrors[line.id] && (
                                <div className="siv-field-error">
                                  {lineErrors[line.id]}
                                </div>
                              )}

                              {aboveRecommendation && (
                                <div className="siv-field-warning">
                                  {tx("Above recommendation")}
                                </div>
                              )}
                            </td>

                            <td>
                              {lineRecommendation ? (
                                <span
                                  className="siv-risk-button"
                                  data-risk={
                                    lineRecommendation.riskLevel
                                  }
                                  title={[
                                    `Decision: ${guidanceLabel(
                                      lineRecommendation,
                                    )}`,
                                    `Risk score: ${lineRecommendation.riskScore}/100`,
                                    `Destination now: ${fmtQty(
                                      lineRecommendation.availableBaseQty,
                                    )} base`,
                                    `After recommendation: ${fmtQty(
                                      lineRecommendation.projectedAvailableBaseQty,
                                    )} base`,
                                    `Cover: ${formatCoverWeeks(
                                      lineRecommendation.weeksOfSupplyAfter,
                                    )}`,
                                  ].join("\n")}
                                >
                                  <strong>
                                    {guidanceLabel(
                                      lineRecommendation,
                                    )}
                                  </strong>

                                  <span>
                                    {formatCoverWeeks(
                                      lineRecommendation.weeksOfSupplyAfter,
                                    )}
                                  </span>

                                  <small>
                                    {
                                      lineRecommendation.riskLevel
                                    }{" "}
                                    {
                                      lineRecommendation.riskScore
                                    }
                                    /100
                                  </small>
                                </span>
                              ) : (
                                <span className="siv-muted">
                                  {tx("Unavailable")}
                                </span>
                              )}
                            </td>

                            <td>
                              {line.batchNo || "-"}
                            </td>

                            <td
                              className={
                                expired
                                  ? "siv-expired"
                                  : undefined
                              }
                            >
                              {line.expiryDate
                                ? fmtDate(
                                    line.expiryDate,
                                  )
                                : "-"}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td colSpan={3}>{tx("Totals")}</td>

                      <td className="siv-number-cell">
                        {fmtQty(totals.requested)}
                      </td>

                      <td />

                      <td className="siv-number-cell">
                        {fmtQty(totals.approved)}
                      </td>

                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {linesAboveRecommendation.length > 0 && (
            <section className="card siv-override-card">
              <div className="card-header">
                <div>
                  <div className="card-title">
                    {tx("Recommendation Override")}
                  </div>

                  <div className="card-subtitle">
                    {tx("Required because")} {linesAboveRecommendation.length} {tx(linesAboveRecommendation.length === 1 ? "approval" : "approvals")} {tx("exceed the latest recommendation.")}
                  </div>
                </div>
              </div>

              <div className="card-body">
                <label className="field">
                  <span className="field-label">
                    {tx("Override reason")}
                    <span className="siv-required">
                      *
                    </span>
                  </span>

                  <textarea
                    className="input"
                    value={overrideReason}
                    disabled={actionBusy}
                    onChange={(event) =>
                      setOverrideReason(
                        event.target.value,
                      )
                    }
                    placeholder={tx("Explain why the business should approve more than the recommendation.")}
                    rows={4}
                  />
                </label>
              </div>
            </section>
          )}
        </main>

        <aside className="siv-copilot-panel">
          {effectiveBranchId ? (
            <SivRecommendationCard
              companyId={companyId}
              branchId={effectiveBranchId}
              sivId={sivId}
              onApplyRecommendations={
                applyRecommendations
              }
              onRecommendationChange={
                setRecommendation
              }
            />
          ) : (
            <div
              className="alert alert-danger"
              role="alert"
            >
              A branch is required to load inventory
              recommendations.
            </div>
          )}
        </aside>
      </div>

      {dialogMode === "reject" && (
        <div className="siv-modal-backdrop">
          <div
            className="siv-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-siv-title"
          >
            <div
              id="reject-siv-title"
              className="siv-modal-title"
            >
              {tx("Reject SIV")}
            </div>

            <div className="siv-modal-copy">
              Provide a reason. It will be visible to the
              requester.
            </div>

            <label className="field siv-modal-field">
              <span className="field-label">
                {tx("Rejection reason")}
                <span className="siv-required">*</span>
              </span>

              <textarea
                className="input"
                value={rejectReason}
                disabled={actionBusy}
                onChange={(event) =>
                  setRejectReason(event.target.value)
                }
                placeholder={tx("Required")}
                rows={4}
                autoFocus
              />
            </label>

            <div className="siv-modal-actions">
              <button
                type="button"
                className="btn"
                disabled={actionBusy}
                onClick={closeDialog}
              >
                {tx("Cancel")}
              </button>

              <button
                type="button"
                className="btn btn-danger"
                disabled={
                  actionBusy ||
                  !rejectReason.trim()
                }
                onClick={handleReject}
              >
                {actionBusy
                  ? tx("Rejecting...")
                  : tx("Confirm Reject")}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogMode === "requestChanges" && (
        <div className="siv-modal-backdrop">
          <div
            className="siv-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-changes-title"
          >
            <div
              id="request-changes-title"
              className="siv-modal-title"
            >
              {tx("Request Changes")}
            </div>

            <div className="siv-modal-copy">
              {tx("The SIV will return to the requester for amendment.")}
            </div>

            <label className="field siv-modal-field">
              <span className="field-label">
                {tx("Feedback for requester")}
                <span className="siv-required">*</span>
              </span>

              <textarea
                className="input"
                value={changeRequestReason}
                disabled={actionBusy}
                onChange={(event) =>
                  setChangeRequestReason(
                    event.target.value,
                  )
                }
                placeholder={tx("Describe what needs to change")}
                rows={4}
                autoFocus
              />
            </label>

            <div className="siv-modal-actions">
              <button
                type="button"
                className="btn"
                disabled={actionBusy}
                onClick={closeDialog}
              >
                {tx("Cancel")}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  actionBusy ||
                  !changeRequestReason.trim()
                }
                onClick={handleRequestChanges}
              >
                {actionBusy
                  ? tx("Sending...")
                  : tx("Send Request")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
