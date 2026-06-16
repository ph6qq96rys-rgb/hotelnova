// src/pages/platform/platformTenantsApi.ts

import { http } from "../../../../../api/http";

export type PlatformTenantDto = {
  companyId: string;
  tenantSlug: string;
  name: string;
};

export type SwitchTenantResponse = {
  accessToken: string;
  expiresAtUtc: string;
  companyId: string;
  tenantSlug: string;
};

const BASE = "/platform/tenants";

export const platformTenantsApi = {
  async list(signal?: AbortSignal): Promise<PlatformTenantDto[]> {
    const response = await http.get<PlatformTenantDto[]>(BASE, { signal });
    return Array.isArray(response.data) ? response.data : [];
  },

  async switchTenant(
    tenantSlug: string,
    signal?: AbortSignal
  ): Promise<SwitchTenantResponse> {
    const response = await http.post<SwitchTenantResponse>(
      `${BASE}/${encodeURIComponent(tenantSlug)}/switch`,
      {},
      { signal }
    );

    return response.data;
  },
};