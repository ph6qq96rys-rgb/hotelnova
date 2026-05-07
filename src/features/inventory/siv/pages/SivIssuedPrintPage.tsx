import * as React from "react";
import { useParams } from "react-router-dom";
import { sivApi } from "../api/sivApi";

function safe(value: unknown): string {
  return value == null ? "" : String(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function formatQty(value?: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function unwrapApi(input: any): any {
  return input?.data?.data ?? input?.data ?? input ?? {};
}

function pickLines(raw: any): any[] {
  const lines =
    raw?.lines ??
    raw?.sivLines ??
    raw?.issueLines ??
    raw?.stockIssueVoucherLines ??
    raw?.stockIssueLines ??
    raw?.lineItems ??
    raw?.items ??
    raw?.details ??
    raw?.documentLines ??
    [];

  return Array.isArray(lines) ? lines : [];
}

export default function SivIssuedPrintPage() {
  const { companyId = "", sivId = "", id = "" } = useParams();
  const documentId = sivId || id;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [doc, setDoc] = React.useState<any | null>(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const raw = await sivApi.getById(companyId, documentId);
        if (!active) return;

        setDoc(unwrapApi(raw));
      } catch (e: any) {
        if (!active) return;
        setError(e?.response?.data?.title || e?.message || "Failed to load SIV print page.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (companyId && documentId) void load();

    return () => {
      active = false;
    };
  }, [companyId, documentId]);

  const lines = React.useMemo(() => pickLines(doc), [doc]);

  if (loading) return <div style={{ padding: 24 }}>Loading print page...</div>;
  if (error) return <div style={{ padding: 24 }}>{error}</div>;
  if (!doc) return <div style={{ padding: 24 }}>SIV not found.</div>;

  return (
    <div className="print-page">
      <style>{`
        body {
          background: #fff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }

        .print-page {
          max-width: 980px;
          margin: 0 auto;
          padding: 32px;
        }

        .print-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 18px;
        }

        .print-btn {
          border: 1px solid #111827;
          background: #111827;
          color: #fff;
          border-radius: 8px;
          padding: 9px 14px;
          cursor: pointer;
          font-weight: 700;
        }

        .header {
          border-bottom: 2px solid #111827;
          padding-bottom: 12px;
          margin-bottom: 18px;
        }

        .title {
          font-size: 22px;
          font-weight: 800;
          text-align: center;
          margin: 0;
          text-transform: uppercase;
        }

        .subtitle {
          text-align: center;
          font-size: 13px;
          margin-top: 4px;
          color: #4b5563;
        }

        .meta {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px 18px;
          margin-top: 18px;
          font-size: 13px;
        }

        .meta-item label {
          display: block;
          font-weight: 700;
          color: #374151;
          margin-bottom: 2px;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 18px;
          font-size: 12.5px;
        }

        .table th,
        .table td {
          border: 1px solid #d1d5db;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }

        .table th {
          background: #f3f4f6;
          font-weight: 800;
        }

        .num {
          text-align: right;
        }

        .signatures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
          margin-top: 52px;
          font-size: 13px;
        }

        .sig-line {
          border-top: 1px solid #111827;
          padding-top: 7px;
          text-align: center;
        }

        @media print {
          .print-actions {
            display: none;
          }

          .print-page {
            padding: 0;
            max-width: none;
          }

          @page {
            size: A4;
            margin: 14mm;
          }
        }
      `}</style>

      <div className="print-actions">
        <button className="print-btn" onClick={() => window.print()} type="button">
          Print
        </button>
      </div>

      <div className="header">
        <h1 className="title">Stock Issue Voucher</h1>
        <div className="subtitle">Issued Inventory Document</div>

        <div className="meta">
          <div className="meta-item">
            <label>SIV No.</label>
            <div>{safe(doc.number ?? doc.documentNumber ?? doc.voucherNo ?? doc.id)}</div>
          </div>

          <div className="meta-item">
            <label>Status</label>
            <div>{safe(doc.docStatus ?? doc.status ?? "Issued")}</div>
          </div>

          <div className="meta-item">
            <label>Issue Date</label>
            <div>{formatDate(doc.issueDate ?? doc.documentDate)}</div>
          </div>

          <div className="meta-item">
            <label>Branch</label>
            <div>{safe(doc.branchName ?? doc.branch?.name ?? doc.branchId)}</div>
          </div>

          <div className="meta-item">
            <label>From Location</label>
            <div>{safe(doc.fromLocationName ?? doc.fromLocation?.name ?? doc.fromLocationId)}</div>
          </div>

          <div className="meta-item">
            <label>Department</label>
            <div>{safe(doc.departmentName ?? doc.department?.name ?? doc.departmentId)}</div>
          </div>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 45 }}>#</th>
            <th>Item</th>
            <th style={{ width: 90 }}>UOM</th>
            <th style={{ width: 90 }} className="num">Qty</th>
            <th style={{ width: 120 }}>Batch</th>
            <th style={{ width: 110 }}>Expiry</th>
            <th>Remarks</th>
          </tr>
        </thead>

        <tbody>
          {lines.length ? (
            lines.map((line: any, index: number) => (
              <tr key={line.id ?? `${line.itemId}_${index}`}>
                <td>{index + 1}</td>
                <td>
                  {safe(
                    line.itemName ??
                      line.inventoryItemName ??
                      line.productName ??
                      line.item?.name ??
                      line.inventoryItem?.name ??
                      line.itemId
                  ) || "—"}
                </td>
                <td>
                  {safe(
                    line.uomCode ??
                      line.unitOfMeasureCode ??
                      line.uomName ??
                      line.uom?.name ??
                      line.uomId
                  ) || "—"}
                </td>
                <td className="num">
                  {formatQty(line.qty ?? line.quantity ?? line.issuedQty ?? line.issueQty)}
                </td>
                <td>{safe(line.batchNo ?? line.batchNumber) || "—"}</td>
                <td>{formatDate(line.expiryDate ?? line.expirationDate)}</td>
                <td>{safe(line.remarks ?? line.notes) || "—"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} style={{ textAlign: "center" }}>
                No line items found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="signatures">
        <div className="sig-line">Prepared By</div>
        <div className="sig-line">Issued By</div>
        <div className="sig-line">Received By</div>
      </div>
    </div>
  );
}