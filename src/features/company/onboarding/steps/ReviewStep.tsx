// src/modules/company/onboarding/steps/ReviewStep.tsx
// ERP-grade onboarding readiness review.
// CompanyAdmin is recommended, not required.
// Rule hierarchy for POS issue source: item -> category -> POS rule -> POS fallback -> branch default -> block.

import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import type {
  OnboardingReadiness,
  OnboardingState,
} from "../state/onboarding.types";
import { Btn, EmptyState, InfoRow } from "../components/company.ui";

type Props = {
  state: OnboardingState;
  readiness: OnboardingReadiness;
  onFinish: () => Promise<void> | void;
};

type Tone = "success" | "warn" | "info" | "default";

function text(value: unknown, fallback = "—") {
  const s = String(value ?? "").trim();
  return s || fallback;
}

function idOf(x: any) {
  return String(
    x?.id ??
      x?.Id ??
      x?.userId ??
      x?.employeeId ??
      x?.stockLocationId ??
      "",
  );
}

function active(x: any) {
  return (
    x?.isActive !== false &&
    String(x?.status ?? "active").toLowerCase() !== "inactive"
  );
}

function rolesOf(x: any): string[] {
  if (Array.isArray(x?.roles)) {
    return x.roles.filter(Boolean).map(String);
  }

  if (Array.isArray(x?.roleNames)) {
    return x.roleNames.filter(Boolean).map(String);
  }

  if (typeof x?.roles === "string") {
    return x.roles
      .split(",")
      .map((r: string) => r.trim())
      .filter(Boolean);
  }

  return [x?.role, x?.roleName, x?.primaryRole].filter(Boolean).map(String);
}

function normalizeRole(value: string) {
  return value.replace(/[\s_-]+/g, "").toLowerCase();
}

function hasRole(x: any, role: string) {
  const expected = normalizeRole(role);

  return rolesOf(x).some((r) => {
    const current = normalizeRole(r);

    if (expected === "companyadmin") {
      return ["companyadmin", "companyadministrator"].includes(current);
    }

    return current === expected;
  });
}

function nameOf(x: any) {
  return text(
    x?.employeeName ??
      x?.employee?.fullName ??
      x?.fullName ??
      x?.name ??
      x?.userName ??
      x?.email,
  );
}

function locationType(x: any) {
  return String(x?.locationType ?? x?.type ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function issueId(x: any) {
  return String(
    x?.defaultIssueStockLocationId ??
      x?.issueStockLocationId ??
      x?.issueLocationId ??
      x?.stockLocationId ??
      "",
  ).trim();
}

function hasAnyId(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(String(value ?? "").trim());
}

function errorText(err: unknown) {
  const e = err as any;
  const data = e?.response?.data;

  if (typeof data === "string") return data;

  return (
    data?.detail ??
    data?.error ??
    data?.message ??
    data?.title ??
    e?.message ??
    "Company activation failed. Please review the required setup and try again."
  );
}

function CheckRow(props: {
  done: boolean;
  required?: boolean;
  label: string;
  detail?: string;
}) {
  const required = props.required === true;

  const icon = props.done ? (
    <CheckCircle size={16} color="#16a34a" />
  ) : required ? (
    <XCircle size={16} color="#dc2626" />
  ) : (
    <AlertCircle size={16} color="#d97706" />
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "9px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      {icon}

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: props.done ? "#0f172a" : required ? "#b91c1c" : "#92400e",
          }}
        >
          {props.label}
        </div>

        {props.detail && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
            {props.detail}
          </div>
        )}
      </div>

      {!props.done && (
        <span
          className={required ? "ob-badge ob-badge--danger" : "ob-badge ob-badge--warn"}
        >
          {required ? "Required" : "Recommended"}
        </span>
      )}
    </div>
  );
}

function SummaryCard(props: {
  title: string;
  count: number;
  unit: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ob-inner-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #f1f5f9",
          background: "#fafbfc",
        }}
      >
        <strong>{props.title}</strong>
        <span style={{ color: "#94a3b8", fontSize: 11 }}>
          {props.count} {props.unit}
          {props.count !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        className="ob-inner-card-body"
        style={{ maxHeight: 240, overflowY: "auto" }}
      >
        {props.children}
      </div>
    </div>
  );
}

function MiniRow(props: {
  label: string;
  sub?: string;
  badge: string;
  tone?: Tone;
}) {
  const cls =
    props.tone === "success"
      ? "ob-badge ob-badge--success"
      : props.tone === "warn"
        ? "ob-badge ob-badge--warn"
        : props.tone === "info"
          ? "ob-badge ob-badge--info"
          : "ob-badge";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid #f8fafc",
      }}
    >
      <span style={{ fontSize: 12 }}>
        {props.label}

        {props.sub && (
          <span style={{ display: "block", color: "#94a3b8", fontSize: 11 }}>
            {props.sub}
          </span>
        )}
      </span>

      <span className={cls}>{props.badge}</span>
    </div>
  );
}

