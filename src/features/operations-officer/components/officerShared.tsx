import { useCallback, useEffect, useState, type ReactNode } from "react";
import { NavLink, useParams } from "react-router-dom";

import { Select } from "../../../components/ui/select";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { Chip } from "../../finance/components/glShared";
import { officerApi, type ActionStatus, type AuthorityMode, type Evidence, type FindingKind, type FindingStatus, type ProgressStatus, type References, type Severity, type TargetStatus } from "../api/officerApi";
import "./officer.css";

export const SEVERITY_LABEL: Record<Severity, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
export const SEVERITY_TONE: Record<Severity, "muted" | "info" | "warn" | "bad"> = { low: "muted", medium: "info", high: "warn", critical: "bad" };
export const KIND_LABEL: Record<FindingKind, string> = {
  actualMiss: "Missed target", forecastRisk: "Forecast risk", exception: "Exception", dataQuality: "Data quality", configuration: "Configuration",
};
export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = { open: "Open", acknowledged: "Acknowledged", resolved: "Resolved", dismissed: "Dismissed" };
export const MODE_LABEL: Record<AuthorityMode, string> = { recommend: "Recommend", prepareForApproval: "Prepare for approval", executeWithinPolicy: "Execute within policy" };
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  proposed: "Recommended", pendingApproval: "Awaiting approval", approved: "Approved", executing: "Running", executed: "Done", failed: "Failed",
  rejected: "Rejected", cancelled: "Cancelled", blocked: "Blocked",
};
export const ACTION_STATUS_TONE: Record<ActionStatus, "neutral" | "ok" | "warn" | "bad" | "info" | "muted"> = {
  proposed: "info", pendingApproval: "warn", approved: "info", executing: "info", executed: "ok", failed: "bad", rejected: "muted", cancelled: "muted", blocked: "bad",
};
export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  draft: "Draft", pendingApproval: "Awaiting approval", active: "Active", superseded: "Superseded", retired: "Retired", rejected: "Rejected",
};
export const TARGET_STATUS_TONE: Record<TargetStatus, "neutral" | "ok" | "warn" | "bad" | "info" | "muted"> = {
  draft: "neutral", pendingApproval: "warn", active: "ok", superseded: "muted", retired: "muted", rejected: "bad",
};
export const PROGRESS_LABEL: Record<ProgressStatus, string> = { onTrack: "On track", atRisk: "At risk", missed: "Missed", met: "Met", noData: "No data" };
export const PROGRESS_TONE: Record<ProgressStatus, "ok" | "warn" | "bad" | "muted"> = { onTrack: "ok", atRisk: "warn", missed: "bad", met: "ok", noData: "muted" };

export const when = (value?: string | null) => (value ? formatAppDateTime(value) : "—");
export const metricValue = (unit: "money" | "percent", value?: number | null) =>
  value === null || value === undefined ? "—" : unit === "percent" ? `${Number(value).toFixed(1).replace(/\.0$/, "")}%` : formatCurrency(value);

export function SeverityChip({ severity }: { severity: Severity }) {
  return <Chip tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Chip>;
}

/** Supporting records of a finding or action, as short references. */
export function EvidenceList({ items, empty = "No supporting records." }: { items: Evidence[]; empty?: string }) {
  if (items.length === 0) return <p className="gl-muted">{empty}</p>;
  return (
    <ul className="oo-evidence">
      {items.map((e, i) => (
        <li key={`${e.type}-${e.id ?? i}`}>
          <span className="oo-evidence-type">{e.type}</span>
          {e.no ? <strong>{e.no}</strong> : null}
          <span>{e.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Branches, departments, employees, action types and metrics for pickers and names. */
export function useOfficerRefs(companyId: string) {
  const [refs, setRefs] = useState<References>({ branches: [], departments: [], locations: [], employees: [], actionTypes: [], metrics: [] });
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    if (!companyId) return;
    try { setRefs(await officerApi.references(companyId)); } catch { /* pickers stay empty; the page shows its own error */ }
    finally { setLoaded(true); }
  }, [companyId]);
  useEffect(() => { void reload(); }, [reload]);
  return { refs, loaded, reload };
}

export function BranchSelect({ value, onChange, branches, allLabel, id }: {
  value: string; onChange: (value: string) => void; branches: { id: string; name: string }[]; allLabel?: string; id?: string;
}) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {allLabel ? <option value="">{allLabel}</option> : null}
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </Select>
  );
}

export function EmployeeSelect({ value, onChange, employees, branchId, placeholder = "Nobody", id }: {
  value: string; onChange: (value: string) => void; employees: { id: string; name: string; branchId?: string | null }[]; branchId?: string; placeholder?: string; id?: string;
}) {
  const sorted = [...employees].sort((a, b) => Number(b.branchId === branchId) - Number(a.branchId === branchId) || a.name.localeCompare(b.name));
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {sorted.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
    </Select>
  );
}

const LINKS = [
  { to: "", label: "Briefing", end: true },
  { to: "/findings", label: "Findings" },
  { to: "/targets", label: "Targets" },
  { to: "/actions", label: "Actions & audit" },
  { to: "/setup", label: "Setup & authority" },
];

/** Tabs between the officer's pages. */
export function OfficerNav() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const root = `/companies/${companyId}/operations-officer`;
  return (
    <nav className="oo-nav" aria-label="Operations Officer">
      {LINKS.map((l) => (
        <NavLink key={l.to} to={root + l.to} end={l.end} className={({ isActive }) => (isActive ? "oo-nav-link is-active" : "oo-nav-link")}>{l.label}</NavLink>
      ))}
    </nav>
  );
}

export function Section({ title, hint, actions, children }: { title: string; hint?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="gl-panel">
      <div className="gl-panel-head">
        <div><h2>{title}</h2>{hint ? <p className="gl-muted">{hint}</p> : null}</div>
        {actions ? <div className="gl-toolbar">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export const newClientId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
