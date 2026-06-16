import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { http } from "../../api/http";
import { saveAuth, loadAuth } from "../../auth/auth.storage";
import { useAppContext } from "../../app/AppContext";

type TenantDto = {
  companyId: string;
  tenantSlug: string;
  name: string;
};

type SwitchTenantResponse = {
  accessToken: string;
  expiresAtUtc: string;
  companyId: string;
  tenantSlug: string;
};

export default function PlatformTenantsPage() {
  const navigate = useNavigate();

  const {
    setCompany,
  } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTenants() {
      try {
        setLoading(true);

        const response =
          await http.get<TenantDto[]>(
            "/platform/tenants"
          );

        if (!mounted) return;

        setTenants(response.data);
      } catch (err) {
        console.error(err);

        if (!mounted) return;

        setError(
          "Failed to load tenants."
        );
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

  async function openWorkspace(
    tenant: TenantDto
  ) {
    try {
      setSwitching(tenant.tenantSlug);

      const response =
        await http.post<SwitchTenantResponse>(
          `/platform/tenants/${tenant.tenantSlug}/switch`
        );

      const currentAuth = loadAuth();

      if (!currentAuth) {
        throw new Error(
          "Authentication state not found."
        );
      }

      saveAuth({
        ...currentAuth,
        accessToken: response.data.accessToken,
        expiresAt: response.data.expiresAtUtc,
        companyId: response.data.companyId,
      });

      localStorage.setItem(
        "tenantSlug",
        response.data.tenantSlug
      );

      setCompany({
        id: response.data.companyId,
        name: tenant.name,
        tenantSlug: response.data.tenantSlug,
      });

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      console.error(err);

      setError(
        "Failed to switch workspace."
      );
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
      <div
        style={{
          marginBottom: "24px",
        }}
      >
        <h1>
          Platform Tenant Management
        </h1>

        <p>
          Select a tenant workspace to
          administer.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            border: "1px solid #dc2626",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading tenants...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {tenants.map((tenant) => (
            <div
              key={tenant.companyId}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  {tenant.name}
                </h3>

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
                onClick={() =>
                  openWorkspace(tenant)
                }
                disabled={
                  switching ===
                  tenant.tenantSlug
                }
              >
                {switching ===
                tenant.tenantSlug
                  ? "Opening..."
                  : "Open Workspace"}
              </button>
            </div>
          ))}

          {tenants.length === 0 && (
            <div>
              No active tenants found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}