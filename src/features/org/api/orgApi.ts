// src/features/organization/api/orgApi.ts

import { http } from "../../../api/http";
import type {
  CreateOrganizationDto,
  OrganizationDto,
  OrgFilter,
  PagedResult,
  UpdateOrganizationDto,
} from "../types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 500;

type ApiResponse<T> = { data: T };
type AnyDto = Record<string, unknown>;

function normalizeApiBase(value?: string): string {
  const raw = (value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "/api";
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

function url(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function qs(filter: OrgFilter = {}): string {
  const p = new URLSearchParams();

  p.set("page", String(filter.page ?? DEFAULT_PAGE));
  p.set("pageSize", String(filter.pageSize ?? DEFAULT_PAGE_SIZE));

  if (filter.q?.trim()) p.set("q", filter.q.trim());
  if (filter.companyId) p.set("companyId", filter.companyId);
  if (filter.branchId) p.set("branchId", filter.branchId);
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));

  const s = p.toString();
  return s ? `?${s}` : "";
}

function isNotFound(error: unknown): boolean {
  const e = error as { response?: { status?: number }; status?: number };
  return e?.response?.status === 404 || e?.status === 404;
}

function toPaged<T extends OrganizationDto>(data: unknown): PagedResult<T> {
  if (Array.isArray(data)) {
    return {
      items: data as T[],
      page: DEFAULT_PAGE,
      pageSize: data.length,
      total: data.length,
      totalPages: 1,
    } as PagedResult<T>;
  }

  const d = data as Partial<PagedResult<T>> & {
    data?: T[];
    results?: T[];
    total?: number;
    count?: number;
  };

  const items = d.items ?? d.data ?? d.results ?? [];
  const totalCount = d.total ?? d.total ?? d.count ?? items.length;
  const pageSize = d.pageSize ?? DEFAULT_PAGE_SIZE;

  return {
    ...d,
    items,
    page: d.page ?? DEFAULT_PAGE,
    pageSize,
    totalCount,
    totalPages: d.page ?? Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
  } as PagedResult<T>;
}

async function getFirstPaged<T extends OrganizationDto>(paths: string[]): Promise<ApiResponse<PagedResult<T>>> {
  let lastError: unknown;

  for (const path of paths) {
    try {
      const res = await http<unknown>(url(path));
      return { data: toPaged<T>(res.data) };
    } catch (err) {
      lastError = err;
      if (!isNotFound(err)) throw err;
    }
  }

  throw lastError;
}

async function sendFirst<T>(
  method: "POST" | "PUT" | "PATCH",
  paths: string[],
  data: unknown,
): Promise<ApiResponse<T>> {
  let lastError: unknown;

  for (const path of paths) {
    try {
      return await http<T>(url(path), { method, data });
    } catch (err) {
      lastError = err;
      if (!isNotFound(err)) throw err;
    }
  }

  throw lastError;
}

function companyIdOf(dto: unknown): string | undefined {
  const d = dto as AnyDto;
  return typeof d.companyId === "string" && d.companyId ? d.companyId : undefined;
}

function branchIdOf(dto: unknown): string | undefined {
  const d = dto as AnyDto;
  return typeof d.branchId === "string" && d.branchId ? d.branchId : undefined;
}

const legacyOrganizations = (filter: OrgFilter = {}) => `/identity/organizations${qs(filter)}`;

export const orgApi = {
  list: (filter: OrgFilter = {}) =>
    getFirstPaged<OrganizationDto>([
      legacyOrganizations(filter),
      `/companies${qs(filter)}`,
    ]),

  listCompanies: (filter: OrgFilter = {}) =>
    getFirstPaged<OrganizationDto>([
      `/companies${qs(filter)}`,
      `/company${qs(filter)}`,
      `/identity/companies${qs(filter)}`,
      legacyOrganizations({ ...filter, companyId: undefined, branchId: undefined }),
    ]),

  listBranches: (companyId: string, filter: OrgFilter = {}) =>
    getFirstPaged<OrganizationDto>([
      `/companies/${companyId}/branches${qs(filter)}`,
      `/company/${companyId}/branches${qs(filter)}`,
      `/branches${qs({ ...filter, companyId })}`,
      legacyOrganizations({ ...filter, companyId }),
    ]),

  listStores: (companyId: string, branchId?: string | null, filter: OrgFilter = {}) =>
    getFirstPaged<OrganizationDto>([
      branchId
        ? `/companies/${companyId}/branches/${branchId}/stock-locations${qs(filter)}`
        : `/companies/${companyId}/stock-locations${qs(filter)}`,
      `/stock-locations${qs({ ...filter, companyId, branchId: branchId || undefined })}`,
      `/stores${qs({ ...filter, companyId, branchId: branchId || undefined })}`,
      legacyOrganizations({ ...filter, companyId, branchId: branchId || undefined }),
    ]),

  get: (id: string) =>
    http<OrganizationDto>(url(`/identity/organizations/${id}`)),

  create: (dto: CreateOrganizationDto) => {
    const companyId = companyIdOf(dto);
    const branchId = branchIdOf(dto);

    const paths = branchId && companyId
      ? [
          `/companies/${companyId}/branches/${branchId}/stock-locations`,
          `/companies/${companyId}/stock-locations`,
          `/stock-locations`,
          `/identity/organizations`,
        ]
      : companyId
        ? [
            `/companies/${companyId}/branches`,
            `/branches`,
            `/identity/organizations`,
          ]
        : [
            `/companies`,
            `/identity/companies`,
            `/identity/organizations`,
          ];

    return sendFirst<OrganizationDto>("POST", paths, dto);
  },

  update: (id: string, dto: UpdateOrganizationDto) => {
    const companyId = companyIdOf(dto);
    const branchId = branchIdOf(dto);

    const paths = branchId && companyId
      ? [
          `/companies/${companyId}/branches/${branchId}/stock-locations/${id}`,
          `/companies/${companyId}/stock-locations/${id}`,
          `/stock-locations/${id}`,
          `/identity/organizations/${id}`,
        ]
      : companyId
        ? [
            `/companies/${companyId}/branches/${id}`,
            `/branches/${id}`,
            `/identity/organizations/${id}`,
          ]
        : [
            `/companies/${id}`,
            `/identity/companies/${id}`,
            `/identity/organizations/${id}`,
          ];

    return sendFirst<OrganizationDto>("PUT", paths, dto);
  },

  setActive: (id: string, isActive: boolean) =>
    sendFirst<void>(
      "PUT",
      [
        `/identity/organizations/${id}/active`,
        `/companies/${id}/active`,
        `/branches/${id}/active`,
        `/stock-locations/${id}/active`,
      ],
      { isActive },
    ),
};
