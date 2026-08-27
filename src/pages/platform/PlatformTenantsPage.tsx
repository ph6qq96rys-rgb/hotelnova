// src/features/platform/PlatformTenantsPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { http } from "../../api/http";
import type { WorkspaceAuth } from "../../auth/workspace-auth.storage";
import { useAppContext } from "../../app/AppContext";

import "../../styles/platform-tenants.css";

type TenantDto = {
  companyId: string;
  tenantSlug: string;
  name: string;
};

type SwitchTenantResponse = {
  token?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAtUtc?: string | null;

  companyId?: string | null;
  companyName?: string | null;

  branchId?: string | null;
  branchName?: string | null;

  tenantSlug?: string | null;

  roles?: string[];
  permissions?: string[];

  elevated?: boolean;
  authScope?: string;
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function normalizeTenantSlug(value: unknown): string | null {
  return clean(value)?.toLowerCase() ?? null;
}

function resolveAccessToken(
  response: SwitchTenantResponse,
): string {
  const token =
    clean(response.accessToken) ??
    clean(response.token);

  if (!token) {
    throw new Error(
      "Tenant switch did not return an access token.",
    );
  }

  return token;
}

function toWorkspaceAuth(
  response: SwitchTenantResponse,
  fallbackTenant: TenantDto,
): WorkspaceAuth {
  const companyId =
    clean(response.companyId) ??
    clean(fallbackTenant.companyId);

  if (!companyId) {
    throw new Error(
      "Tenant switch succeeded, but no company ID was returned.",
    );
  }

  const tenantSlug =
    normalizeTenantSlug(response.tenantSlug) ??
    normalizeTenantSlug(fallbackTenant.tenantSlug);

  if (!tenantSlug) {
    throw new Error(
      "Tenant switch succeeded, but no tenant slug was returned.",
    );
  }

  const expiresAt = clean(response.expiresAtUtc);

  if (!expiresAt) {
    throw new Error(
      "Tenant switch succeeded, but no token expiry was returned.",
    );
  }

  return {
    accessToken: resolveAccessToken(response),
    refreshToken: clean(response.refreshToken),
    expiresAt,

    companyId,
    companyName:
      clean(response.companyName) ??
      clean(fallbackTenant.name) ??
      "Tenant workspace",

    tenantSlug,

    branchId: clean(response.branchId),
    branchName: clean(response.branchName),

    roles: Array.isArray(response.roles)
      ? response.roles.filter(Boolean).map(String)
      : [],

    permissions: Array.isArray(response.permissions)
      ? response.permissions.filter(Boolean).map(String)
      : [],
  };
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            error?: string;
            message?: string;
            detail?: string;
            title?: string;
            errors?: unknown;
          };
        };
      }
    ).response;

    const body = response?.data;

    if (body) {
      return (
        clean(body.error) ??
        clean(body.message) ??
        clean(body.detail) ??
        clean(body.title) ??
        fallback
      );
    }
  }

  return error instanceof Error
    ? error.message
    : fallback;
}

