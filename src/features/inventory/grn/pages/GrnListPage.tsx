import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { useI18n } from "../../../../i18n";
import { useCompanyCurrency } from "../../../../shared/currency/useCompanyCurrency";
import { grnApi } from "../api/grnApi";
import GrnRegisterTable from "../components/GrnRegisterTable";
import type { GrnListDto } from "../types/grn.types";
import {
  canReverseGrn,
  formatGrnStatusLabel,
  GRN_STATUS_OPTIONS,
  normalizeGrnStatus,
} from "../helpers/grn.status";
import type { GrnStatus, GrnStatusFilter } from "../helpers/grn.status";
import {
  formatMoney,
  getGrnBranchWarehouse,
  getGrnNumber,
  getGrnReceiptDate,
  getGrnTotal,
} from "../helpers/grn.formatters";

import "../styles/GrnPages.erp.css";
const grnListAmharicPhrases: Record<string, string> = {
  "Select a company": "ኩባንያ ይምረጡ",
  "Select a company workspace before viewing goods receipts.": "የእቃ መቀበያዎችን ከማየትዎ በፊት የኩባንያ የስራ ቦታ ይምረጡ።",
  "Inventory - Receiving": "ኢንቬንቶሪ - መቀበያ",
  "Goods Receipts": "የእቃ መቀበያዎች",
  "Track supplier receipts, posting, FIFO creation, and reversal readiness from one operational register.": "የአቅራቢ መቀበያዎችን፣ ፖስቲንግን፣ FIFO መፍጠርን እና የመመለስ ዝግጁነትን ከአንድ የኦፕሬሽን መዝገብ ይከታተሉ።",
  "New Goods Receipt": "አዲስ የእቃ መቀበያ",
  "Today's Receipts": "የዛሬ መቀበያዎች",
  "Awaiting Posting": "ፖስቲንግ በመጠባበቅ ላይ",
  "Posted Today": "ዛሬ የተፖሰተ",
  "Reversible": "ሊመለስ የሚችል",
  "Inventory Value": "የኢንቬንቶሪ ዋጋ",
  "Goods receipt summary": "የእቃ መቀበያ ማጠቃለያ",
  "Receipt Register": "የመቀበያ መዝገብ",
  "Open a receipt to review items, post drafts, or reverse posted receipts.": "እቃዎችን ለመገምገም፣ ድራፍቶችን ለመፖሰት ወይም የተፖሰቱ መቀበያዎችን ለመመለስ መቀበያ ይክፈቱ።",
  "Search GRN, supplier, warehouse, or status": "GRN፣ አቅራቢ፣ መጋዘን ወይም ሁኔታ ፈልግ",
  "Search goods receipts": "የእቃ መቀበያዎችን ፈልግ",
  "Filter by status": "በሁኔታ አጣራ",
  "Refresh": "አድስ",
  "Unable to load goods receipts. Please try again.": "የእቃ መቀበያዎችን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
};

function grnListText(language: string, text: string): string {
  return language === "am" ? grnListAmharicPhrases[text] ?? text : text;
}

