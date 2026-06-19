// src/features/organization/api/orgApi.ts

import { http } from "../../../api/http";
import type {
  CreateOrganizationDto,
  OrganizationDto,
  OrgFilter,
  PagedResult,
  UpdateOrganizationDto,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const ORGS = `${API_BASE}/identity/organizations`;

function qs(filter: OrgFilter = {}) {
  const p = new URLSearchParams();

  if (filter.q?.trim()) p.set("q", filter.q.trim());
  if (filter.page) p.set("page", String(filter.page));
  if (filter.pageSize) p.set("pageSize", String(filter.pageSize));
  if (filter.companyId) p.set("companyId", filter.companyId);
  if (filter.branchId) p.set("branchId", filter.branchId);
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));

  const s = p.toString();
  return s ? `?${s}` : "";
}

const defaultPage = {
  page: 1,
  pageSize: 100,
};

export const orgApi = {
  list: (filter: OrgFilter = {}) =>
    http<PagedResult<OrganizationDto>>(`${ORGS}${qs(filter)}`),

  listCompanies: (filter: OrgFilter = {}) =>
    http<PagedResult<OrganizationDto>>(
      `${ORGS}${qs({ ...defaultPage, ...filter })}`
    ),

  listBranches: (companyId: string, filter: OrgFilter = {}) =>
    http<PagedResult<OrganizationDto>>(
      `${ORGS}${qs({ ...defaultPage, ...filter, companyId })}`
    ),

  listStores: (companyId: string, branchId?: string | null, filter: OrgFilter = {}) =>
    http<PagedResult<OrganizationDto>>(
      `${ORGS}${qs({
        ...defaultPage,
        ...filter,
        companyId,
        branchId: branchId || undefined,
      })}`
    ),

  get: (id: string) => http<OrganizationDto>(`${ORGS}/${id}`),

  create: (dto: CreateOrganizationDto) =>
    http<OrganizationDto>(ORGS, {
      method: "POST",
      data: dto,
    }),

  update: (id: string, dto: UpdateOrganizationDto) =>
    http<OrganizationDto>(`${ORGS}/${id}`, {
      method: "PUT",
      data: dto,
    }),

  setActive: (id: string, isActive: boolean) =>
    http<void>(`${ORGS}/${id}/active`, {
      method: "PUT",
      data: { isActive },
    }),
};