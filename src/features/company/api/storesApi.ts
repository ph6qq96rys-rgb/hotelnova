// src/modules/company/api/storesApi.ts
// ERP-grade Store API. Stores/POS units belong to a branch.

import { http } from "../../../api/http";
import type { CreateStoreDto, StoreDto } from "../types/company.types";
import { requireGuid, unwrapArray } from "./apiGuards";

export type { StoreDto };

const base = (companyId: string, branchId: string) =>
  `/companies/${requireGuid(companyId, "companyId")}/branches/${requireGuid(
    branchId,
    "branchId",
  )}/stores`;

function normalizeCreatePayload(body: CreateStoreDto): CreateStoreDto {
  const raw = body as CreateStoreDto & {
    name?: string | null;
    code?: string | null;
    storeType?: string | null;
    locationType?: string | null;
  };

  return {
    ...body,
    name: raw.name?.trim() ?? raw.name,
    code: raw.code ? raw.code.trim().toUpperCase() : raw.code,
    storeType: raw.storeType ?? raw.locationType ?? "DineIn",
    locationType: raw.locationType ?? raw.storeType ?? "DineIn",
  } as CreateStoreDto;
}

function normalizeUpdatePayload(
  body: Partial<CreateStoreDto>,
): Partial<CreateStoreDto> {
  const raw = body as Partial<CreateStoreDto> & {
    name?: string | null;
    code?: string | null;
    storeType?: string | null;
    locationType?: string | null;
  };

  return {
    ...body,
    ...(raw.name !== undefined ? { name: raw.name?.trim() ?? raw.name } : {}),
    ...(raw.code !== undefined
      ? { code: raw.code ? raw.code.trim().toUpperCase() : raw.code }
      : {}),
    ...(raw.storeType !== undefined || raw.locationType !== undefined
      ? {
          storeType: raw.storeType ?? raw.locationType,
          locationType: raw.locationType ?? raw.storeType,
        }
      : {}),
  };
}

export const storesApi = {
  list: async (
    companyId: string,
    branchId: string,
    params: { page?: number; pageSize?: number; activeOnly?: boolean } = {},
  ): Promise<StoreDto[]> => {
    const res = await http.get<unknown>(base(companyId, branchId), {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 500,
        activeOnly: params.activeOnly ?? true,
      },
    });

    return unwrapArray<StoreDto>(res.data);
  },

  create: async (
    companyId: string,
    branchId: string,
    body: CreateStoreDto,
  ): Promise<StoreDto> => {
    const res = await http.post<StoreDto>(
      base(companyId, branchId),
      normalizeCreatePayload(body),
    );

    return res.data;
  },

update: async (
  companyId: string,
  branchId: string,
  storeId: string,
  body: Partial<CreateStoreDto>,
): Promise<StoreDto> => {
  const store = requireGuid(storeId, "storeId");

  const res = await http.put<StoreDto>(
    `${base(companyId, branchId)}/${store}`,
    normalizeUpdatePayload(body),
  );

  return res.data;
},

  setStatus: async (
    companyId: string,
    branchId: string,
    storeId: string,
    isActive: boolean,
  ): Promise<void> => {
    const store = requireGuid(storeId, "storeId");

    await http.put(`${base(companyId, branchId)}/${store}/status`, { isActive });
  },
};
