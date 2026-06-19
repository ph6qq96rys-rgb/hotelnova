// src/features/company/onboarding/SystemAdmin/api/systemAdminApi.ts

import { http } from "../../../../../api/http";

import type {
  CompanyListItemDto,
  PagedResult,
  SwitchCompanyContextDto,
} from "../types/systemAdmin.types";

const SYSTEM_ADMIN_BASE = "/system-admin";

const data = <T>(response: { data: T }): T => response.data;

function normalizePage(page?: number): number {
  return Math.max(1, page ?? 1);
}

function normalizePageSize(pageSize?: number): number {
  return Math.min(100, Math.max(1, pageSize ?? 25));
}

function normalizePagedResult<T>(
  value: PagedResult<T> | T[],
  page: number,
  pageSize: number
): PagedResult<T> {
  if (Array.isArray(value)) {
    return {
      items: value,
      totalCount: value.length,
      page,
      pageSize,
    };
  }

  return {
    items: Array.isArray(value.items) ? value.items : [],
    totalCount: Number(value.totalCount ?? 0),
    page: Number((value as any).page ?? page),
    pageSize: Number(value.pageSize ?? pageSize),
  };
}

export const systemAdminApi = {
  async listCompanies(
    page = 1,
    pageSize = 25,
    signal?: AbortSignal
  ): Promise<PagedResult<CompanyListItemDto>> {
    const safePage = normalizePage(page);
    const safePageSize = normalizePageSize(pageSize);

    const response = await http.get<
      PagedResult<CompanyListItemDto> | CompanyListItemDto[]
    >(`${SYSTEM_ADMIN_BASE}/companies`, {
      params: {
        page: safePage,
        pageSize: safePageSize,
      },
      signal,
    });

    return normalizePagedResult(
      response.data,
      safePage,
      safePageSize
    );
  },

  switchCompany(
    companyId: string,
    signal?: AbortSignal
  ): Promise<SwitchCompanyContextDto> {
    if (!companyId?.trim()) {
      return Promise.reject(new Error("Company id is required."));
    }

    return http
      .post<SwitchCompanyContextDto>(
        `${SYSTEM_ADMIN_BASE}/companies/${encodeURIComponent(
          companyId
        )}/switch`,
        {},
        { signal }
      )
      .then(data);
  },
};