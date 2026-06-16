// src/modules/company/api/stockLocationsApi.ts
//
// ERP-grade company-level Stock Locations API.
//
// Design rule:
// - Stock locations are owned by Company.
// - Branch assignment is optional and carried in the request body as branchId.
// - Frontend must not use branch-nested stock-location routes.
// - create() must not fail just because backend POST returns { locationId }
//   and GET-by-id endpoint is missing or not yet implemented.

import { http } from "../../../api/http";

import type {
  StockLocation,
  CreateStockLocationDto,
} from "../types/company.types";

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

const MAX_PAGE_SIZE = 100;

export type StockLocationListParams = {
  /**
   * Kept only for backward compatibility.
   * Stock locations are company-level. This value is not sent as a query string.
   */
  branchId?: string | null;
  locationType?: string | number | null;
  q?: string | null;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export type UpdateStockLocationDto = Partial<CreateStockLocationDto> & {
  branchId?: string | null;
  isActive?: boolean | null;
  isDefault?: boolean | null;
  isDefaultReceiving?: boolean | null;
  isDefaultIssue?: boolean | null;
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

type ApiListEnvelope<T> = {
  items?: T[];
  data?: T[];
  result?: T[];
  results?: T[];
};

function cleanGuid(value: string | null | undefined): string {
  if (!value) return "";

  const match = value.trim().match(GUID_REGEX);

  return match?.[0] ?? "";
}

function requireGuid(
  value: string | null | undefined,
  name: string,
): string {
  const id = cleanGuid(value);

  if (!id) {
    throw new Error(`${name} is required and must be a valid GUID.`);
  }

  return id;
}

function idOf(value: unknown): string {
  const row = value as any;

  return cleanGuid(
    row?.id ??
      row?.Id ??
      row?.locationId ??
      row?.stockLocationId ??
      row?.stockLocation?.id,
  );
}

function base(companyId: string): string {
  return `/companies/${requireGuid(companyId, "companyId")}/stock-locations`;
}

function unwrapArray<T>(raw: unknown): T[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw as T[];
  }

  const envelope = raw as ApiListEnvelope<T>;

  if (Array.isArray(envelope.items)) return envelope.items;
  if (Array.isArray(envelope.data)) return envelope.data;
  if (Array.isArray(envelope.result)) return envelope.result;
  if (Array.isArray(envelope.results)) return envelope.results;

  return [];
}

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function optionalUpperCode(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeCreatePayload(
  body: CreateStockLocationDto,
  branchId?: string | null,
): CreateStockLocationDto {
  const raw = body as CreateStockLocationDto & {
    name?: string | null;
    code?: string | null;
    branchId?: string | null;
  };

  return {
    ...body,

    // Company-level stock location. Optional branch assignment belongs in body.
    branchId: branchId !== undefined ? branchId : raw.branchId ?? null,

    name: raw.name?.trim() ?? raw.name,
    code: raw.code ? raw.code.trim().toUpperCase() : raw.code,
  } as CreateStockLocationDto;
}

function normalizeUpdatePayload(
  body: UpdateStockLocationDto,
): UpdateStockLocationDto {
  return {
    ...body,
    name: optionalText(body.name),
    code: optionalUpperCode(body.code),
    branchId:
      body.branchId === undefined || body.branchId === null || body.branchId === ""
        ? body.branchId ?? null
        : requireGuid(body.branchId, "branchId"),
  };
}

function buildListParams(params: StockLocationListParams) {
  const query: Record<string, string | number | boolean> = {
    activeOnly: params.activeOnly ?? true,
    page: params.page ?? 1,
    pageSize: Math.min(params.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };

  // IMPORTANT:
  // Do not send branchId. Stock locations are company-level.
  // Branch filtering should be done client-side from returned branchId,
  // or implemented later as a dedicated backend query/filter.

  if (
    params.locationType !== null &&
    params.locationType !== undefined &&
    params.locationType !== ""
  ) {
    query.locationType = params.locationType;
  }

  if (params.q?.trim()) {
    query.q = params.q.trim();
  }

  return query;
}

function extractCreatedId(raw: unknown): string {
  const response = raw as CreatedLocationResponse;

  return cleanGuid(
    response?.id ??
      response?.Id ??
      response?.locationId ??
      response?.stockLocationId,
  );
}

function looksLikeStockLocation(raw: unknown): raw is StockLocation {
  if (!raw || typeof raw !== "object") return false;

  const value = raw as any;

  return Boolean(
    idOf(value) &&
      (
        value.name !== undefined ||
        value.code !== undefined ||
        value.locationType !== undefined ||
        value.type !== undefined
      ),
  );
}

function isHttpNotFound(err: unknown): boolean {
  const value = err as any;

  return value?.response?.status === 404 || value?.status === 404;
}

async function tryGetById(
  companyId: string,
  locationId: string,
): Promise<StockLocation | null> {
  try {
    return await stockLocationsApi.get(companyId, locationId);
  } catch (err) {
    if (isHttpNotFound(err)) {
      return null;
    }

    throw err;
  }
}

async function findCreatedFromList(
  companyId: string,
  locationId: string,
): Promise<StockLocation | null> {
  const locations = await stockLocationsApi.list(companyId, {
    activeOnly: false,
    page: 1,
    pageSize: MAX_PAGE_SIZE,
  });

  return locations.find((location) => idOf(location) === locationId) ?? null;
}

export const stockLocationsApi = {
  list: async (
    companyId: string,
    params: StockLocationListParams = {},
  ): Promise<StockLocation[]> => {
    const res = await http.get<unknown>(base(companyId), {
      params: buildListParams(params),
    });

    return unwrapArray<StockLocation>(res.data);
  },

  /**
   * Backward-compatible wrapper.
   *
   * Stock locations are company-level.
   * branchId is intentionally ignored to avoid old branch-nested route bugs.
   */
  listByBranch: async (
    companyId: string,
    _branchId: string,
    params: Omit<StockLocationListParams, "branchId"> = {},
  ): Promise<StockLocation[]> => {
    return stockLocationsApi.list(companyId, params);
  },

  get: async (
    companyId: string,
    locationId: string,
  ): Promise<StockLocation> => {
    const loc = requireGuid(locationId, "locationId");

    const res = await http.get<StockLocation>(`${base(companyId)}/${loc}`);

    return res.data;
  },

  create: async (
    companyId: string,
    body: CreateStockLocationDto,
    branchId?: string | null,
  ): Promise<StockLocation> => {
    const payload = normalizeCreatePayload(body, branchId);

    const res = await http.post<unknown>(base(companyId), payload);

    // Best backend response: CreatedAtAction(..., dto)
    if (looksLikeStockLocation(res.data)) {
      return res.data;
    }

    // Older backend response: { locationId: "..." }
    const createdId = extractCreatedId(res.data);

    if (!createdId) {
      throw new Error(
        "Stock location was created, but the API response did not include the created location.",
      );
    }

    // Avoid breaking the UI if GET-by-id is not implemented yet.
    const byId = await tryGetById(companyId, createdId);

    if (byId) {
      return byId;
    }

    const fromList = await findCreatedFromList(companyId, createdId);

    if (fromList) {
      return fromList;
    }

    throw new Error(
      "Stock location was created, but it could not be reloaded. Please refresh the page.",
    );
  },

  update: async (
    companyId: string,
    locationId: string,
    body: UpdateStockLocationDto,
  ): Promise<void> => {
    const loc = requireGuid(locationId, "locationId");

    await http.put(`${base(companyId)}/${loc}`, normalizeUpdatePayload(body));
  },

  setStatus: async (
    companyId: string,
    locationId: string,
    isActive: boolean,
  ): Promise<void> => {
    const loc = requireGuid(locationId, "locationId");

    await http.put(`${base(companyId)}/${loc}/status`, {
      isActive,
    });
  },
assignManyToBranch: async (
  companyId: string,
  branchId: string,
  payload: { stockLocationIds: string[] },
) => {
  return http.post(
    `/companies/${companyId}/branches/${branchId}/stock-location-assignments`,
    payload,
  );
},
  /**
   * Backward-compatible assignment method.
   *
   * This sends branchId in the update body because your current DTO supports it.
   * Later ERP-grade backend can replace this with:
   * PUT /companies/{companyId}/branches/{branchId}/stock-location-assignments/{locationId}
   */
  assignToBranch: async (
    companyId: string,
    locationId: string,
    branchId: string | null,
  ): Promise<void> => {
    await stockLocationsApi.update(companyId, locationId, {
      branchId: branchId ? requireGuid(branchId, "branchId") : null,
    });
  },

  setDefaultReceiving: async (
    companyId: string,
    locationId: string,
    branchId?: string | null,
  ): Promise<void> => {
    await stockLocationsApi.update(companyId, locationId, {
      branchId: branchId ? requireGuid(branchId, "branchId") : null,
      isDefaultReceiving: true,
      canReceive: true,
    });
  },

  setDefaultIssue: async (
    companyId: string,
    locationId: string,
    branchId?: string | null,
  ): Promise<void> => {
    await stockLocationsApi.update(companyId, locationId, {
      branchId: branchId ? requireGuid(branchId, "branchId") : null,
      isDefaultIssue: true,
      canIssue: true,
    });
  },

  setStoreIssueLocation: async (
    companyId: string,
    locationId: string,
    branchId?: string | null,
  ): Promise<void> => {
    await stockLocationsApi.update(companyId, locationId, {
      branchId: branchId ? requireGuid(branchId, "branchId") : null,
      canIssue: true,
      isDefaultIssue: true,
    });
  },
};
