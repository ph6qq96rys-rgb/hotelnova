// src/features/platform/PlatformTenantsPage.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { http } from "../../api/http";
import type { WorkspaceAuth } from "../../auth/workspace-auth.storage";
import { useAppContext } from "../../app/AppContext";

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

  useEffect(() => {
    const controller = new AbortController();

    async function loadTenants(): Promise<void> {
      try {
        setLoading(true);
        setError(null);

        const response = await http.get<TenantDto[]>(
          "/platform/tenants",
          {
            signal: controller.signal,
          },
        );

        if (controller.signal.aborted) {
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
        if (controller.signal.aborted) {
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
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadTenants();

    return () => {
      controller.abort();
    };
  }, []);

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

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1200,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>
          Platform Tenant Management
        </h1>

        <p style={{ margin: 0, opacity: 0.72 }}>
          Select a tenant workspace to administer.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid #dc2626",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading tenants...</div>
      ) : tenants.length === 0 ? (
        <div>No active tenants found.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          {tenants.map((tenant) => {
            const normalizedSlug =
              normalizeTenantSlug(
                tenant.tenantSlug,
              ) ?? "";

            const isOpening =
              switching === normalizedSlug;

            return (
              <article
                key={tenant.companyId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: 16,
                  padding: 20,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#ffffff",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                    }}
                  >
                    {tenant.name}
                  </h2>

                  <div
                    style={{
                      marginTop: 4,
                      opacity: 0.7,
                    }}
                  >
                    {tenant.tenantSlug}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      opacity: 0.52,
                      fontSize: 12,
                      overflowWrap: "anywhere",
                    }}
                  >
                    Company ID: {tenant.companyId}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void openWorkspace(tenant)
                  }
                  disabled={Boolean(switching)}
                  aria-busy={isOpening}
                >
                  {isOpening
                    ? "Opening..."
                    : "Open Workspace"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
