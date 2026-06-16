// src/modules/company/pages/BranchManagementDashboardPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppContext } from "../../../app/AppContext";
import { useAppScope } from "../../../app/useAppScope";

import { branchesApi } from "../api/branchesApi";
import { stockLocationsApi } from "../api/stockLocationsApi";
import { onboardingApi } from "../onboarding/api/onboardingApi";

import type {
  BranchDto,
  StockLocation,
  StoreDto,
} from "../types/company.types";

import type { CompanyUserDto } from "../onboarding/api/onboardingApi";

import {
  Alert,
  Btn,
  EmptyState,
  Field,
  InfoRow,
  Input,
  PageShell,
  TextArea,
} from "./components/company.ui";

import {
  extractApiError,
  trimOrNull,
} from "../utils/company.utils";

import "./company-onboarding.css";

type TabKey = "overview" | "locations" | "stores" | "users" | "settings";

function idOf(x: unknown): string {
  const value = x as any;
  return String(value?.id ?? value?.Id ?? value?.userId ?? "");
}

function isActive(x: unknown): boolean {
  return (x as any)?.isActive !== false;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function locationTypeOf(location: StockLocation): string {
  const raw = (location as any).locationType ?? (location as any).type;
  return normalize(raw);
}

function isWarehouse(location: StockLocation): boolean {
  return locationTypeOf(location) === "warehouse";
}

function isTransit(location: StockLocation): boolean {
  return locationTypeOf(location) === "transit";
}

function isIssueCapable(location: StockLocation): boolean {
  return (location as any).canIssue === true;
}

function isReceiveCapable(location: StockLocation): boolean {
  return (location as any).canReceive === true;
}

function belongsToBranch(location: StockLocation, branchId: string): boolean {
  const assignedBranchId = String((location as any).branchId ?? "");
  return assignedBranchId === branchId;
}

function mappedIssueLocationId(store: StoreDto): string {
  const x = store as any;

  return String(
    x.issueStockLocationId ??
      x.defaultIssueStockLocationId ??
      x.issueLocationId ??
      x.defaultStockLocationId ??
      x.issueLocation?.id ??
      "",
  );
}

function rolesOf(user: any): string[] {
  if (Array.isArray(user?.roles)) {
    return user.roles.map(String).filter(Boolean);
  }

  if (typeof user?.roles === "string") {
    return user.roles
      .split(",")
      .map((x: string) => x.trim())
      .filter(Boolean);
  }

  return [user?.role, user?.roleName, user?.primaryRole]
    .filter(Boolean)
    .map(String);
}

function hasRole(user: unknown, roleName: string): boolean {
  return rolesOf(user).some(
    (role) => role.toLowerCase() === roleName.toLowerCase(),
  );
}

function userDisplayName(user: CompanyUserDto): string {
  return (
    (user as any).employeeName ??
    user.userName ??
    user.email ??
    "—"
  );
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export default function BranchManagementDashboardPage() {
  const nav = useNavigate();
  const params = useParams<{ companyId: string; branchId: string }>();

  const { companyId: ctxCompanyId, branchId: ctxBranchId } = useAppContext();
  const { companyId: scopeCompanyId } = useAppScope();

  const companyId = params.companyId ?? ctxCompanyId ?? scopeCompanyId ?? "";
  const branchId = params.branchId ?? ctxBranchId ?? "";

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [branch, setBranch] = useState<BranchDto | null>(null);
  const [companyLocations, setCompanyLocations] = useState<StockLocation[]>([]);
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [users, setUsers] = useState<CompanyUserDto[]>([]);

  const branchLocations = useMemo(
    () => companyLocations.filter((x) => belongsToBranch(x, branchId)),
    [companyLocations, branchId],
  );

  const unassignedLocations = useMemo(
    () => companyLocations.filter((x) => !(x as any).branchId),
    [companyLocations],
  );

  const load = useCallback(async () => {
    if (!companyId || !branchId) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const [branchResult, locationsResult, storesResult, usersResult] =
        await Promise.all([
          branchesApi.get(companyId, branchId),
          stockLocationsApi.list(companyId),
          onboardingApi.listStores(companyId, branchId).catch(() => []),
          onboardingApi.listBranchUsers(companyId, branchId).catch(() => []),
        ]);

      setBranch(branchResult);
      setCompanyLocations(Array.isArray(locationsResult) ? locationsResult : []);
      setStores(Array.isArray(storesResult) ? storesResult : []);
      setUsers(Array.isArray(usersResult) ? usersResult : []);
    } catch (err) {
      setError(extractApiError(err, "Failed to load branch dashboard."));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    const activeBranchLocations = branchLocations.filter(isActive);
    const activeStores = stores.filter(isActive);
    const activeUsers = users.filter(isActive);

    const hasWarehouse = activeBranchLocations.some(isWarehouse);
    const hasReceivingLocation = activeBranchLocations.some(isReceiveCapable);
    const hasIssueLocation = activeBranchLocations.some(isIssueCapable);

    const storesMapped =
      activeStores.length > 0 &&
      activeStores.every((store) => {
        const mappedId = mappedIssueLocationId(store);
        return Boolean(
          mappedId &&
            activeBranchLocations.some((location) => idOf(location) === mappedId),
        );
      });

    const hasBranchAdmin = activeUsers.some((user) =>
      hasRole(user, "BranchAdmin"),
    );

    const readinessItems = [
      hasWarehouse,
      hasReceivingLocation,
      hasIssueLocation,
      activeStores.length > 0,
      storesMapped,
      activeUsers.length > 0,
      hasBranchAdmin,
    ];

    const readyCount = readinessItems.filter(Boolean).length;

    return {
      activeBranchLocations,
      activeStores,
      activeUsers,
      companyLocations,
      branchLocations,
      unassignedLocations,
      hasWarehouse,
      hasReceivingLocation,
      hasIssueLocation,
      storesMapped,
      hasBranchAdmin,
      readinessPercent: Math.round((readyCount / readinessItems.length) * 100),
      canOperate:
        hasWarehouse &&
        hasReceivingLocation &&
        hasIssueLocation &&
        activeStores.length > 0 &&
        storesMapped &&
        activeUsers.length > 0 &&
        hasBranchAdmin,
    };
  }, [branchLocations, stores, users, companyLocations, unassignedLocations]);

  if (!companyId || !branchId) {
    return (
      <PageShell title="Branch management">
        <Alert
          tone="danger"
          title="Missing branch context"
          message="Open this page from a valid company and branch."
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={branch?.name ?? "Branch management"}
      subtitle="ERP branch operations, locations, stores, users, and readiness"
    >
      {error && <Alert tone="danger" title="Error" message={error} />}
      {notice && <Alert tone="ok" title="Saved" message={notice} />}

      <div className="ob-layout">
        <div className="ob-sidebar">
          {[
            ["overview", "Overview"],
            ["locations", "Stock locations"],
            ["stores", "Stores"],
            ["users", "Users"],
            ["settings", "Settings"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`ob-side-step ${
                activeTab === key ? "ob-side-step--active" : ""
              }`}
              onClick={() => setActiveTab(key as TabKey)}
            >
              <span className="ob-side-step-title">{label}</span>
            </button>
          ))}
        </div>

        <div className="ob-card">
          <div className="ob-card-header">
            <div className="ob-card-title">
              {activeTab === "overview" && "Branch overview"}
              {activeTab === "locations" && "Stock locations"}
              {activeTab === "stores" && "Stores"}
              {activeTab === "users" && "Branch users"}
              {activeTab === "settings" && "Branch settings"}
            </div>

            <div className="ob-card-subtitle">
              {loading ? "Loading…" : branch?.code ?? "Operational dashboard"}
            </div>
          </div>

          <div className="ob-card-body">
            {activeTab === "overview" && (
              <OverviewPanel
                branch={branch}
                metrics={metrics}
                onGoLocations={() => setActiveTab("locations")}
                onGoStores={() => setActiveTab("stores")}
                onGoUsers={() => setActiveTab("users")}
              />
            )}

            {activeTab === "locations" && (
              <LocationsPanel
                companyId={companyId}
                branchId={branchId}
                branchLocations={branchLocations}
                unassignedLocations={unassignedLocations}
                onRefresh={load}
                onNotice={setNotice}
                onError={setError}
              />
            )}

            {activeTab === "stores" && (
              <StoresPanel
                stores={stores}
                locations={branchLocations}
              />
            )}

            {activeTab === "users" && (
              <UsersPanel users={users} />
            )}

            {activeTab === "settings" && branch && (
              <BranchSettingsPanel
                companyId={companyId}
                branchId={branchId}
                branch={branch}
                busy={busy}
                setBusy={setBusy}
                onUpdated={(updated) => {
                  setBranch(updated);
                  setNotice("Branch updated.");
                }}
                onError={setError}
              />
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 20,
              }}
            >
              <Btn variant="ghost" onClick={() => nav(-1)}>
                Back
              </Btn>

              <Btn variant="primary" onClick={() => void load()} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function OverviewPanel(props: {
  branch: BranchDto | null;
  metrics: {
    activeBranchLocations: StockLocation[];
    activeStores: StoreDto[];
    activeUsers: CompanyUserDto[];
    companyLocations: StockLocation[];
    branchLocations: StockLocation[];
    unassignedLocations: StockLocation[];
    hasWarehouse: boolean;
    hasReceivingLocation: boolean;
    hasIssueLocation: boolean;
    storesMapped: boolean;
    hasBranchAdmin: boolean;
    readinessPercent: number;
    canOperate: boolean;
  };
  onGoLocations: () => void;
  onGoStores: () => void;
  onGoUsers: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="ob-grid-3">
        <KpiCard
          label="Readiness"
          value={`${props.metrics.readinessPercent}%`}
          tone={props.metrics.canOperate ? "ok" : "warn"}
        />
        <KpiCard
          label="Assigned locations"
          value={String(props.metrics.activeBranchLocations.length)}
        />
        <KpiCard
          label="Active stores"
          value={String(props.metrics.activeStores.length)}
        />
        <KpiCard
          label="Active users"
          value={String(props.metrics.activeUsers.length)}
        />
      </div>

      <div className="ob-inner-card">
        <div className="ob-inner-card-header">
          <div className="ob-inner-card-title">Branch profile</div>
        </div>

        <div className="ob-inner-card-body">
          <InfoRow label="Name" value={props.branch?.name ?? "—"} />
          <InfoRow label="Code" value={props.branch?.code ?? "—"} />
          <InfoRow label="City" value={props.branch?.city ?? "—"} />
          <InfoRow label="Region" value={props.branch?.region ?? "—"} />
          <InfoRow label="Main branch" value={props.branch?.isMain ? "Yes" : "No"} />
          <InfoRow
            label="Status"
            value={props.branch?.isActive === false ? "Inactive" : "Active"}
          />
        </div>
      </div>

      <div className="ob-inner-card">
        <div className="ob-inner-card-header">
          <div className="ob-inner-card-title">Operational readiness</div>
        </div>

        <div className="ob-inner-card-body">
          <CheckLine done={props.metrics.hasWarehouse} text="Warehouse assigned to this branch" />
          <CheckLine done={props.metrics.hasReceivingLocation} text="Receiving-capable location assigned" />
          <CheckLine done={props.metrics.hasIssueLocation} text="Issue-capable location assigned" />
          <CheckLine done={props.metrics.activeStores.length > 0} text="At least one active store exists" />
          <CheckLine done={props.metrics.storesMapped} text="Stores are mapped to branch issue locations" />
          <CheckLine done={props.metrics.activeUsers.length > 0} text="At least one active user exists" />
          <CheckLine done={props.metrics.hasBranchAdmin} text="At least one BranchAdmin assigned" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="ghost" onClick={props.onGoLocations}>Manage locations</Btn>
        <Btn variant="ghost" onClick={props.onGoStores}>Manage stores</Btn>
        <Btn variant="ghost" onClick={props.onGoUsers}>Manage users</Btn>
      </div>
    </div>
  );
}

function LocationsPanel(props: {
  companyId: string;
  branchId: string;
  branchLocations: StockLocation[];
  unassignedLocations: StockLocation[];
  onRefresh: () => Promise<void>;
  onNotice: (value: string | null) => void;
  onError: (value: string | null) => void;
}) {
  async function assignToBranch(location: StockLocation) {
    props.onError(null);
    props.onNotice(null);

    try {
      await stockLocationsApi.update(props.companyId, idOf(location), {
        ...(location as any),
        branchId: props.branchId,
      });

      props.onNotice("Stock location assigned to branch.");
      await props.onRefresh();
    } catch (err) {
      props.onError(extractApiError(err, "Failed to assign location to branch."));
    }
  }

  async function unassignFromBranch(location: StockLocation) {
    props.onError(null);
    props.onNotice(null);

    try {
      await stockLocationsApi.update(props.companyId, idOf(location), {
        ...(location as any),
        branchId: null,
      });

      props.onNotice("Stock location removed from branch.");
      await props.onRefresh();
    } catch (err) {
      props.onError(extractApiError(err, "Failed to remove location from branch."));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <SectionTitle title="Assigned branch locations" />

        {props.branchLocations.length === 0 ? (
          <EmptyState
            title="No assigned stock locations"
            sub="Assign an existing company location to this branch, or create a new location from the setup page."
          />
        ) : (
          <LocationList
            locations={props.branchLocations}
            actionLabel="Remove"
            onAction={unassignFromBranch}
          />
        )}
      </div>

      <div>
        <SectionTitle title="Available company locations" />

        {props.unassignedLocations.length === 0 ? (
          <EmptyState
            title="No unassigned company locations"
            sub="All active company stock locations are already assigned or there are no company-level locations available."
          />
        ) : (
          <LocationList
            locations={props.unassignedLocations}
            actionLabel="Assign"
            onAction={assignToBranch}
          />
        )}
      </div>
    </div>
  );
}

function LocationList(props: {
  locations: StockLocation[];
  actionLabel: string;
  onAction: (location: StockLocation) => void | Promise<void>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {props.locations.map((location: any) => (
        <div key={idOf(location)} className="ob-list-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              {location.name}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {location.code} · {location.locationType}
            </div>
          </div>

          <span
            className={
              location.isActive === false
                ? "ob-badge ob-badge--warn"
                : "ob-badge ob-badge--success"
            }
          >
            {location.isActive === false ? "Inactive" : "Active"}
          </span>

          {location.canReceive && <span className="ob-badge">Receive</span>}
          {location.canIssue && <span className="ob-badge">Issue</span>}
          {location.canSell && <span className="ob-badge">Sell</span>}
          {location.canProduce && <span className="ob-badge">Produce</span>}

          <Btn variant="ghost" onClick={() => void props.onAction(location)}>
            {props.actionLabel}
          </Btn>
        </div>
      ))}
    </div>
  );
}

function StoresPanel(props: {
  stores: StoreDto[];
  locations: StockLocation[];
}) {
  if (props.stores.length === 0) {
    return (
      <EmptyState
        title="No stores"
        sub="Create POS, dine-in, takeaway, bar, or retail stores from the setup page."
      />
    );
  }

  function locationName(id: string): string {
    return (
      (props.locations.find((x) => idOf(x) === id) as any)?.name ??
      "Not mapped"
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {props.stores.map((store: any) => {
        const mappedId = mappedIssueLocationId(store);

        return (
          <div key={idOf(store)} className="ob-list-row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {store.name}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {store.code ?? "—"} · {store.locationType ?? store.storeType ?? "Store"}
              </div>
            </div>

            <span
              className={
                mappedId ? "ob-badge ob-badge--success" : "ob-badge ob-badge--warn"
              }
            >
              Issue: {mappedId ? locationName(mappedId) : "Not mapped"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function UsersPanel(props: {
  users: CompanyUserDto[];
}) {
  if (props.users.length === 0) {
    return (
      <EmptyState
        title="No users assigned"
        sub="Assign employee login accounts to this branch from user management."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {props.users.map((user) => {
        const name = userDisplayName(user);
        const roles = rolesOf(user);

        return (
          <div key={user.id} className="ob-list-row">
            <div
              className={`ob-avatar ${
                hasRole(user, "BranchAdmin")
                  ? "ob-avatar--admin"
                  : "ob-avatar--staff"
              }`}
            >
              {initials(name)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {name}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {user.email || user.userName}
              </div>
            </div>

            {roles.length > 0 ? (
              roles.map((role) => (
                <span
                  key={role}
                  className={
                    role === "BranchAdmin"
                      ? "ob-badge ob-badge--success"
                      : "ob-badge"
                  }
                >
                  {role}
                </span>
              ))
            ) : (
              <span className="ob-badge ob-badge--warn">No role</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BranchSettingsPanel(props: {
  companyId: string;
  branchId: string;
  branch: BranchDto;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onUpdated: (branch: BranchDto) => void;
  onError: (value: string | null) => void;
}) {
  const [form, setForm] = useState({
    code: props.branch.code ?? "",
    name: props.branch.name ?? "",
    city: props.branch.city ?? "",
    region: props.branch.region ?? "",
    addressLine: props.branch.addressLine ?? "",
    isMain: props.branch.isMain ?? false,
  });

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      props.onError("Branch code and branch name are required.");
      return;
    }

    props.setBusy(true);
    props.onError(null);

    try {
    await branchesApi.update(props.companyId, props.branchId, {
  code: form.code.trim().toUpperCase(),
  name: form.name.trim(),
  city: trimOrNull(form.city),
  region: trimOrNull(form.region),
  addressLine: trimOrNull(form.addressLine),
  isMain: form.isMain,
});

const updated = await branchesApi.get(props.companyId, props.branchId);

props.onUpdated(updated);
      props.onUpdated(updated);
    } catch (err) {
      props.onError(extractApiError(err, "Failed to update branch."));
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="ob-grid-auto">
        <Field label="Branch code" required>
          <Input
            value={form.code}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                code: value.toUpperCase(),
              }))
            }
            disabled={props.busy}
          />
        </Field>

        <Field label="Branch name" required>
          <Input
            value={form.name}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                name: value,
              }))
            }
            disabled={props.busy}
          />
        </Field>

        <Field label="City">
          <Input
            value={form.city}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                city: value,
              }))
            }
            disabled={props.busy}
          />
        </Field>

        <Field label="Region">
          <Input
            value={form.region}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                region: value,
              }))
            }
            disabled={props.busy}
          />
        </Field>
      </div>

      <Field label="Address line">
        <TextArea
          value={form.addressLine}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              addressLine: value,
            }))
          }
          rows={3}
          disabled={props.busy}
        />
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={save} disabled={props.busy}>
          {props.busy ? "Saving…" : "Save branch settings"}
        </Btn>
      </div>
    </div>
  );
}

function SectionTitle(props: { title: string }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: "#0f172a",
        marginBottom: 10,
      }}
    >
      {props.title}
    </div>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background:
          props.tone === "ok"
            ? "#f0fdf4"
            : props.tone === "warn"
              ? "#fffbeb"
              : "#fff",
        padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
        {props.label}
      </div>
      <div style={{ fontSize: 24, color: "#0f172a", fontWeight: 800 }}>
        {props.value}
      </div>
    </div>
  );
}

function CheckLine(props: { done: boolean; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 0",
        fontSize: 12,
        color: props.done ? "#166534" : "#991b1b",
      }}
    >
      <span>{props.done ? "✓" : "✕"}</span>
      <span>{props.text}</span>
    </div>
  );
}