// src/modules/company/onboarding/steps/ReviewStep.tsx

import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import type {
  OnboardingReadiness,
  OnboardingState,
} from "../state/onboarding.types";
import { Btn, EmptyState, InfoRow } from "../components/company.ui";

function text(value: unknown, fallback = "—"): string {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function getId(x: any): string {
  return String(x?.id ?? x?.Id ?? x?.userId ?? x?.employeeId ?? "");
}

function nameOf(x: any): string {
  return text(
    x?.employeeName ??
      x?.employee?.fullName ??
      x?.fullName ??
      x?.name ??
      x?.userName ??
      x?.email,
  );
}

function getRoles(x: any): string[] {
  if (Array.isArray(x?.roles)) return x.roles.filter(Boolean).map(String);

  if (typeof x?.roles === "string") {
    return x.roles
      .split(",")
      .map((r: string) => r.trim())
      .filter(Boolean);
  }

  return [x?.role, x?.roleName, x?.primaryRole].filter(Boolean).map(String);
}

function hasRole(x: any, roleName: string): boolean {
  const expected = roleName.trim().toLowerCase();

  return getRoles(x).some((role) => {
    const current = role.trim().toLowerCase();

    if (expected === "companyadmin") {
      return (
        current === "companyadmin" ||
        current === "companyadministrator" ||
        current === "admin"
      );
    }

    return current === expected;
  });
}

function isActiveEntity(x: any): boolean {
  return (
    x?.isActive === true ||
    x?.isActive === undefined ||
    String(x?.status ?? "").toLowerCase() === "active"
  );
}

function isOperationalMissingItem(item: string): boolean {
  const value = item.toLowerCase();

  return (
    value.includes("transit") ||
    value.includes("company admin") ||
    value.includes("branch assignment") ||
    value.includes("branch access") ||
    value.includes("assigned to branch") ||
    value.includes("stock location") ||
    value.includes("stock-location") ||
    value.includes("assigned to a stock location")
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
    <CheckCircle size={16} color="#16a34a" style={{ flexShrink: 0 }} />
  ) : required ? (
    <XCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
  ) : (
    <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0 }} />
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      {icon}

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
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

      {required && !props.done && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#dc2626",
            background: "#fef2f2",
            padding: "1px 7px",
            borderRadius: 999,
            border: "1px solid #fecaca",
          }}
        >
          Required
        </span>
      )}

      {!required && !props.done && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#92400e",
            background: "#fffbeb",
            padding: "1px 7px",
            borderRadius: 999,
            border: "1px solid #fde68a",
          }}
        >
          Later
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
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #f1f5f9",
          background: "#fafbfc",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
          {props.title}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          {props.count} {props.unit}
          {props.count !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ padding: "8px 16px", maxHeight: 240, overflowY: "auto" }}>
        {props.children}
      </div>
    </div>
  );
}

function MiniRow(props: {
  label: string;
  badge: string;
  badgeTone: "success" | "warn" | "default" | "info";
  sub?: string;
}) {
  const cls =
    props.badgeTone === "success"
      ? "ob-badge ob-badge--success"
      : props.badgeTone === "warn"
        ? "ob-badge ob-badge--warn"
        : props.badgeTone === "info"
          ? "ob-badge ob-badge--info"
          : "ob-badge";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid #f8fafc",
        fontSize: 12,
        color: "#334155",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span>{props.label}</span>
        {props.sub && (
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "#94a3b8",
              marginTop: 1,
            }}
          >
            {props.sub}
          </span>
        )}
      </span>

      <span className={cls}>{props.badge}</span>
    </div>
  );
}

