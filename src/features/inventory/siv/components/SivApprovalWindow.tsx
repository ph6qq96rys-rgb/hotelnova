import { useMemo, useState } from "react";
import { SivRecommendationCard } from "./SivRecommendationCard";
import type { SivApprovalLineInput } from "../types/sivRecommendation";

interface ApprovalLine extends SivApprovalLineInput {
  itemName: string;
  requestedQty: number;
}

interface SivApprovalWindowProps {
  companyId: string;
  branchId: string;
  sivId: string;
  initialLines: ApprovalLine[];
}

export function SivApprovalWindow({
  companyId,
  branchId,
  sivId,
  initialLines,
}: SivApprovalWindowProps) {
  const [lines, setLines] = useState(initialLines);
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInvalidQuantity = useMemo(
    () =>
      lines.some(
        (line) =>
          !Number.isFinite(line.approvedQty) ||
          line.approvedQty < 0 ||
          line.approvedQty > line.requestedQty,
      ),
    [lines],
  );

  function updateApprovedQty(lineId: string, value: number) {
    setLines((current) =>
      current.map((line) =>
        line.lineId === lineId ? { ...line, approvedQty: value } : line,
      ),
    );
  }

  function applyRecommendations(recommendations: SivApprovalLineInput[]) {
    const approvedByLineId = new Map(
      recommendations.map(({ lineId, approvedQty }) => [lineId, approvedQty]),
    );

    setLines((current) =>
      current.map((line) => ({
        ...line,
        approvedQty: approvedByLineId.get(line.lineId) ?? line.approvedQty,
      })),
    );
  }

  async function approve() {
    if (hasInvalidQuantity || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}` +
          `/siv/${encodeURIComponent(sivId)}/approve`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: lines.map(({ lineId, approvedQty }) => ({
              lineId,
              approvedQty,
            })),
            overrideReason: overrideReason.trim() || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error((await response.text()) || "Unable to approve SIV.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to approve SIV.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="siv-approval-layout">
      <main>
        <h1>Approve SIV</h1>

        {error && <p role="alert">{error}</p>}

        {lines.map((line) => (
          <label key={line.lineId}>
            {line.itemName}
            <input
              type="number"
              min={0}
              max={line.requestedQty}
              step="0.0001"
              value={line.approvedQty}
              onChange={(event) =>
                updateApprovedQty(line.lineId, event.currentTarget.valueAsNumber)
              }
            />
          </label>
        ))}

        <label>
          Override reason
          <textarea
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.currentTarget.value)}
          />
        </label>

        <button
          type="button"
          disabled={submitting || hasInvalidQuantity}
          onClick={() => void approve()}
        >
          {submitting ? "Approving…" : "Approve SIV"}
        </button>
      </main>

      <SivRecommendationCard
        companyId={companyId}
        branchId={branchId}
        sivId={sivId}
        onApplyRecommendations={applyRecommendations}
      />
    </div>
  );
}