export default function PlatformTenantsPage() {
  const navigate = useNavigate();
  const { setWorkspace } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] =
    useState<string | null>(null);
  const [tenants, setTenants] =
    useState<TenantDto[]>([]);
  const [error, setError] =
    useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function loadTenants(active?: () => boolean): Promise<void> {
    try {
      setLoading(true);
      setError(null);

      const response = await http.get<TenantDto[]>(
        "/platform/tenants",
      );

      if (active && !active()) {
        return;
      }

      const rows = Array.isArray(response.data)
        ? response.data
        : [];

      setTenants(
        rows.filter(
          (tenant) =>
            Boolean(clean(tenant.companyId)) &&
            Boolean(
              normalizeTenantSlug(
                tenant.tenantSlug,
              ),
            ),
        ),
      );
    } catch (error) {
      if (active && !active()) {
        return;
      }

      console.error(
        "Failed to load tenant workspaces",
        error,
      );

      setError(
        getErrorMessage(
          error,
          "Failed to load tenant workspaces.",
        ),
      );
    } finally {
      if (!active || active()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let active = true;

    void loadTenants(() => active);

    return () => {
      active = false;
    };
  }, []);

  const filteredTenants = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return tenants;
    }

    return tenants.filter((tenant) => {
      return [
        tenant.name,
        tenant.tenantSlug,
        tenant.companyId,
      ].some((value) =>
        value?.toLowerCase().includes(needle),
      );
    });
  }, [query, tenants]);

  async function openWorkspace(
    tenant: TenantDto,
  ): Promise<void> {
    if (switching) {
      return;
    }

    const tenantSlug = normalizeTenantSlug(
      tenant.tenantSlug,
    );

    if (!tenantSlug) {
      setError(
        "The selected tenant does not have a valid tenant slug.",
      );
      return;
    }

    if (!clean(tenant.companyId)) {
      setError(
        "The selected tenant does not have a valid company ID.",
      );
      return;
    }

    try {
      setError(null);
      setSwitching(tenantSlug);

      /*
       * This request must use the current platform token.
       * Do not change the HTTP default token until the switch succeeds.
       */
      const response =
        await http.post<SwitchTenantResponse>(
          `/platform/tenants/${encodeURIComponent(
            tenantSlug,
          )}/switch`,
          {},
        );

      const workspaceAuth = toWorkspaceAuth(
        response.data,
        tenant,
      );

      /*
       * setWorkspace persists workspace authentication and updates
       * the same reactive AppContext state consumed by useAppScope().
       */
      setWorkspace(workspaceAuth);

      /*
       * Switch all subsequent API requests to the delegated
       * tenant workspace token immediately.
       */
      http.defaults.headers.common.Authorization =
        `Bearer ${workspaceAuth.accessToken}`;

      navigate(
        `/companies/${encodeURIComponent(
          workspaceAuth.companyId,
        )}/dashboard`,
        {
          replace: true,
        },
      );
    } catch (error) {
      console.error(
        "Failed to switch tenant workspace",
        error,
      );

      setError(
        getErrorMessage(
          error,
          "Failed to open workspace. Please check your permissions.",
        ),
      );
    } finally {
      setSwitching(null);
    }
  }

  function startNewTenant(): void {
    navigate("/companies/onboarding", {
      replace: false,
    });
  }

  return (
    <div className="platform-tenants-page">
      <header className="platform-tenants-hero">
        <div>
          <p className="platform-tenants-eyebrow">
            Platform administration
          </p>

          <h1>Tenant workspaces</h1>

          <p>
            Select an active tenant to enter its ERP workspace with delegated
            system-administrator access.
          </p>
        </div>

        <div className="platform-tenants-actions">
          <button
            type="button"
            className="platform-tenants-primary"
            onClick={startNewTenant}
          >
            <Plus size={16} aria-hidden="true" />
            New tenant
          </button>

          <button
            type="button"
            className="platform-tenants-refresh"
            onClick={() => void loadTenants()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="platform-tenants-alert"
        >
          {error}
        </div>
      )}

      <section className="platform-tenants-metrics" aria-label="Tenant summary">
        <article>
          <span>Total tenants</span>
          <strong>{tenants.length}</strong>
          <small>active registry entries</small>
        </article>

        <article>
          <span>Available now</span>
          <strong>{filteredTenants.length}</strong>
          <small>matching current filter</small>
        </article>

        <article>
          <span>Access scope</span>
          <strong>System</strong>
          <small>tenant switch requires SystemAdmin</small>
        </article>
      </section>

      <section className="platform-tenants-toolbar">
        <label className="platform-tenants-search">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tenant, workspace, or company id"
          />
        </label>
      </section>

      {loading ? (
        <div className="platform-tenants-state">
          Loading tenant registry...
        </div>
      ) : tenants.length === 0 ? (
        <div className="platform-tenants-state">
          No active tenants found.
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="platform-tenants-state">
          No tenants match this search.
        </div>
      ) : (
        <div className="platform-tenants-grid">
          {filteredTenants.map((tenant) => {
            const normalizedSlug =
              normalizeTenantSlug(
                tenant.tenantSlug,
              ) ?? "";

            const isOpening =
              switching === normalizedSlug;

            return (
              <article
                key={tenant.companyId}
                className="platform-tenant-card"
              >
                <div className="platform-tenant-card__main">
                  <div className="platform-tenant-card__icon">
                    <Building2 size={20} aria-hidden="true" />
                  </div>

                  <div className="platform-tenant-card__copy">
                    <div className="platform-tenant-card__title-row">
                      <h2>{tenant.name}</h2>
                      <span>
                        <ShieldCheck size={14} aria-hidden="true" />
                        Active
                      </span>
                    </div>

                    <dl>
                      <div>
                        <dt>Workspace</dt>
                        <dd>{tenant.tenantSlug}</dd>
                      </div>
                      <div>
                        <dt>Registry ID</dt>
                        <dd>{tenant.companyId}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void openWorkspace(tenant)
                  }
                  disabled={Boolean(switching)}
                  aria-busy={isOpening}
                  className="platform-tenant-card__action"
                >
                  <span>
                    {isOpening
                      ? "Opening"
                      : "Open workspace"}
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