export function ReviewStep(props: {
  state: OnboardingState;
  readiness: OnboardingReadiness;
  onFinish: () => void;
}) {
  const { state } = props;

  const backendReadiness = state.readiness as any;

  const locations = state.stockLocations ?? [];
  const stores = state.stores ?? [];
  const members = state.members ?? [];

  const hasCompany =
    backendReadiness?.hasCompany === true ||
    props.readiness.company?.done === true ||
    Boolean(state.companyId || state.company);

  const hasBranch =
    backendReadiness?.hasActiveBranch === true ||
    props.readiness.branch?.done === true ||
    Boolean(state.branchId || state.branch);

  const hasActiveWarehouse =
    backendReadiness?.hasActiveWarehouse === true ||
    locations.some(
      (x: any) =>
        String(x.locationType ?? x.type ?? "").toLowerCase() === "warehouse" &&
        isActiveEntity(x),
    );

  const hasTransitLocation =
    backendReadiness?.hasTransitLocation === true ||
    locations.some(
      (x: any) =>
        String(x.locationType ?? x.type ?? "").toLowerCase() === "transit" &&
        isActiveEntity(x),
    );

  const hasStore =
    backendReadiness?.hasActiveStore === true ||
    props.readiness.stores?.done === true ||
    stores.some((x: any) => isActiveEntity(x));

  const hasActiveUser =
    backendReadiness?.hasActiveUser === true ||
    props.readiness.users?.done === true ||
    members.some((x: any) => isActiveEntity(x));

  const hasUserBranchAssignment =
    backendReadiness?.hasUserBranchAssignment === true ||
    members.some((x: any) =>
      Boolean(x.defaultBranchId ?? x.branchId ?? x.branchIds?.length),
    );

  const hasUserStockLocationAssignment =
    backendReadiness?.hasUserStockLocationAssignment === true ||
    members.some((x: any) =>
      Boolean(
        x.defaultStockLocationId ??
          x.stockLocationId ??
          x.stockLocationIds?.length,
      ),
    );

  const hasCompanyAdmin =
    backendReadiness?.hasCompanyAdmin === true ||
    members.some((member: any) => hasRole(member, "CompanyAdmin"));

  const canActivate =
    hasCompany &&
    hasBranch &&
    hasActiveWarehouse &&
    hasStore &&
    hasActiveUser;

  const missingItems: string[] = Array.isArray(backendReadiness?.missingItems)
    ? backendReadiness.missingItems
    : [];

  const blockingMissingItems = missingItems.filter(
    (item) => !isOperationalMissingItem(item),
  );

  const warningMissingItems = missingItems.filter((item) =>
    isOperationalMissingItem(item),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="ob-grid-2">
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fafbfc",
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Company
          </div>

          <div style={{ padding: "12px 16px" }}>
            <InfoRow label="Name" value={state.company?.legalName ?? "—"} />
            <InfoRow label="Currency" value={state.company?.defaultCurrency ?? "ETB"} />
            <InfoRow label="Timezone" value={(state.company as any)?.timezone ?? "—"} />
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fafbfc",
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Branch
          </div>

          <div style={{ padding: "12px 16px" }}>
            <InfoRow label="Name" value={(state.branch as any)?.name ?? "—"} />
            <InfoRow label="Code" value={(state.branch as any)?.code ?? "—"} />
            <InfoRow label="City" value={(state.branch as any)?.city ?? "—"} />
          </div>
        </div>
      </div>

      <div className="ob-grid-3">
        <SummaryCard title="Stock locations" count={locations.length} unit="location">
          {locations.length > 0 ? (
            locations.map((location: any) => (
              <MiniRow
                key={getId(location)}
                label={`${text(location.name)}${location.code ? ` (${location.code})` : ""}`}
                sub={text(location.locationType ?? location.type)}
                badge={isActiveEntity(location) ? "Active" : "Inactive"}
                badgeTone={isActiveEntity(location) ? "success" : "warn"}
              />
            ))
          ) : (
            <EmptyState
              title="No locations"
              sub="Add at least one warehouse. Transit can be configured later."
            />
          )}
        </SummaryCard>

        <SummaryCard title="Stores" count={stores.length} unit="store">
          {stores.length > 0 ? (
            stores.map((store: any) => (
              <MiniRow
                key={getId(store)}
                label={`${text(store.name)}${store.code ? ` (${store.code})` : ""}`}
                sub={text(store.locationType ?? store.storeType)}
                badge={isActiveEntity(store) ? "Active" : "Inactive"}
                badgeTone={isActiveEntity(store) ? "success" : "warn"}
              />
            ))
          ) : (
            <EmptyState title="No stores" sub="Add at least one POS or sales store." />
          )}
        </SummaryCard>

        <SummaryCard title="Employee login accounts" count={members.length} unit="user">
          {members.length > 0 ? (
            members.map((member: any) => {
              const roles = getRoles(member);
              const isCompanyAdmin = hasRole(member, "CompanyAdmin");

              return (
                <MiniRow
                  key={getId(member) || member.email}
                  label={nameOf(member)}
                  sub={text(member.email ?? member.userName)}
                  badge={isCompanyAdmin ? "Company Admin" : roles[0] ?? "Staff"}
                  badgeTone={isCompanyAdmin ? "success" : "default"}
                />
              );
            })
          ) : (
            <EmptyState
              title="No user accounts"
              sub="Create at least one active login account."
            />
          )}
        </SummaryCard>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
          padding: "14px 16px",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          Activation readiness
        </div>

        <CheckRow done={hasCompany} required label="Company created" />
        <CheckRow done={hasBranch} required label="Active branch created" />
        <CheckRow done={hasActiveWarehouse} required label="Active warehouse exists" />
        <CheckRow done={hasStore} required label="Active store created" />
        <CheckRow done={hasActiveUser} required label="Active user account created" />

        <div style={{ height: 10 }} />

        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "8px 0" }}>
          Operational readiness
        </div>

        <CheckRow
          done={hasTransitLocation}
          label="Transit location exists"
          detail="Required later for stock transfers and in-transit inventory movement."
        />

        <CheckRow
          done={hasUserBranchAssignment}
          label="User assigned to branch"
          detail="Branch access can be configured after company activation."
        />

        <CheckRow
          done={hasUserStockLocationAssignment}
          label="User assigned to stock location"
          detail="Stock-location access can be configured after company activation."
        />

        <CheckRow
          done={hasCompanyAdmin}
          label="Company Admin assigned"
          detail="Recommended for delegated company administration."
        />
      </div>

      {blockingMissingItems.length > 0 && (
        <div
          style={{
            border: "1px solid #fecaca",
            borderRadius: 12,
            background: "#fef2f2",
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
            Required setup items
          </div>

          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#b91c1c", fontSize: 12 }}>
            {blockingMissingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {warningMissingItems.length > 0 && (
        <div
          style={{
            border: "1px solid #fde68a",
            borderRadius: 12,
            background: "#fffbeb",
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
            Setup items you can complete later
          </div>

          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#92400e", fontSize: 12 }}>
            {warningMissingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          border: canActivate ? "1px solid #bbf7d0" : "1px solid #fecaca",
          borderRadius: 12,
          background: canActivate ? "#f0fdf4" : "#fef2f2",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: canActivate ? "#166534" : "#991b1b",
            }}
          >
            {canActivate ? "Ready to activate company" : "Setup is incomplete"}
          </div>

          <div
            style={{
              fontSize: 11,
              color: canActivate ? "#15803d" : "#b91c1c",
              marginTop: 2,
            }}
          >
            {canActivate
              ? "Core company setup is complete. Advanced ERP configuration can continue after activation."
              : "Complete the required activation checks before activating this company."}
          </div>
        </div>

        <Btn variant="primary" onClick={props.onFinish} disabled={!canActivate}>
          Activate company
        </Btn>
      </div>
    </div>
  );
}