export function ReviewStep(props: Props) {
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const state = props.state as any;
  const backend = state.readiness as any;

  const locations: any[] = state.stockLocations ?? [];
  const stores: any[] = state.stores ?? [];
  const members: any[] = state.members ?? [];

  const hasCompany =
    backend?.hasCompany === true ||
    props.readiness.company?.done === true ||
    Boolean(state.companyId || state.company);

  const hasBranch =
    backend?.hasBranch === true ||
    backend?.hasActiveBranch === true ||
    props.readiness.branch?.done === true ||
    Boolean(state.branchId || state.branch);

  const activeLocations = locations.filter(active);
  const activeStores = stores.filter(active);
  const activeMembers = members.filter(active);

  const hasWarehouse =
    backend?.hasStockLocation === true ||
    backend?.hasActiveWarehouse === true ||
    activeLocations.some(
      (x) => locationType(x).includes("warehouse") || x.canReceive === true,
    );

  const hasTransitLocation =
    backend?.hasTransitLocation === true ||
    activeLocations.some((x) => locationType(x).includes("transit"));

  const hasReceiving =
    backend?.hasDefaultReceivingLocation === true ||
    activeLocations.some(
      (x) => x.canReceive === true || x.isDefaultReceiving === true,
    );

  const hasIssue =
    backend?.hasDefaultIssueLocation === true ||
    activeLocations.some(
      (x) =>
        x.canIssue === true ||
        x.canSell === true ||
        x.isDefaultIssue === true,
    );

  const hasConsumptionLocation =
    backend?.hasConsumptionLocation === true ||
    activeLocations.some(
      (x) =>
        x.isConsumptionLocation === true ||
        x.isDefaultConsumption === true ||
        x.canConsume === true ||
        locationType(x).includes("consumption"),
    );

  const hasProductionSource =
    backend?.hasProductionSource === true ||
    activeLocations.some(
      (x) =>
        x.isMainWarehouseForProduction === true ||
        x.isProductionWarehouse === true ||
        x.isDefaultProductionSource === true,
    );

  const hasStore =
    backend?.hasStore === true ||
    backend?.hasActiveStore === true ||
    activeStores.length > 0;

  const hasBranchDefaultIssue = activeLocations.some(
    (x) => x.isDefaultIssue === true || x.defaultIssue === true,
  );

  const hasStoreFallback = activeStores.some((s) => Boolean(issueId(s)));

  const hasItemOrCategoryRules =
    backend?.hasItemIssueRules === true ||
    backend?.hasCategoryIssueRules === true;

  const hasIssueHierarchy =
    !hasStore ||
    hasStoreFallback ||
    hasBranchDefaultIssue ||
    hasItemOrCategoryRules ||
    hasIssue;

  const hasActiveUser =
    backend?.hasUser === true ||
    backend?.hasActiveUser === true ||
    activeMembers.length > 0;

  const hasCompanyAdmin =
    backend?.hasCompanyAdmin === true ||
    activeMembers.some((m) => hasRole(m, "CompanyAdmin"));

  const hasUserBranch =
    backend?.hasUserBranchAssignment === true ||
    activeMembers.some(
      (m) =>
        hasAnyId(m.defaultBranchId) ||
        hasAnyId(m.branchId) ||
        hasAnyId(m.branchIds) ||
        hasAnyId(m.branches),
    );

  const hasUserLocation =
    backend?.hasUserStockLocationAssignment === true ||
    activeMembers.some(
      (m) =>
        hasAnyId(m.defaultStockLocationId) ||
        hasAnyId(m.stockLocationId) ||
        hasAnyId(m.stockLocationIds) ||
        hasAnyId(m.stockLocations),
    );

  const canActivate =
    hasCompany &&
    hasBranch &&
    hasWarehouse &&
    hasTransitLocation &&
    hasReceiving &&
    hasIssue &&
    hasStore &&
    hasIssueHierarchy &&
    hasActiveUser &&
    hasUserBranch &&
    hasUserLocation;

  const handleActivate = useCallback(
    async (event?: React.MouseEvent<HTMLButtonElement>) => {
      // This component is commonly rendered inside an onboarding form/wizard.
      // Keep the activate button from submitting the parent form, which can
      // navigate away before activation finishes.
      event?.preventDefault();
      event?.stopPropagation();

      if (!canActivate || activating) return;

      setActivateError(null);
      setActivating(true);

      try {
        await props.onFinish();
      } catch (err) {
        setActivateError(errorText(err));
      } finally {
        setActivating(false);
      }
    },
    [activating, canActivate, props],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="ob-grid-2">
        <div className="ob-inner-card">
          <div className="ob-inner-card-body">
            <InfoRow
              label="Company"
              value={text(state.company?.legalName ?? state.company?.name)}
            />
            <InfoRow label="Branch" value={text(state.branch?.name)} />
            <InfoRow label="Branch code" value={text(state.branch?.code)} />
          </div>
        </div>

        <div className="ob-inner-card">
          <div className="ob-inner-card-body">
            <InfoRow
              label="ERP model"
              value="Company stock locations + branch assignment + one or more POS"
            />
            <InfoRow
              label="Issue hierarchy"
              value="Item → Category → POS → Branch → Block"
            />
            <InfoRow
              label="Activation"
              value={canActivate ? "Ready" : "Incomplete"}
            />
          </div>
        </div>
      </div>

      <div className="ob-grid-3">
        <SummaryCard
          title="Stock locations"
          count={locations.length}
          unit="location"
        >
          {locations.length ? (
            locations.map((x) => (
              <MiniRow
                key={idOf(x)}
                label={`${text(x.name)}${x.code ? ` (${x.code})` : ""}`}
                sub={text(x.locationType ?? x.type)}
                badge={active(x) ? "Active" : "Inactive"}
                tone={active(x) ? "success" : "warn"}
              />
            ))
          ) : (
            <EmptyState
              title="No locations"
              sub="Assign stock locations to this branch."
            />
          )}
        </SummaryCard>

        <SummaryCard title="POS/stores" count={stores.length} unit="POS">
          {stores.length ? (
            stores.map((x) => (
              <MiniRow
                key={idOf(x)}
                label={`${text(x.name)}${x.code ? ` (${x.code})` : ""}`}
                sub={
                  issueId(x)
                    ? `Fallback: ${issueId(x)}`
                    : "Uses branch/item hierarchy"
                }
                badge={active(x) ? "Active" : "Inactive"}
                tone={active(x) ? "success" : "warn"}
              />
            ))
          ) : (
            <EmptyState
              title="No POS/stores"
              sub="Add at least one POS for sales-enabled branches."
            />
          )}
        </SummaryCard>

        <SummaryCard title="Users" count={members.length} unit="user">
          {members.length ? (
            members.map((m) => {
              const roles = rolesOf(m);
              const isAdmin = hasRole(m, "CompanyAdmin");

              return (
                <MiniRow
                  key={idOf(m) || m.email}
                  label={nameOf(m)}
                  sub={text(m.email ?? m.userName)}
                  badge={roles.length ? roles.join(", ") : "No role"}
                  tone={isAdmin ? "success" : "default"}
                />
              );
            })
          ) : (
            <EmptyState
              title="No users"
              sub="Create at least one active operational user."
            />
          )}
        </SummaryCard>
      </div>

      <div className="ob-inner-card">
        <div className="ob-inner-card-body">
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            Activation readiness
          </div>

          <CheckRow done={hasCompany} required label="Company configured" />
          <CheckRow done={hasBranch} required label="Branch configured" />

          <CheckRow
            done={hasWarehouse}
            required
            label="At least one active warehouse/stock location"
          />

          <CheckRow
            done={hasTransitLocation}
            required
            label="Transit location configured"
            detail="Required for inter-branch and in-transit inventory movement."
          />

          <CheckRow
            done={hasReceiving}
            required
            label="Receiving-capable stock location"
            detail="Required for GRN and stock transfer receiving."
          />

          <CheckRow
            done={hasIssue}
            required
            label="Issue-capable stock location"
            detail="Required for SIV, POS consumption, and production issue."
          />

          <CheckRow
            done={hasConsumptionLocation}
            label="Consumption location"
            detail="Recommended for recipe and production consumption."
          />

          <CheckRow
            done={hasProductionSource}
            label="Main warehouse for production"
            detail="Recommended when production/kitchen preparation is enabled."
          />

          <CheckRow
            done={hasStore}
            required
            label="At least one POS/store configured"
            detail="A branch may have one or many POS/stores."
          />

          <CheckRow
            done={hasIssueHierarchy}
            required={hasStore}
            label="POS issue hierarchy configured"
            detail="Passes if item/category rules, POS fallback, branch default issue location, or issue-capable location exists."
          />

          <CheckRow
            done={hasActiveUser}
            required
            label="At least one active operational user"
          />

          <CheckRow
            done={hasUserBranch}
            required
            label="User branch assignment"
            detail="At least one active user must be assigned to an active branch."
          />

          <CheckRow
            done={hasUserLocation}
            required
            label="User stock-location assignment"
            detail="At least one active user must be assigned to an active stock location."
          />

          <CheckRow
            done={hasCompanyAdmin}
            label="Company administrator assigned"
            detail="Recommended. Company administration can also be performed by a System Administrator."
          />
        </div>
      </div>

      {activateError && (
        <div className="ob-inner-card">
          <div className="ob-inner-card-body">
            <CheckRow
              done={false}
              required
              label="Activation failed"
              detail={activateError}
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn
          type="button"
          variant="primary"
          disabled={!canActivate || activating}
          onClick={handleActivate}
        >
          {activating
            ? "Activating…"
            : canActivate
              ? "Activate company"
              : "Complete required setup"}
        </Btn>
      </div>
    </div>
  );
}