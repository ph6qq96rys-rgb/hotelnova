// src/modules/company/api/companyStockLocationsApi.ts

import { http } from "../../../api/http";
import type { CreateStockLocationDto, StockLocation } from "../types/company.types";
import {
  idOf,
  optionalText,
  optionalUpperCode,
  requireGuid,
  unwrapArray,
} from "./apiGuards";

const MAX_PAGE_SIZE = 500;

export type StockLocationListParams = {
  locationType?: string | number | null;
  role?: string | null;
  q?: string | null;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export type UpdateStockLocationDto = Partial<CreateStockLocationDto> & {
  isActive?: boolean | null;
  role?: string | null;
  locationRole?: string | null;
  isDefault?: boolean | null;
  canIssue?: boolean | null;
  canReceive?: boolean | null;
  canSell?: boolean | null;
  canProduce?: boolean | null;
};

type CreatedLocationResponse = {
  id?: string;
  Id?: string;
  locationId?: string;
  stockLocationId?: string;
};

const base = (companyId: string) =>
  `/companies/${requireGuid(companyId, "companyId")}/stock-locations`;

function buildListParams(params: StockLocationListParams = {}) {
  const query: Record<string, string | number | boolean> = {
    activeOnly: params.activeOnly ?? true,
    page: params.page ?? 1,
    pageSize: Math.min(params.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };

  if (
    params.locationType !== null &&
    params.locationType !== undefined &&
    params.locationType !== ""
  ) {
    query.locationType = params.locationType;
  }

  if (params.role?.trim()) query.role = params.role.trim();
  if (params.q?.trim()) query.q = params.q.trim();

  return query;
}

function normalizeCreatePayload(body: CreateStockLocationDto): CreateStockLocationDto {
  const payload = {
    ...body,
    name: optionalText(body.name),
    code: optionalUpperCode(body.code),
  } as CreateStockLocationDto & { branchId?: string | null };

  delete payload.branchId;

  return payload as CreateStockLocationDto;
}

function normalizeUpdatePayload(body: UpdateStockLocationDto): UpdateStockLocationDto {
  const payload = {
    ...body,
    name: optionalText(body.name),
    code: optionalUpperCode(body.code),
  } as UpdateStockLocationDto & { branchId?: string | null };

  delete payload.branchId;

  return payload;
}

function extractCreatedId(raw: unknown): string {
  return idOf(raw as CreatedLocationResponse);
}

function looksLikeStockLocation(raw: unknown): raw is StockLocation {
  if (!raw || typeof raw !== "object") return false;

  const value = raw as any;

  return Boolean(
    idOf(value) &&
      (value.name !== undefined ||
        value.code !== undefined ||
        value.locationType !== undefined ||
        value.locationRole !== undefined ||
        value.role !== undefined ||
        value.type !== undefined),
  );
}

function isHttpNotFound(err: unknown): boolean {
  const value = err as any;
  return value?.response?.status === 404 || value?.status === 404;
}

async function tryGetById(companyId: string, locationId: string): Promise<StockLocation | null> {
  try {
    return await companyStockLocationsApi.get(companyId, locationId);
  } catch (err) {
    if (isHttpNotFound(err)) return null;
    throw err;
  }
}

async function findCreatedFromList(
  companyId: string,
  locationId: string,
): Promise<StockLocation | null> {
  const locations = await companyStockLocationsApi.list(companyId, {
    activeOnly: false,
    page: 1,
    pageSize: MAX_PAGE_SIZE,
  });

  return locations.find((location) => idOf(location) === locationId) ?? null;
}

export const companyStockLocationsApi = {
  async list(
    companyId: string,
    params: StockLocationListParams = {},
  ): Promise<StockLocation[]> {
    const res = await http.get<unknown>(base(companyId), {
      params: buildListParams(params),
    });

    return unwrapArray<StockLocation>(res.data);
  },

  async get(companyId: string, locationId: string): Promise<StockLocation> {
    const loc = requireGuid(locationId, "locationId");
    const res = await http.get<StockLocation>(`${base(companyId)}/${loc}`);
    return res.data;
  },

  async create(companyId: string, body: CreateStockLocationDto): Promise<StockLocation> {
    const res = await http.post<unknown>(base(companyId), normalizeCreatePayload(body));

    if (looksLikeStockLocation(res.data)) return res.data;

    const createdId = extractCreatedId(res.data);

    if (!createdId) {
      throw new Error(
        "Stock location was created, but the API response did not include the created location id.",
      );
    }

    const byId = await tryGetById(companyId, createdId);
    if (byId) return byId;

    const fromList = await findCreatedFromList(companyId, createdId);
    if (fromList) return fromList;

    throw new Error("Stock location was created, but it could not be reloaded.");
  },

  async update(
    companyId: string,
    locationId: string,
    body: UpdateStockLocationDto,
  ): Promise<StockLocation> {
    const loc = requireGuid(locationId, "locationId");

    const res = await http.put<StockLocation>(
      `${base(companyId)}/${loc}`,
      normalizeUpdatePayload(body),
    );

    return res.data;
  },

  async setStatus(
    companyId: string,
    locationId: string,
    isActive: boolean,
  ): Promise<void> {
    const loc = requireGuid(locationId, "locationId");
    await http.put(`${base(companyId)}/${loc}/status`, { isActive });
  },
};