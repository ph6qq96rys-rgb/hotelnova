// src/features/hr/pages/RecruitmentPage.tsx

import { useCallback, useEffect, useState } from "react";

import { useAppScope } from "../../../app/useAppScope";
import { useErpNavigate } from "../../../routes/useErpNavigation";
import { recruitmentApi } from "../api/hrApi";
import type { JobPostingDto, RecruitmentPipelineDto } from "../types/index";
import { JOB_STATUS_CLASS, fmtDate, getApiError } from "../utils/hrUtils";

const PIPELINE_STAGES = [
  "New",
  "Screening",
  "Shortlisted",
  "Interview",
  "Offered",
  "Hired",
  "Rejected",
] as const;

export default function RecruitmentPage() {
  const erpNav = useErpNavigate();
  const { companyId } = useAppScope();

  const [postings, setPostings] = useState<JobPostingDto[]>([]);
  const [pipeline, setPipeline] = useState<RecruitmentPipelineDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setPostings([]);
      setPipeline(null);
      setError("Missing company context. Please select a company first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setPostings(await recruitmentApi.listPostings(companyId));
    } catch (e) {
      setError(getApiError(e, "Failed to load postings."));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadPipeline(id: string) {
    if (!companyId) return;

    setSelectedId(id);

    try {
      setPipeline(await recruitmentApi.getPipeline(companyId, id));
    } catch {
      setPipeline(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources</div>
          <div className="page-title">Recruitment</div>
          <div className="page-sub">Job postings and applicant tracking</div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => erpNav("hr/recruitment/new")}
          disabled={!companyId}
        >
          + New Posting
        </button>
      </div>

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 20 }}
      >
        <div className="kpi">
          <div className="kpi-label">Published</div>
          <div className="kpi-val">
            {postings.filter((p) => p.status === "Published").length}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Total Vacancies</div>
          <div className="kpi-val">
            {postings.reduce((s, p) => s + p.vacancyCount, 0)}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Applications</div>
          <div className="kpi-val">
            {postings.reduce((s, p) => s + p.applicationCount, 0)}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Closing Soon</div>
          <div className="kpi-val">
            {postings.filter((p) => {
              const days = (new Date(p.closingDate).getTime() - Date.now()) / 86_400_000;
              return days <= 7 && days >= 0;
            }).length}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {pipeline && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Pipeline View
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PIPELINE_STAGES.map((stage) => (
              <div
                key={stage}
                style={{
                  flex: "1 1 120px",
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  textAlign: "center",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>
                  {stage}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
                  {pipeline[stage as keyof RecruitmentPipelineDto] as number}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Posting #</th>
              <th>Title</th>
              <th>Department</th>
              <th>Type</th>
              <th style={{ textAlign: "right" }}>Vacancies</th>
              <th style={{ textAlign: "right" }}>Applications</th>
              <th>Closing Date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                  Loading…
                </td>
              </tr>
            ) : postings.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                  No job postings found.
                </td>
              </tr>
            ) : (
              postings.map((p) => (
                <tr
                  key={p.id}
                  style={{ cursor: "pointer", background: selectedId === p.id ? "var(--surface-2)" : undefined }}
                  onClick={() => loadPipeline(p.id)}
                >
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)" }}>
                    {p.postingNo}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{p.title}</td>
                  <td style={{ fontSize: 13 }}>{p.departmentName}</td>
                  <td style={{ fontSize: 12 }}>{p.employmentType}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {p.vacancyCount}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 500 }}>
                    {p.applicationCount}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)" }}>
                    {fmtDate(p.closingDate)}
                  </td>
                  <td>
                    <span className={JOB_STATUS_CLASS[p.status]}>{p.status}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        erpNav(`hr/recruitment/${p.id}`);
                      }}
                    >
                      Open →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
