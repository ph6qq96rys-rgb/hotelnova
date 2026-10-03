import { useCallback, useEffect, useMemo, useState } from "react";
import { getSivApprovalCopilot } from "../api/sivRecommendationApi";
import { useI18n } from "../../../../i18n";
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
  const normalizeResult = (
    result: SivRecommendationResult,
  ): SivRecommendationResult => ({
    ...result,
    riskLevel: result.riskLevel ?? (result as any).risk,
    warnings: result.warnings ?? [],
    lines: (result.lines ?? []).map((line) => {
      const raw = line as any;
      const toBaseFactor = positiveNumber(raw.toBaseFactor, 1);

      return {
        ...line,
        riskLevel: line.riskLevel ?? raw.risk,
        reasons: line.reasons ?? [],
        warnings: line.warnings ?? [],
        onHandQty: coalesceNumber(
          line.onHandQty,
          convertBaseQty(raw.onHandBaseQty, toBaseFactor),
        ),
        reservedQty: coalesceNumber(
          line.reservedQty,
          convertBaseQty(raw.reservedBaseQty, toBaseFactor),
        ),
        availableQty: coalesceNumber(
          line.availableQty,
          convertBaseQty(raw.availableBaseQty, toBaseFactor),
        ),
        projectedQtyAfterApproval: coalesceNumber(
          line.projectedQtyAfterApproval,
          convertBaseQty(raw.projectedAvailableBaseQty, toBaseFactor),
        ),
        weeklyAverageUsage: coalesceNumber(
          line.weeklyAverageUsage,
          convertBaseQty(raw.averageWeeklyUsageBaseQty, toBaseFactor),
        ),
        weeksOfSupplyAfterApproval: coalesceNumber(
          line.weeksOfSupplyAfterApproval,
          raw.weeksOfSupplyAfter,
        ),
      };
    }),
  });

  if ("recommendation" in value && value.recommendation) {
    return normalizeResult(value.recommendation);
  }

  const direct = value as unknown as SivRecommendationResult;
  return Array.isArray(direct.lines) ? normalizeResult(direct) : null;
}

function coalesceNumber(
  value: number | null | undefined,
  fallback: unknown,
): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return toFiniteNumber(fallback);
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = toFiniteNumber(value);
  return parsed && parsed > 0 ? parsed : fallback;
}

function convertBaseQty(
  value: unknown,
  toBaseFactor: number,
): number | undefined {
  const parsed = toFiniteNumber(value);
  if (parsed == null) return undefined;
  return parsed / toBaseFactor;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function SivRecommendationCard({
  companyId,
  branchId,
  sivId,
  onApplyRecommendations,
  onRecommendationChange,
}: SivRecommendationCardProps) {
  const { tx } = useI18n();
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
        setError(tx("Company, branch, and SIV scope are required."));
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
            : tx("Unable to load approval recommendation."),
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
          <div className="siv-copilot-eyebrow">{tx("Inventory Copilot")}</div>
          <h2>{tx("Approval Recommendation")}</h2>
        </div>

        <button
          type="button"
          className="btn"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? tx("Refreshing...") : tx("Refresh")}
        </button>
      </div>

      {error && !recommendation && (
        <div className="alert alert-danger">
          {error}
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => void load()}>
              {tx("Retry")}
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
          {tx("No recommendation was returned for this SIV.")}
        </div>
      )}

      {recommendation && (
        <>
          <section className="siv-overall-recommendation">
            <div
              className="siv-decision-pill"
              data-decision={recommendation.decision}
            >
              {tx(decisionLabel(recommendation.decision))}
            </div>

            <div className="siv-risk-score">
              <span>{tx("Risk")}</span>
              <strong>{recommendation.riskScore}/100</strong>
              <small>{tx(recommendation.riskLevel)}</small>
            </div>

            <p>{recommendation.summary}</p>

            <div className="siv-confidence-row">
              <span>{tx("Evaluated")}</span>
              <strong>
                {formatRecommendationDate(recommendation.evaluatedAtUtc)}
              </strong>
            </div>
          </section>

          {explanation && (
            <section className="siv-ai-explanation">
              <div className="siv-section-heading">
                <span>{tx("AI explanation")}</span>
                <span
                  className={
                    explanation.isAiGenerated
                      ? "badge badge-success"
                      : "badge badge-neutral"
                  }
                >
                  {explanation.isAiGenerated ? tx("AI") : tx("Rules")}
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
              <strong>{tx("Request warnings")}</strong>
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
            {tx("Apply all recommended quantities")}
          </button>

          <section className="siv-line-picker">
            <div className="siv-section-heading">
              <span>{tx("Line analysis")}</span>
              <span>{recommendation.lines.length} {tx("lines")}</span>
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
                    {tx("Line")} {selectedLine.lineNo} - {selectedLine.uomCode}
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
                  <span>{tx("Requested")}</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.requestedQty)}
                  </strong>
                </div>

                <div className="recommended">
                  <span>{tx("Recommended")}</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.recommendedQty)}
                  </strong>
                </div>
              </div>

              <div className="siv-metric-grid">
                <div>
                  <span>{tx("On hand")}</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.onHandQty)}
                  </strong>
                </div>
                <div>
                  <span>{tx("Reserved")}</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.reservedQty)}
                  </strong>
                </div>
                <div>
                  <span>{tx("Available")}</span>
                  <strong>
                    {formatRecommendationNumber(selectedLine.availableQty)}
                  </strong>
                </div>
                <div>
                  <span>{tx("After approval")}</span>
                  <strong>
                    {formatRecommendationNumber(
                      selectedLine.projectedQtyAfterApproval,
                    )}
                  </strong>
                </div>
                <div>
                  <span>{tx("Weekly usage")}</span>
                  <strong>
                    {formatRecommendationNumber(
                      selectedLine.weeklyAverageUsage,
                    )}
                  </strong>
                </div>
                <div>
                  <span>{tx("Weeks after")}</span>
                  <strong>
                    {formatRecommendationNumber(
                      selectedLine.weeksOfSupplyAfterApproval,
                    )}
                  </strong>
                </div>
              </div>

              <div className="siv-recommendation-integrity">
                <span>{tx("Inventory integrity")}</span>
                <strong data-balanced={selectedLine.inventoryIsBalanced}>
                  {selectedLine.inventoryIsBalanced
                    ? tx("Reconciled")
                    : tx("Not reconciled")}
                </strong>
              </div>

              {selectedLine.reasons.length > 0 && (
                <div className="siv-reason-block">
                  <h4>{tx("Why")}</h4>
                  <ul>
                    {selectedLine.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedLine.warnings.length > 0 && (
                <div className="siv-warning-block">
                  <h4>{tx("Warnings")}</h4>
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
                {tx("Apply")} {formatRecommendationNumber(selectedLine.recommendedQty)}{" "}
                {selectedLine.uomCode}
              </button>
            </section>
          )}

          {explanation?.suggestedActions &&
            explanation.suggestedActions.length > 0 && (
              <section className="siv-suggested-actions">
                <div className="siv-section-heading">{tx("Suggested actions")}</div>
                <ol>
                  {explanation.suggestedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </section>
            )}

          {error && (
            <div className="alert alert-warn">
              {tx("The last refresh failed. Displayed evidence may be stale.")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
