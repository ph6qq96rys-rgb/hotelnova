import { useCallback, useEffect, useMemo, useState } from "react";
import { getSivApprovalCopilot } from "../api/sivRecommendationApi";
import type {
  SivApprovalCopilotResponse,
  SivApprovalLineInput,
  SivLineRecommendation,
  SivRecommendationResult,
} from "../types/sivRecommendation";
import {
  decisionLabel,
  formatRecommendationDate,
  formatRecommendationNumber,
} from "../types/sivRecommendation";

export interface SivRecommendationCardProps {
  companyId: string;
  branchId: string;
  sivId: string;
  onApplyRecommendations: (lines: SivApprovalLineInput[]) => void;
  onRecommendationChange?: (result: SivRecommendationResult | null) => void;
}

function normalizeRecommendation(
  value: SivApprovalCopilotResponse,
): SivRecommendationResult | null {
  if ("recommendation" in value && value.recommendation) {
    return value.recommendation;
  }

  const direct = value as unknown as SivRecommendationResult;
  return Array.isArray(direct.lines) ? direct : null;
}

export function SivRecommendationCard({
  companyId,
  branchId,
  sivId,
  onApplyRecommendations,
  onRecommendationChange,
}: SivRecommendationCardProps) {
  const [copilot, setCopilot] = useState<SivApprovalCopilotResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const recommendation = useMemo(
    () => (copilot ? normalizeRecommendation(copilot) : null),
    [copilot],
  );

  const explanation =
    copilot && "explanation" in copilot ? copilot.explanation : null;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId || !branchId || !sivId) {
        setCopilot(null);
        onRecommendationChange?.(null);
        setError("Company, branch, and SIV scope are required.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const value = await getSivApprovalCopilot({
          companyId,
          branchId,
          sivId,
          signal,
        });
        const nextRecommendation = normalizeRecommendation(value);

        setCopilot(value);
        onRecommendationChange?.(nextRecommendation);

        setSelectedLineId((current) => {
          if (
            current &&
            nextRecommendation?.lines.some((line) => line.sivLineId === current)
          ) {
            return current;
          }

          return nextRecommendation?.lines[0]?.sivLineId ?? null;
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load approval recommendation.",
        );
      } finally {
        setLoading(false);
      }
    },
    [branchId, companyId, onRecommendationChange, sivId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const recommendationLines = useMemo<SivApprovalLineInput[]>(
    () =>
      recommendation?.lines.map((line) => ({
        lineId: line.sivLineId,
        approvedQty: line.recommendedQty,
      })) ?? [],
    [recommendation],
  );

  const selectedLine =
    recommendation?.lines.find((line) => line.sivLineId === selectedLineId) ??
    recommendation?.lines[0] ??
    null;

  function applyLine(line: SivLineRecommendation) {
    onApplyRecommendations([
      {
        lineId: line.sivLineId,
        approvedQty: line.recommendedQty,
      },
    ]);
  }

  return (
    <div className="siv-copilot-card">
      <div className="siv-copilot-topbar">
        <div>
          <div className="siv-copilot-eyebrow">Inventory Copilot</div>
          <h2>Approval Recommendation</h2>
        </div>

        <button
          type="button"
          className="btn"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {error && !recommendation && (
        <div className="alert alert-danger">
          {error}
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => void load()}>
              Retry
            </button>
          </div>
        </div>
      )}

      {loading && !recommendation && (
        <div className="siv-copilot-loading" aria-busy="true">
          <div className="siv-copilot-skeleton" />
          <div className="siv-copilot-skeleton short" />
          <div className="siv-copilot-skeleton" />
        </div>
      )}

      {!loading && !error && !recommendation && (
        <div className="alert alert-warn">
          No recommendation was returned for this SIV.
        </div>
      )}

      {recommendation && (
        <>
          <section className="siv-overall-recommendation">
            <div
              className="siv-decision-pill"
              data-decision={recommendation.decision}
            >
              {decisionLabel(recommendation.decision)}
            </div>

            <div className="siv-risk-score">
              <span>Risk</span>
              <strong>{recommendation.riskScore}/100</strong>
              <small>{recommendation.riskLevel}</small>
            </div>

            <p>{recommendation.summary}</p>

            <div className="siv-confidence-row">
              <span>Evaluated</span>
              <strong>
                {formatRecommendationDate(recommendation.evaluatedAtUtc)}
              </strong>
            </div>
          </section>

          {explanation && (
            <section className="siv-ai-explanation">
              <div className="siv-section-heading">
                <span>AI explanation</span>
                <span
                  className={
                    explanation.isAiGenerated
                      ? "badge badge-success"
                      : "badge badge-neutral"
                  }
                >
                  {explanation.isAiGenerated ? "AI" : "Rules"}
                </span>
              </div>

              <h3>{explanation.headline}</h3>
              <p>{explanation.summary}</p>

              {explanation.keyReasons.length > 0 && (
                <ul>
                  {explanation.keyReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {recommendation.warnings.length > 0 && (
            <div className="alert alert-warn">
              <strong>Request warnings</strong>
              <ul>
                {recommendation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary siv-apply-all-button"
            onClick={() => onApplyRecommendations(recommendationLines)}
            disabled={recommendationLines.length === 0}
          >
            Apply all recommended quantities
          </button>

          <section className="siv-line-picker">
            <div className="siv-section-heading">
              <span>Line analysis</span>
              <span>{recommendation.lines.length} lines</span>
            </div>

            <div className="siv-line-tabs">
              {recommendation.lines.map((line) => (
                <button
                  key={line.sivLineId}
                  type="button"
                  className={
                    line.sivLineId === selectedLine?.sivLineId ? "active" : ""
                  }
                  onClick={() => setSelectedLineId(line.sivLineId)}
                >
                  <span>{line.lineNo}</span>
                  {line.itemName}
                </button>
              ))}
            </div>
          </section>

          {selectedLine && (
            <section className="siv-line-analysis-card">
              <div className="siv-line-analysis-header">
                <div>
                  <h3>{selectedLine.itemName}</h3>
                  <span>
                    Line {selectedLine.lineNo} · {selectedLine.uomCode}
                  </span>
                </div>

                <div
                  className="siv-mini-risk"
                  data-risk={selectedLine.riskLevel}
                >
                  {selectedLine.riskLevel}
                </div>
              </div>

              <div className="siv-key-quantity">
                <div>
                  <span>Requested</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.requestedQty)}
                  </strong>
                </div>

                <div className="recommended">
                  <span>Recommended</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.recommendedQty)}
                  </strong>
                </div>
              </div>

              <div className="siv-metric-grid">
                <div>
                  <span>On hand</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.onHandQty)}
                  </strong>
                </div>
                <div>
                  <span>Reserved</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.reservedQty)}
                  </strong>
                </div>
                <div>
                  <span>Available</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.availableQty)}
                  </strong>
                </div>
                <div>
                  <span>After approval</span>
                  <strong>
                    {formatRecommendationNumber(
                      selectedLine.projectedQtyAfterApproval,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Weekly usage</span>
                  <strong>
                    {formatRecommendationNumber(
                      selectedLine.weeklyAverageUsage,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Weeks after</span>
                  <strong>
                    {formatRecommendationNumber(
                      selectedLine.weeksOfSupplyAfterApproval,
                    )}
                  </strong>
                </div>
              </div>

              <div className="siv-recommendation-integrity">
                <span>Inventory integrity</span>
                <strong data-balanced={selectedLine.inventoryIsBalanced}>
                  {selectedLine.inventoryIsBalanced
                    ? "Reconciled"
                    : "Not reconciled"}
                </strong>
              </div>

              {selectedLine.reasons.length > 0 && (
                <div className="siv-reason-block">
                  <h4>Why</h4>
                  <ul>
                    {selectedLine.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedLine.warnings.length > 0 && (
                <div className="siv-warning-block">
                  <h4>Warnings</h4>
                  <ul>
                    {selectedLine.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="btn siv-apply-line-button"
                onClick={() => applyLine(selectedLine)}
              >
                Apply {formatRecommendationNumber(selectedLine.recommendedQty)}{" "}
                {selectedLine.uomCode}
              </button>
            </section>
          )}

          {explanation?.suggestedActions &&
            explanation.suggestedActions.length > 0 && (
              <section className="siv-suggested-actions">
                <div className="siv-section-heading">Suggested actions</div>
                <ol>
                  {explanation.suggestedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </section>
            )}

          {error && (
            <div className="alert alert-warn">
              The last refresh failed. Displayed evidence may be stale.
            </div>
          )}
        </>
      )}
    </div>
  );
}