export default function GrnListPage() {
  const navigate = useNavigate();
  const { language } = useI18n();
  const { companyId } = useAppScope();
  const currencyCode = useCompanyCurrency();
  const tx = useCallback((text: string) => grnListText(language, text), [language]);

  const [rows, setRows] = useState<GrnListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<GrnStatusFilter>("ALL");

  const scope = useMemo(
    () => ({
      companyId: companyId ?? "",
    }),
    [companyId],
  );

  const load = useCallback(async () => {
    if (!scope.companyId) return;

    setLoading(true);
    setError("");

    try {
      const data = await grnApi.list(scope, {
        status: toApiStatusFilter(statusFilter),
      });

      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(tx(getApiErrorMessage(err)));
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(
    () => searchGrnRows(rows, query),
    [query, rows],
  );

  const dashboard = useMemo(() => buildGrnDashboard(rows), [rows]);

  const openReceipt = useCallback(
    (row: GrnListDto) => {
      if (!scope.companyId) return;
      navigate(buildGrnDetailPath(scope.companyId, row.id));
    },
    [navigate, scope],
  );

  const createReceipt = useCallback(() => {
    if (!scope.companyId) return;
    navigate(buildGrnNewPath(scope.companyId));
  }, [navigate, scope]);

  if (!companyId) {
    return (
      <main className="page erp-grn-page">
        <section className="erp-empty-state">
          <h2>{tx("Select a company")}</h2>
          <p>{tx("Select a company workspace before viewing goods receipts.")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page erp-grn-page">
      <header className="erp-grn-hero">
        <div>
          <div className="erp-kicker">{tx("Inventory - Receiving")}</div>
          <h1>{tx("Goods Receipts")}</h1>
          <p>{tx("Track supplier receipts, posting, FIFO creation, and reversal readiness from one operational register.")}</p>
        </div>

        <button type="button" className="btn btn-primary" onClick={createReceipt}>
          + {tx("New Goods Receipt")}
        </button>
      </header>

      <section className="erp-grn-kpis" aria-label={tx("Goods receipt summary")}>
        <Kpi label={tx("Today's Receipts")} value={dashboard.todaysReceipts} />
        <Kpi label={tx("Awaiting Posting")} value={dashboard.awaitingPosting} />
        <Kpi label={tx("Posted Today")} value={dashboard.postedToday} />
        <Kpi label={tx("Reversible")} value={dashboard.reversible} />
        <Kpi label={tx("Inventory Value")} value={formatMoney(dashboard.inventoryValue, currencyCode)} />
      </section>

      <section className="card erp-grn-card">
        <div className="erp-grn-toolbar">
          <div>
            <h2>{tx("Receipt Register")}</h2>
            <p>{tx("Open a receipt to review items, post drafts, or reverse posted receipts.")}</p>
          </div>

          <div className="erp-grn-filters">
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tx("Search GRN, supplier, warehouse, or status")}
              disabled={loading}
              aria-label={tx("Search goods receipts")}
            />

            <select
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as GrnStatusFilter)}
              disabled={loading}
              aria-label={tx("Filter by status")}
            >
              {GRN_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button type="button" className="btn btn-sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <GrnRegisterTable rows={visibleRows} loading={loading} onOpen={openReceipt} currencyCode={currencyCode} />
      </section>
    </main>
  );
}


type GrnDashboard = {
  todaysReceipts: number;
  awaitingPosting: number;
  postedToday: number;
  reversible: number;
  inventoryValue: number;
};

function buildGrnDashboard(rows: GrnListDto[]): GrnDashboard {
  const today = new Date().toISOString().slice(0, 10);

  return rows.reduce<GrnDashboard>(
    (dashboard, row) => {
      const status = normalizeGrnStatus(row.status);
      const receiptDate = getGrnReceiptDate(row);
      const receiptDay = receiptDate ? receiptDate.slice(0, 10) : "";

      if (receiptDay === today) {
        dashboard.todaysReceipts += 1;
      }

      if (status === "DRAFT" || status === "SUBMITTED" || status === "APPROVED") {
        dashboard.awaitingPosting += 1;
      }

      if (status === "POSTED" && receiptDay === today) {
        dashboard.postedToday += 1;
      }

      if (canReverseGrn(row)) {
        dashboard.reversible += 1;
      }

      dashboard.inventoryValue += getGrnTotal(row);
      return dashboard;
    },
    {
      todaysReceipts: 0,
      awaitingPosting: 0,
      postedToday: 0,
      reversible: 0,
      inventoryValue: 0,
    },
  );
}

function buildGrnDetailPath(companyId: string, grnId: string): string {
  return `/companies/${companyId}/grns/${grnId}`;
}

function buildGrnNewPath(companyId: string): string {
  return `/companies/${companyId}/grns/new`;
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load goods receipts. Please try again.";
}

function searchGrnRows(rows: GrnListDto[], query: string): GrnListDto[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) => {
    const status = normalizeGrnStatus(row.status);
    const searchableText = [
      getGrnNumber(row),
      row.supplierName,
      getGrnBranchWarehouse(row),
      formatGrnStatusLabel(status),
      row.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(needle);
  });
}

export function toApiStatusFilter(
  status: GrnStatusFilter,
): GrnStatus | undefined {
  return status === "ALL" ? undefined : status;
}
function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="erp-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
