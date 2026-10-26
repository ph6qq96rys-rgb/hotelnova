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


export const orgApi = {
  listCompanies: (filter: OrgFilter = {}) =>
    getFirstPaged<OrganizationDto>([
      `/companies${qs(filter)}`,
    ]),

  listBranches: (companyId: string, filter: OrgFilter = {}) =>
    getFirstPaged<OrganizationDto>([
      `/companies/${companyId}/branches${qs(filter)}`,
    ]),

  listStores: (companyId: string, branchId?: string | null, filter: OrgFilter = {}) =>
    getFirstPaged<OrganizationDto>([
      branchId
        ? `/companies/${companyId}/branches/${branchId}/stock-locations${qs(filter)}`
        : `/companies/${companyId}/stock-locations${qs(filter)}`,
    ]),

  create: (dto: CreateOrganizationDto) => {
    const companyId = companyIdOf(dto);
    const branchId = branchIdOf(dto);

    const paths = branchId && companyId
      ? [
          `/companies/${companyId}/branches/${branchId}/stock-locations`,
          `/companies/${companyId}/stock-locations`,
        ]
      : companyId
        ? [
            `/companies/${companyId}/branches`,
          ]
        : [
            `/companies`,
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
        ]
      : companyId
        ? [
            `/companies/${companyId}/branches/${id}`,
          ]
        : [
            `/companies/${id}`,
          ];

    return sendFirst<OrganizationDto>("PUT", paths, dto);
  },


};
