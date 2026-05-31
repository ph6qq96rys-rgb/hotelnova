// src/features/inventory/siv/pages/SivIssuedPrintPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { sivApi } from "../api/sivApi";
import { mapToVm, fmtDate, fmtQty, getApiError, type SivVm } from "../types/sivTypes";

export default function SivIssuedPrintPage() {
  const { companyId = "", sivId = "", id = "" } = useParams();
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
        setDoc(mapToVm(raw.data));
      } catch (e) {
        if (active) setErr(getApiError(e, "Failed to load SIV."));
      } finally {
        if (active) setLoading(false);
      }
    }
    if (companyId && documentId) void load();
    return () => { active = false; };
  }, [companyId, documentId]);

  const totalQty = useMemo(
    () => (doc?.lines ?? []).reduce((s, l) => s + l.qty, 0),
    [doc]
  );

  if (loading) {
    return <div style={{ padding: 32, fontFamily: "Arial", color: "#111" }}>
      Loading print page…
    </div>;
  }

  if (err || !doc) {
    return <div style={{ padding: 32, fontFamily: "Arial", color: "#b91c1c" }}>
      {err || "SIV not found."}
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
        .pp { max-width: 960px; margin: 0 auto; padding: 28px 32px; }
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
          padding-bottom: 14px;
          margin-bottom: 18px;
          text-align: center;
        }
        .doc-header h1 {
          font-size: 20px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .doc-header .sub {
          font-size: 12px;
          color: #6b7280;
          margin-top: 3px;
        }
        .meta {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px 20px;
          margin-bottom: 20px;
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
          margin-top: 52px;
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
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="pp">
        <div className="no-print">
          <button className="print-btn" onClick={() => window.print()}>
            🖨 Print
          </button>
        </div>

        <div className="doc-header">
          <h1>Stock Issue Voucher</h1>
          <div className="sub">Issued Inventory Document</div>
        </div>

        <div className="meta">
          {[
            { label: "SIV No.",       value: doc.number || doc.id },
            { label: "Status",        value: doc.docStatus },
            { label: "Issue date",    value: fmtDate(doc.issueDate) },
            { label: "Branch",        value: doc.branchId },
            { label: "From location", value: doc.fromLocationName || "—" },
            { label: "Department",    value: doc.departmentName   || "—" },
            { label: "Remarks",       value: doc.remarks || doc.notes || "—" },
          ].map(({ label, value }) => (
            <div className="meta-item" key={label}>
              <div className="label">{label}</div>
              <div>{value || "—"}</div>
            </div>
          ))}
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Item</th>
              <th style={{ width: 80 }}>UOM</th>
              <th style={{ width: 80 }} className="num">Qty</th>
              <th style={{ width: 110 }}>Batch</th>
              <th style={{ width: 100 }}>Expiry</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center",
                  color: "#9ca3af", padding: 20 }}>
                  No line items.
                </td>
              </tr>
            ) : doc.lines.map((line, i) => (
              <tr key={line.id || i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{line.itemName || "—"}</td>
                <td>{line.uomCode || line.uomName || "—"}</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {fmtQty(line.qty)}
                </td>
                <td>{line.batchNo || "—"}</td>
                <td>{line.expiryDate ? fmtDate(line.expiryDate) : "—"}</td>
                <td style={{ color: "#6b7280" }}>{line.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ textAlign: "right" }}>Total</td>
              <td className="num">{fmtQty(totalQty)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>

        <div className="sigs">
          <div className="sig-box">Prepared By</div>
          <div className="sig-box">Issued By</div>
          <div className="sig-box">Received By</div>
        </div>
      </div>
    </>
  );
}
