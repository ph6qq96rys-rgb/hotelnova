// src/modules/company/onboarding/steps/ReviewStep.tsx
//
// Self-contained: fetches fresh summary data (locations, stores, users) on
// mount so the review reflects actual DB state, not potentially stale reducer
// state. The readiness checklist uses live counts from the fetched data.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { BranchUserDto, StockLocation, StoreDto } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import type { OnboardingReadiness, OnboardingState } from "../state/onboarding.types";
import { Btn, Spinner, InfoRow, EmptyState } from "../components/company.ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

function nameOf(x: any): string {
  const full = [x?.firstName, x?.lastName].filter(Boolean).join(" ");
  return x?.name ?? x?.fullName ?? full ?? x?.userName ?? x?.email ?? "—";
}

function getUserId(x: any): string {
  return String(x?.userId ?? x?.id ?? x?.Id ?? "");
}

// ── Readiness item ────────────────────────────────────────────────────────────

function CheckRow({
  done, required, label, detail,
}: {
  done:      boolean;
  required:  boolean;
  label:     string;
  detail?:   string;
}) {
  const icon = done
    ? <CheckCircle size={16} color="#16a34a" style={{ flexShrink: 0 }} />
    : required
      ? <XCircle    size={16} color="#dc2626" style={{ flexShrink: 0 }} />
      : <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0 }} />;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 0",
      borderBottom: "1px solid #f1f5f9",
    }}>
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: done ? "#0f172a" : required ? "#b91c1c" : "#92400e" }}>
          {label}
        </div>
        {detail && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{detail}</div>
        )}
      </div>
      {required && !done && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#dc2626",
          background: "#fef2f2", padding: "1px 7px",
          borderRadius: 999, border: "1px solid #fecaca",
        }}>Required</span>
      )}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  title, count, unit, children,
}: {
  title:    string;
  count:    number;
  unit:     string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      border: "1px solid #e2e8f0", borderRadius: 12,
      background: "#fff", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid #f1f5f9",
        background: "#fafbfc",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{title}</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          {count} {unit}{count !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ padding: "8px 16px", maxHeight: 200, overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function MiniRow({ label, badge, badgeTone }: {
  label:     string;
  badge:     string;
  badgeTone: "success" | "warn" | "default";
}) {
  const cls = badgeTone === "success" ? "ob-badge ob-badge--success"
            : badgeTone === "warn"    ? "ob-badge ob-badge--warn"
            : "ob-badge";
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0", borderBottom: "1px solid #f8fafc",
      fontSize: 12, color: "#334155",
    }}>
      <span>{label}</span>
      <span className={cls}>{badge}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewStep(props: {
  state:     OnboardingState;
  readiness: OnboardingReadiness;
  onFinish:  () => void;
}) {
  const { state } = props;
  const companyId = state.companyId;
  const branchId  = state.branchId;

  // ── Fresh data for review panels ──────────────────────────────────────────
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [stores,    setStores]    = useState<StoreDto[]>([]);
  const [members,   setMembers]   = useState<BranchUserDto[]>([]);
  const [loading,   setLoading]   = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!companyId || !branchId) return;
    setLoading(true);
    try {
      const [l, s, m] = await Promise.all([
        onboardingApi.listStockLocations(companyId, branchId).catch(() => []),
        onboardingApi.listStores(companyId, branchId).catch(() => []),
        onboardingApi.listBranchUsers(companyId, branchId).catch(() => []),
      ]);
      setLocations(Array.isArray(l) ? l : []);
      setStores(Array.isArray(s) ? s : []);
      setMembers(Array.isArray(m) ? m : []);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => { void fetchSummary(); }, [fetchSummary]);

  // ── Live readiness from fetched data ──────────────────────────────────────
  const hasCompany  = !!companyId;
  const hasBranch   = !!branchId;
  const hasStock    = locations.length > 0;
  const hasStore    = stores.length > 0;
  const hasAdmin    = members.some((m) => m.role === "BranchAdmin");
  const allMapped   = stores.length > 0 && stores.every((s) => {
    const a = s as any;
    return !!(a.issueStockLocationId ?? a.defaultIssueStockLocationId);
  });

  const canFinish = hasCompany && hasBranch && hasStock && hasAdmin;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Company + branch summary ────────────────────────────────────── */}
      <div className="ob-grid-2">
        <div style={{
          border: "1px solid #e2e8f0", borderRadius: 12,
          background: "#fff", overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid #f1f5f9",
            background: "#fafbfc", fontSize: 13, fontWeight: 700, color: "#0f172a",
          }}>
            Company
          </div>
          <div style={{ padding: "12px 16px" }}>
            <InfoRow label="Name"     value={state.company?.legalName       ?? "—"} />
            <InfoRow label="Currency" value={state.company?.defaultCurrency ?? "ETB"} />
            <InfoRow label="City"     value={(state.company as any)?.city   ?? "—"} />
          </div>
        </div>

        <div style={{
          border: "1px solid #e2e8f0", borderRadius: 12,
          background: "#fff", overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid #f1f5f9",
            background: "#fafbfc", fontSize: 13, fontWeight: 700, color: "#0f172a",
          }}>
            Branch
          </div>
          <div style={{ padding: "12px 16px" }}>
            <InfoRow label="Name"   value={(state.branch as any)?.name ?? "—"} />
            <InfoRow label="Code"   value={(state.branch as any)?.code ?? "—"} />
            <InfoRow label="City"   value={(state.branch as any)?.city ?? "—"} />
          </div>
        </div>
      </div>

      {/* ── Live summary panels ──────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: "#64748b" }}>
          <Spinner /> Loading review data…
        </div>
      ) : (
        <div className="ob-grid-3">

          <SummaryCard title="Stock locations" count={locations.length} unit="location">
            {locations.length > 0
              ? locations.map((l) => {
                  const a = l as any;
                  const badges = [
                    a.isDefaultReceiving && "Receiving",
                    a.isDefaultIssue     && "Issue",
                  ].filter(Boolean).join(" · ");
                  return (
                    <MiniRow key={a.id}
                      label={`${a.name ?? "—"}${a.code ? ` (${a.code})` : ""}`}
                      badge={badges || a.locationType || "—"}
                      badgeTone="success"
                    />
                  );
                })
              : <EmptyState title="No locations" sub="Add a stock location." />
            }
          </SummaryCard>

          <SummaryCard title="Stores" count={stores.length} unit="store">
            {stores.length > 0
              ? stores.map((s) => {
                  const a     = s as any;
                  const mapped = !!(a.issueStockLocationId ?? a.defaultIssueStockLocationId);
                  return (
                    <MiniRow key={a.id}
                      label={`${a.name ?? "—"}${a.code ? ` (${a.code})` : ""}`}
                      badge={mapped ? "Mapped" : "Not mapped"}
                      badgeTone={mapped ? "success" : "warn"}
                    />
                  );
                })
              : <EmptyState title="No stores" sub="Stores are optional." />
            }
          </SummaryCard>

          <SummaryCard title="Users" count={members.length} unit="user">
            {members.length > 0
              ? members.map((m) => {
                  const uid = getUserId(m);
                  return (
                    <MiniRow key={uid || m.email}
                      label={nameOf(m)}
                      badge={m.role === "BranchAdmin" ? "Admin" : "Staff"}
                      badgeTone={m.role === "BranchAdmin" ? "success" : "default"}
                    />
                  );
                })
              : <EmptyState title="No users" sub="Create a Branch Admin." />
            }
          </SummaryCard>

        </div>
      )}

      {/* ── Readiness checklist ──────────────────────────────────────────── */}
      <div style={{
        border: "1px solid #e2e8f0", borderRadius: 12,
        background: "#fff", overflow: "hidden",
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #f1f5f9",
          background: "#fafbfc", fontSize: 13, fontWeight: 700, color: "#0f172a",
        }}>
          Readiness checklist
        </div>
        <div style={{ padding: "4px 16px 8px" }}>
          <CheckRow done={hasCompany} required label="Company registered" />
          <CheckRow done={hasBranch}  required label="Branch selected or created" />
          <CheckRow done={hasStock}   required label={`${locations.length} stock location${locations.length !== 1 ? "s" : ""} configured`}
            detail="Required for GRN, SIV, and inventory transactions." />
          <CheckRow done={hasStore}   required={false} label={`${stores.length} store${stores.length !== 1 ? "s" : ""} configured`}
            detail="Required for POS sales." />
          <CheckRow done={allMapped}  required={false} label="All stores mapped to issue locations"
            detail="Each store should have an issue stock location for SIV automation." />
          <CheckRow done={hasAdmin}   required label="At least one Branch Admin assigned"
            detail="Branch Admins can approve documents and manage branch operations." />
        </div>
      </div>

      {/* ── Finish ────────────────────────────────────────────────────────── */}
      {!canFinish && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "#fef2f2", border: "1px solid #fecaca",
          fontSize: 12, color: "#b91c1c",
        }}>
          Complete the required steps above before finishing setup.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn
          variant="primary"
          onClick={props.onFinish}
          disabled={!canFinish || state.saving}
        >
          {state.saving ? "Finishing…" : "Finish setup"}
        </Btn>
      </div>

    </div>
  );
}