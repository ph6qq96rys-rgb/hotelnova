import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { sivApi } from "../api/sivApi";
import SivWorkflowShell from "../components/SivWorkflowShell";
import SivWorkflowActionBar from "../components/SivWorkflowActionBar";
import {
  normalizeSivStatus,
  prettySivStatus,
  resolveSivRoute,
} from "../utils/sivWorkflow";
import { promptRequired } from "../utils/sivActionPrompts";

type SivLineDto = {
  id?: string;
  itemName?: string | null;
  quantity?: number | null;
  qty?: number | null;
  uomName?: string | null;
  uomCode?: string | null;
  batchNo?: string | null;
};

type SivDetailsDto = {
  id: string;
  number?: string | null;
  issueDate?: string | null;
  docStatus?: string | number | null;
  remarks?: string | null;
  notes?: string | null;
  fromLocationName?: string | null;
  departmentName?: string | null;
  rowVersion?: string | null;
  lines?: SivLineDto[] | null;
};

function toIsoDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function getLineQty(line: SivLineDto): number {
  return Number(line.quantity ?? line.qty ?? 0);
}

export default function SivApprovalPage() {
  const navigate = useNavigate();
  const { companyId: scopedCompanyId } = useAppScope();
  const { companyId: routeCompanyId, sivId = "" } = useParams<{
    companyId?: string;
    sivId?: string;
  }>();

  const companyId = routeCompanyId || scopedCompanyId || "";

  const [data, setData] = useState<SivDetailsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !sivId) return;

    setLoading(true);
    setError(null);

    try {
      const result = (await sivApi.getById(companyId, sivId)) as SivDetailsDto;
      const status = normalizeSivStatus(result?.docStatus);

      if (status !== "submitted") {
        navigate(resolveSivRoute(companyId, sivId, result?.docStatus), { replace: true });
        return;
      }

      setData(result);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Failed to load SIV.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, sivId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove() {
    if (!companyId || !sivId || !data) return;
    setBusy(true);
    setError(null);

    try {
      await sivApi.approve(companyId, sivId, {
        companyId,
        rowVersion: data.rowVersion ?? undefined,
        remarks: data.remarks ?? undefined,
      } as any);

      await load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Failed to approve SIV.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestChanges() {
    if (!companyId || !sivId || !data) return;

    const remarks = promptRequired("Enter remarks for requesting changes:");
    if (remarks === null) return;

    setBusy(true);
    setError(null);

    try {
      await sivApi.requestChanges(companyId, sivId, {
        companyId,
        rowVersion: data.rowVersion ?? undefined,
        remarks,
      } as any);

      await load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Failed to request changes.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!companyId || !sivId || !data) return;

    const remarks = promptRequired("Enter remarks for rejection:");
    if (remarks === null) return;

    setBusy(true);
    setError(null);

    try {
      await sivApi.reject(companyId, sivId, {
        companyId,
        rowVersion: data.rowVersion ?? undefined,
        remarks,
      } as any);

      await load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Failed to reject SIV.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SivWorkflowShell
      title={data?.number || "SIV Approval"}
      subtitle="Review submitted SIV and perform approval workflow actions."
      badge={prettySivStatus(data?.docStatus)}
      actions={
        <SivWorkflowActionBar
          status={data?.docStatus}
          busy={busy}
          onApprove={() => void handleApprove()}
          onRequestChanges={() => void handleRequestChanges()}
          onReject={() => void handleReject()}
          onRefresh={() => void load()}
        />
      }
    >
      <section className="lux-card">
        {error ? (
          <div style={{ color: "#fecaca" }}>{error}</div>
        ) : loading ? (
          <div>Loading...</div>
        ) : !data ? (
          <div>No SIV found.</div>
        ) : (
          <div className="lux-grid-2">
            <div className="lux-field">
              <div className="lux-label">Issue Date</div>
              <div className="lux-value">{toIsoDate(data.issueDate) || "—"}</div>
            </div>

            <div className="lux-field">
              <div className="lux-label">From Location</div>
              <div className="lux-value">{data.fromLocationName || "—"}</div>
            </div>

            <div className="lux-field">
              <div className="lux-label">Department</div>
              <div className="lux-value">{data.departmentName || "—"}</div>
            </div>

            <div className="lux-field">
              <div className="lux-label">Remarks</div>
              <div className="lux-value">{data.remarks || data.notes || "—"}</div>
            </div>
          </div>
        )}
      </section>

      <section className="lux-card">
        <h3 className="lux-section-title">Lines</h3>

        {!data?.lines?.length ? (
          <div>No lines.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {data.lines.map((line, idx) => (
              <div
                key={line.id || idx}
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.16)",
                  borderRadius: 16,
                  padding: 14,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div><strong>{line.itemName || "Unknown item"}</strong></div>
                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  Qty: {getLineQty(line)} {line.uomName || line.uomCode || ""}
                </div>
                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  Batch: {line.batchNo || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </SivWorkflowShell>
  );
}