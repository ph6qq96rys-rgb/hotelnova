import { http } from "../../../api/http";
import type {
  CreateOrganizationDto,
  OrganizationDto,
  OrgFilter,
  PagedResult,
  UpdateOrganizationDto,
} from "../types";

const base = import.meta.env.VITE_API_BASE_URL ?? "";

/** Build query string from filter */
function qs(filter: OrgFilter) {
  const p = new URLSearchParams();

  if (filter.q) p.set("q", filter.q);
  if (filter.page) p.set("page", String(filter.page));
  if (filter.pageSize) p.set("pageSize", String(filter.pageSize));
  if (filter.companyId) p.set("companyId", filter.companyId);
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));

  const s = p.toString();
  return s ? `?${s}` : "";
}

const ORGS = `${base}/api/identity/organizations`;

export const orgApi = {
  list: (filter: OrgFilter = {}) =>
    http<PagedResult<OrganizationDto>>(`${ORGS}${qs(filter)}`),

  get: (id: string) =>
    http<OrganizationDto>(`${ORGS}/${id}`),

  create: (dto: CreateOrganizationDto) =>
    http<OrganizationDto>(ORGS, {
      method: "POST",
      data: dto,
    }),

  update: (id: string, dto: UpdateOrganizationDto) =>
    http<OrganizationDto>(`${ORGS}/${id}`, {
      method: "PUT",
      data:dto,
    }),

  setActive: (id: string, isActive: boolean) =>
    http<void>(`${ORGS}/${id}/active`, {
      method: "PUT",
      data:{ isActive },
    }),

  // ✅ Thin wrappers (frontend-only helpers)
  listCompanies: (filter: OrgFilter = {}) =>
    http<PagedResult<OrganizationDto>>(`${ORGS}${qs({ ...filter })}`),

  listBranches: (companyId: string, filter: OrgFilter = {}) =>
    http<PagedResult<OrganizationDto>>(`${ORGS}${qs({ ...filter, companyId })}`),

  listStores: (companyId: string, filter: OrgFilter = {}) =>
    http<PagedResult<OrganizationDto>>(`${ORGS}${qs({ ...filter, companyId })}`),
};
