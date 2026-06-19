import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { http } from "../../api/http";
import { loadAuth, saveAuth } from "../../auth/auth.storage";
import { useAppContext } from "../../app/AppContext";

type TenantDto = {
  companyId: string;
  tenantSlug: string;
  name: string;
};

type SwitchTenantResponse = {
  token?: string;
  accessToken?: string;
  refreshToken?: string | null;
  expiresAtUtc: string;
  companyId: string;
  companyName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  tenantSlug: string;
  roles?: string[];
  permissions?: string[];
};

function normalizeTenantSlug(value: string): string {
  return value.trim().toLowerCase();
}

function resolveAccessToken(response: SwitchTenantResponse): string {
  const token = response.accessToken ?? response.token;

  if (!token?.trim()) {
    throw new Error("Tenant switch did not return an access token.");
  }

  return token.trim();
}

function persistTenantStorage(response: SwitchTenantResponse): void {
  const tenantSlug = normalizeTenantSlug(response.tenantSlug);

  localStorage.setItem("tenantSlug", tenantSlug);
  sessionStorage.setItem("tenantSlug", tenantSlug);

  localStorage.setItem("companyId", response.companyId);
  sessionStorage.setItem("companyId", response.companyId);

  if (response.branchId) {
    localStorage.setItem("branchId", response.branchId);
    sessionStorage.setItem("branchId", response.branchId);
  } else {
    localStorage.removeItem("branchId");
    sessionStorage.removeItem("branchId");
  }
}

export default function PlatformTenantsPage() {
  const navigate = useNavigate();
  const { setCompany } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTenants() {
      try {
        setLoading(true);
        setError(null);

        const response = await http.get<TenantDto[]>("/platform/tenants");

        if (!mounted) return;

        setTenants(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Failed to load tenants", err);

        if (!mounted) return;

        setError("Failed to load tenant workspaces.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadTenants();

    return () => {
      mounted = false;
    };
  }, []);

  async function openWorkspace(tenant: TenantDto) {
    if (switching) return;

    try {
      setError(null);
      setSwitching(tenant.tenantSlug);

      const response = await http.post<SwitchTenantResponse>(
        `/platform/tenants/${encodeURIComponent(tenant.tenantSlug)}/switch`
      );

      const currentAuth = loadAuth();

      if (!currentAuth) {
        throw new Error("Authentication state not found.");
      }

      const accessToken = resolveAccessToken(response.data);
      const tenantSlug = normalizeTenantSlug(response.data.tenantSlug);

      const nextAuth = {
        ...currentAuth,

        accessToken,
        refreshToken: response.data.refreshToken ?? currentAuth.refreshToken,
        expiresAt: response.data.expiresAtUtc,

        companyId: response.data.companyId,
        companyName: response.data.companyName ?? tenant.name,
        tenantSlug,

        branchId: response.data.branchId ?? null,
        branchName: response.data.branchName ?? null,

        roles: response.data.roles ?? currentAuth.roles ?? [],
        permissions: response.data.permissions ?? currentAuth.permissions ?? [],
      };

      saveAuth(nextAuth);
      persistTenantStorage({
        ...response.data,
        tenantSlug,
      });

      setCompany({
        id: response.data.companyId,
        name: response.data.companyName ?? tenant.name,
        tenantSlug,
      });

      navigate(`/companies/${response.data.companyId}/dashboard`, {
        replace: true,
      });
    } catch (err) {
      console.error("Failed to switch workspace", err);
      setError("Failed to open workspace. Please check your permissions.");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1200px",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <h1>Platform Tenant Management</h1>
        <p>Select a tenant workspace to administer.</p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px",
            border: "1px solid #dc2626",
            borderRadius: "8px",
            marginBottom: "16px",
            color: "#991b1b",
            background: "#fef2f2",
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
            gap: "16px",
          }}
        >
          {tenants.map((tenant) => {
            const isOpening = switching === tenant.tenantSlug;

            return (
              <div
                key={tenant.companyId}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>{tenant.name}</h3>

                  <div
                    style={{
                      marginTop: "4px",
                      opacity: 0.7,
                    }}
                  >
                    {tenant.tenantSlug}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void openWorkspace(tenant)}
                  disabled={Boolean(switching)}
                >
                  {isOpening ? "Opening..." : "Open Workspace"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}