// src/features/inventory/siv/pages/SivIssuedPrintPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { sivApi } from "../api/sivApi";
import { useI18n } from "../../../../i18n";
import { useAppScope } from "../../../../app/useAppScope";
import {
  mapToVm,
  normalizeStatus,
  fmtDate,
  fmtDateTime,
  fmtQty,
  fmt$,
  getApiError,
  type SivVm,
} from "../types/sivTypes";

export default function SivIssuedPrintPage() {
  const { tx } = useI18n();
  const { companyId = "", sivId = "", id = "" } = useParams();
  const { companyName, branchName } = useAppScope();
  const documentId = sivId || id;

  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [doc,     setDoc]     = useState<SivVm | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true); setErr("");
        const raw = await sivApi.getById(companyId, documentId);
        if (!active) return;
        const vm = mapToVm(raw);
        const status = normalizeStatus(vm.docStatus);

        if (status !== "Issued" && status !== "Posted") {
          setErr(tx("The SIV can only be printed after stock has been issued."));
          setDoc(null);
          return;
        }

        setDoc(vm);
        document.title = `${vm.number || tx("Stock Issue Voucher")} - ${companyName || tx("Company")}`;
      } catch (e) {
        if (active) setErr(getApiError(e, tx("Failed to load SIV.")));
      } finally {
        if (active) setLoading(false);
      }
    }
    if (companyId && documentId) void load();
    return () => { active = false; };
  }, [companyId, documentId, companyName, tx]);

  const totalQty = useMemo(
    () =>
      (doc?.lines ?? []).reduce(
        (sum, line) =>
          sum + (line.issuedQty > 0 ? line.issuedQty : line.approvedQty ?? 0),
        0,
      ),
    [doc],
  );

  const totalApprovedQty = useMemo(
    () => (doc?.lines ?? []).reduce((sum, line) => sum + (line.approvedQty ?? 0), 0),
    [doc],
  );

  const totalValue = useMemo(
    () => (doc?.lines ?? []).reduce((sum, line) => sum + (line.postedLineCost ?? 0), 0),
    [doc],
  );

  const printedAt = useMemo(
    () => fmtDateTime(new Date().toISOString()),
    [],
  );

  if (loading) {
    return <div style={{ padding: 32, fontFamily: "Arial", color: "#111" }}>
      {tx("Loading print page...")}
    </div>;
  }

  if (err || !doc) {
    return <div style={{ padding: 32, fontFamily: "Arial", color: "#b91c1c" }}>
      {err || tx("SIV not found.")}
    </div>;
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #fff;
          color: #111827;
          font-family: "Segoe UI", Arial, sans-serif;
          font-size: 13px;
          line-height: 1.5;
        }
        .pp { max-width: 960px; margin: 0 auto; padding: 24px 32px; }
        .no-print { display: flex; justify-content: flex-end; margin-bottom: 16px; }
        .print-btn {
          border: 1px solid #111827;
          background: #111827;
          color: #fff;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }
        .doc-header {
          border-bottom: 2px solid #111827;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .company-row {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          margin-bottom: 18px;
        }
        .company-name {
          font-size: 19px;
          font-weight: 800;
          letter-spacing: 0.01em;
        }
        .company-sub {
          margin-top: 2px;
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .print-meta {
          text-align: right;
          color: #374151;
          font-size: 11px;
        }
        .doc-header h1 {
          font-size: 21px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: center;
        }
        .doc-header .sub {
          font-size: 12px;
          color: #6b7280;
          margin-top: 3px;
          text-align: center;
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }
        .summary-card {
          border: 1px solid #d1d5db;
          padding: 10px 12px;
          min-height: 58px;
        }
        .summary-card .label {
          font-weight: 700;
          color: #374151;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .summary-card .value {
          margin-top: 4px;
          font-size: 16px;
          font-weight: 800;
        }
        .meta {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px 20px;
          margin-bottom: 16px;
          font-size: 12.5px;
        }
        .meta-item .label {
          font-weight: 700;
          color: #374151;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 2px;
        }
        .tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .tbl th {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          padding: 7px 9px;
          text-align: left;
          font-weight: 700;
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tbl td {
          border: 1px solid #d1d5db;
          padding: 7px 9px;
          vertical-align: top;
        }
        .tbl .num { text-align: right; }
        .tbl tfoot td {
          background: #f9fafb;
          font-weight: 700;
        }
        .sigs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
          margin-top: 44px;
        }
        .sig-box {
          border-top: 1px solid #111827;
          padding-top: 6px;
          text-align: center;
          font-size: 12px;
          color: #374151;
        }
        @media print {
          .no-print { display: none; }
          .pp { padding: 0; max-width: none; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="pp">
        <div className="no-print">
          <button className="print-btn" onClick={() => window.print()}>
            {tx("Print")}
          </button>
        </div>

        <div className="doc-header">
          <div className="company-row">
            <div>
              <div className="company-name">{companyName || tx("Company")}</div>
              <div className="company-sub">{branchName || doc.branchName || tx("Company workspace")}</div>
            </div>
            <div className="print-meta">
              <div>{tx("Printed")}</div>
              <strong>{printedAt}</strong>
            </div>
          </div>
          <h1>{tx("Stock Issue Voucher")}</h1>
          <div className="sub">{tx("Issued Inventory Document")}</div>
        </div>

        <div className="summary">
          <div className="summary-card">
            <div className="label">{tx("Issued Qty")}</div>
            <div className="value">{fmtQty(totalQty)}</div>
          </div>
          <div className="summary-card">
            <div className="label">{tx("Approved")}</div>
            <div className="value">{fmtQty(totalApprovedQty)}</div>
          </div>
          <div className="summary-card">
            <div className="label">{tx("Value")}</div>
            <div className="value">{totalValue > 0 ? fmt$(totalValue) : "-"}</div>
          </div>
        </div>

        <div className="meta">
          {[
            { label: tx("SIV No."),       value: doc.number || tx("Pending SIV number") },
            { label: tx("Status"),        value: doc.docStatus },
            { label: tx("Issue date"),    value: fmtDate(doc.issueDate) },
            { label: tx("Branch"),        value: doc.branchName || branchName || tx("Unassigned branch") },
            { label: tx("From Location"), value: doc.fromLocationName || "-" },
            { label: tx("To Location"),   value: doc.toLocationName || "-" },
            { label: tx("Department"),    value: doc.departmentName   || "-" },
            { label: tx("Approved"),      value: fmtDateTime(doc.audit.approvedAtUtc) },
            { label: tx("Posted"),        value: fmtDateTime(doc.audit.postedAtUtc) },
            { label: tx("Remarks"),       value: doc.remarks || doc.notes || "-" },
          ].map(({ label, value }) => (
            <div className="meta-item" key={label}>
              <div className="label">{label}</div>
              <div>{value || "-"}</div>
            </div>
          ))}
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>{tx("Item")}</th>
              <th style={{ width: 80 }}>{tx("UOM")}</th>
              <th style={{ width: 85 }} className="num">{tx("Requested")}</th>
              <th style={{ width: 85 }} className="num">{tx("Approved")}</th>
              <th style={{ width: 90 }} className="num">{tx("Issued Qty")}</th>
              <th style={{ width: 95 }} className="num">{tx("Unit Cost")}</th>
              <th style={{ width: 95 }} className="num">{tx("Line Cost")}</th>
              <th style={{ width: 110 }}>{tx("Batch")}</th>
              <th style={{ width: 100 }}>{tx("Expiry")}</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center",
                  color: "#9ca3af", padding: 20 }}>
                  {tx("No line items.")}
                </td>
              </tr>
            ) : doc.lines.map((line, i) => (
              <tr key={line.id || i}>
                <td>{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{line.itemName || "-"}</div>
                  {line.remarks ? (
                    <div style={{ color: "#6b7280", fontSize: 10 }}>{line.remarks}</div>
                  ) : null}
                </td>
                <td>{line.uomCode || line.uomName || "-"}</td>
                <td className="num">{fmtQty(line.requestedQty)}</td>
                <td className="num">{line.approvedQty != null ? fmtQty(line.approvedQty) : "-"}</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {fmtQty(
                    line.issuedQty > 0
                      ? line.issuedQty
                      : line.approvedQty ?? 0,
                  )}
                </td>
                <td className="num">{line.postedUnitCost != null ? fmt$(line.postedUnitCost) : "-"}</td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {line.postedLineCost != null ? fmt$(line.postedLineCost) : "-"}
                </td>
                <td>{line.batchNo || "-"}</td>
                <td>{line.expiryDate ? fmtDate(line.expiryDate) : "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ textAlign: "right" }}>{tx("Total")}</td>
              <td className="num">{fmtQty(doc.lines.reduce((sum, line) => sum + line.requestedQty, 0))}</td>
              <td className="num">{fmtQty(totalApprovedQty)}</td>
              <td className="num">{fmtQty(totalQty)}</td>
              <td />
              <td className="num">{totalValue > 0 ? fmt$(totalValue) : "-"}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>

        <div className="sigs">
          <div className="sig-box">{tx("Prepared By")}</div>
          <div className="sig-box">{tx("Issued By")}</div>
          <div className="sig-box">{tx("Received By")}</div>
        </div>
      </div>
    </>
  );
}
