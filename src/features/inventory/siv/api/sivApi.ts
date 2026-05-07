import { http } from "../../../../api/http";

export type Guid = string;

/* -----------------------------
 * Helpers
 * ----------------------------- */

function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T;
}

function toQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, String(value));
  });

  const text = qs.toString();
  return text ? `?${text}` : "";
}

function normalizePagedResult<T>(
  raw: PagedResult<T> | T[] | undefined,
  fallbackPage = 1,
  fallbackPageSize = 20
): PagedResult<T> {
  if (Array.isArray(raw)) {
    return {
      items: raw,
      page: fallbackPage,
      pageSize: raw.length || fallbackPageSize,
      totalCount: raw.length,
    };
  }

  return {
    items: Array.isArray(raw?.items) ? raw.items : [],
    page: Number(raw?.page ?? fallbackPage),
    pageSize: Number(raw?.pageSize ?? fallbackPageSize),
    totalCount: Number(raw?.totalCount ?? raw?.items?.length ?? 0),
  };
}

function buildSivListQuery(params: GetSivListRequest | GetSivForApprovalRequest): string {
  return toQuery({
    branchId: params.branchId,
    departmentId: params.departmentId,
    fromLocationId: params.fromLocationId,

    q: params.q ?? params.search,
    search: params.search ?? params.q,

    docStatus: "docStatus" in params ? params.docStatus ?? params.status : undefined,
    status: "status" in params ? params.status ?? params.docStatus : undefined,

    dateFrom: params.dateFrom ?? params.issueDateFrom,
    dateTo: params.dateTo ?? params.issueDateTo,
    issueDateFrom: params.issueDateFrom ?? params.dateFrom,
    issueDateTo: params.issueDateTo ?? params.dateTo,

    page: params.page,
    pageSize: params.pageSize,
  });
}

/* -----------------------------
 * DTOs
 * ----------------------------- */

export type LocationDto = {
  id: Guid;
  code?: string | null;
  name: string;
  address?: string | null;
  locationType?: string | number | null;
  isActive?: boolean;
};

export type DepartmentDto = {
  id: Guid;
  code?: string | null;
  name: string;
  isActive?: boolean;
};

export type InventorySearchItemDto = {
  id: Guid;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  baseUomId?: Guid | null;
  baseUomCode?: string | null;
};

export type AvailabilityDto = {
  itemId?: Guid;
  locationId?: Guid;
  availableQty?: number | null;
  availableBaseQty?: number | null;
};

export type FifoIssueCandidateDto = {
  fifoLayerId?: Guid | null;
  sourceId?: Guid | null;
  sourceNumber?: string | null;
  receivedDate?: string | null;
  availableQty?: number | null;
  availableBaseQty?: number | null;
  batchNo?: string | null;
  expiryDate?: string | null;
};

export type CreateSivDraftLineRequest = {
  itemId: Guid;
  uomId: Guid;
  qty: number;
  remarks?: string;
  batchNo?: string;
  expiryDate?: string;
  fifoLayerId?: Guid;
  sourceId?: Guid;
  sourceNumber?: string;
};

export type CreateSivDraftRequest = {
  companyId: Guid;
  branchId: Guid;
  departmentId?: Guid;
  fromLocationId: Guid;
  issueDate: string;
  notes?: string;
  lines: CreateSivDraftLineRequest[];
};

export type UpdateSivDraftRequest = CreateSivDraftRequest;

export type WorkflowActionRequest = {
  remarks?: string;
};

export type ReverseSivRequest = {
  reason?: string;
  remarks?: string;
};

export type SivDetailsLineDto = {
  id?: Guid;
  itemId?: Guid;
  inventoryItemId?: Guid;
  itemName?: string | null;
  uomId?: Guid | null;
  uomCode?: string | null;
  uomName?: string | null;
  qty?: number | null;
  remarks?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  fifoLayerId?: Guid | null;
  sourceId?: Guid | null;
  sourceNumber?: string | null;
  receivedDate?: string | null;
  availableQty?: number | null;
  availableBaseQty?: number | null;
};

export type SivDetailsDto = {
  id: Guid;
  number?: string | null;
  docStatus?: string | null;
  issueDate?: string | null;
  notes?: string | null;
  remarks?: string | null;
  fromLocationId?: Guid | null;
  fromLocationName?: string | null;
  toLocationId?: Guid | null;
  toLocationName?: string | null;
  companyId?: Guid;
  branchId?: Guid;
  departmentId?: Guid | null;
  departmentName?: string | null;
  lineCount?: number | null;
  totalQty?: number | null;
  createdAt?: string | null;
  createdOn?: string | null;
  updatedAt?: string | null;
  modifiedAt?: string | null;
  lastModifiedAt?: string | null;
  lines?: SivDetailsLineDto[];
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type GetSivListRequest = {
  branchId?: string;
  departmentId?: string;
  fromLocationId?: string;
  docStatus?: string;
  status?: string;
  q?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  page?: number;
  pageSize?: number;
};

export type SearchInventoryItemsRequest = {
  q?: string;
  branchId?: Guid;
  locationId?: Guid;
  activeOnly?: boolean;
};

export type GetAvailabilityRequest = {
  branchId?: Guid;
  locationId: Guid;
  itemId: Guid;
};

export type GetFifoPreviewRequest = {
  branchId?: Guid;
  locationId: Guid;
  itemId: Guid;
  draftId?: Guid;
};

export type GetSivForApprovalRequest = {
  branchId?: string;
  departmentId?: string;
  fromLocationId?: string;
  q?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  page?: number;
  pageSize?: number;
};

/* -----------------------------
 * API
 * ----------------------------- */

export const sivApi = {
  /* ---------- master data ---------- */

  async listLocations(companyId: string, signal?: AbortSignal): Promise<LocationDto[]> {
    const res = await http.get(
      `/companies/${companyId}/stock-locations${toQuery({ activeOnly: true })}`,
      { signal }
    );
    return unwrap<LocationDto[]>(res) ?? [];
  },

  async getStockLocations(
    companyId: string,
    branchId?: string,
    signal?: AbortSignal
  ): Promise<LocationDto[]> {
    const url = branchId
      ? `/companies/${companyId}/branches/${branchId}/stock-locations${toQuery({
          activeOnly: true,
        })}`
      : `/companies/${companyId}/inventory-items/stock-locations${toQuery({ activeOnly: true })}`;

    const res = await http.get(url, { signal });
    return unwrap<LocationDto[]>(res) ?? [];
  },

  async listDepartments(companyId: string, signal?: AbortSignal): Promise<DepartmentDto[]> {
    const res = await http.get(
      `/companies/${companyId}/inventory-items/requesting-departments${toQuery({ activeOnly: true })}`,
      { signal }
    );
    return unwrap<DepartmentDto[]>(res) ?? [];
  },

  /* ---------- list pages ---------- */

  async getList(
    companyId: string,
    params: GetSivListRequest = {},
    signal?: AbortSignal
  ): Promise<PagedResult<SivDetailsDto>> {
    const qs = buildSivListQuery(params);
    const res = await http.get(`/companies/${companyId}/siv${qs}`, { signal });
    const raw = unwrap<PagedResult<SivDetailsDto> | SivDetailsDto[]>(res);

    return normalizePagedResult(raw, params.page ?? 1, params.pageSize ?? 20);
  },

  async listDrafts(
    companyId: string,
    params: GetSivListRequest = {},
    signal?: AbortSignal
  ): Promise<PagedResult<SivDetailsDto>> {
    const qs = buildSivListQuery(params);
    const res = await http.get(`/companies/${companyId}/siv/drafts${qs}`, { signal });
    const raw = unwrap<PagedResult<SivDetailsDto> | SivDetailsDto[]>(res);

    return normalizePagedResult(raw, params.page ?? 1, params.pageSize ?? 20);
  },

  async getForApproval(
    companyId: string,
    params: GetSivForApprovalRequest = {},
    signal?: AbortSignal
  ): Promise<PagedResult<SivDetailsDto>> {
    const qs = buildSivListQuery(params);
    const res = await http.get(`/companies/${companyId}/siv/for-approval${qs}`, {
      signal,
    });
    const raw = unwrap<PagedResult<SivDetailsDto> | SivDetailsDto[]>(res);

    return normalizePagedResult(raw, params.page ?? 1, params.pageSize ?? 20);
  },

  async listForApproval(
    companyId: string,
    params: GetSivForApprovalRequest = {},
    signal?: AbortSignal
  ): Promise<PagedResult<SivDetailsDto>> {
    return this.getForApproval(companyId, params, signal);
  },

  /* ---------- item search / availability ---------- */

async searchInventoryItems(
  companyId: string,
  request: SearchInventoryItemsRequest,
  signal?: AbortSignal
): Promise<InventorySearchItemDto[]> {
  const q = request.q?.trim();

  const qs = toQuery({
    ...(q ? { q } : {}), // ✅ ONLY include q if it exists
    branchId: request.branchId,
    locationId: request.locationId,
    activeOnly: request.activeOnly ?? true,
  });

  const res = await http.get(
    `/companies/${companyId}/inventory-items/search${qs}`,
    { signal }
  );

  return unwrap<InventorySearchItemDto[]>(res) ?? [];
},

  async getAvailability(
    companyId: string,
    request: GetAvailabilityRequest,
    signal?: AbortSignal
  ): Promise<AvailabilityDto> {
    const qs = toQuery({
      branchId: request.branchId,
      locationId: request.locationId,
      itemId: request.itemId,
    });

    const res = await http.get(`/companies/${companyId}/inventory-items/availability${qs}`, {
      signal,
    });

    return unwrap<AvailabilityDto>(res) ?? {};
  },

  async getFifoPreview(
    companyId: string,
    request: GetFifoPreviewRequest,
    signal?: AbortSignal
  ): Promise<FifoIssueCandidateDto[]> {
    const qs = toQuery({
      branchId: request.branchId,
      locationId: request.locationId,
      itemId: request.itemId,
      draftId: request.draftId,
    });

    const res = await http.get(
      `/companies/${companyId}/inventory-items/fifo-issue-candidates${qs}`,
      { signal }
    );

    return unwrap<FifoIssueCandidateDto[]>(res) ?? [];
  },

  /* ---------- drafts ---------- */

  async createDraft(
    companyId: string,
    request: CreateSivDraftRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.post(`/companies/${companyId}/siv/drafts`, request, { signal });
    return unwrap<SivDetailsDto>(res);
  },

  async updateDraft(
    companyId: string,
    sivId: string,
    request: UpdateSivDraftRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.put(`/companies/${companyId}/siv/drafts/${sivId}`, request, {
      signal,
    });
    return unwrap<SivDetailsDto>(res);
  },

  /* ---------- details ---------- */

  async getById(
    companyId: string,
    sivId: string|null,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.get(`/companies/${companyId}/siv/${sivId}`, { signal });
    return unwrap<SivDetailsDto>(res);
  },

  /* ---------- workflow ---------- */

  async submit(
    companyId: string,
    sivId: string,
    request?: WorkflowActionRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.post(
      `/companies/${companyId}/siv/${sivId}/submit`,
      request ?? {},
      { signal }
    );
    return unwrap<SivDetailsDto>(res);
  },

  async approve(
    companyId: string,
    sivId: string,
    request?: WorkflowActionRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.post(
      `/companies/${companyId}/siv/${sivId}/approve`,
      request ?? {},
      { signal }
    );
    return unwrap<SivDetailsDto>(res);
  },

  async requestChanges(
    companyId: string,
    sivId: string,
    request?: WorkflowActionRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.post(
      `/companies/${companyId}/siv/${sivId}/request-changes`,
      request ?? {},
      { signal }
    );
    return unwrap<SivDetailsDto>(res);
  },

  async reject(
    companyId: string,
    sivId: string,
    request?: WorkflowActionRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.post(
      `/companies/${companyId}/siv/${sivId}/reject`,
      request ?? {},
      { signal }
    );
    return unwrap<SivDetailsDto>(res);
  },

  async issue(
    companyId: string,
    sivId: string,
    request?: WorkflowActionRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.post(
      `/companies/${companyId}/siv/${sivId}/issue`,
      request ?? {},
      { signal }
    );
    return unwrap<SivDetailsDto>(res);
  },

  async post(
    companyId: string,
    sivId: string,
    request?: WorkflowActionRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.post(
      `/companies/${companyId}/siv/${sivId}/post`,
      request ?? {},
      { signal }
    );
    return unwrap<SivDetailsDto>(res);
  },

  async reverse(
    companyId: string,
    sivId: string,
    request: WorkflowActionRequest | ReverseSivRequest,
    signal?: AbortSignal
  ): Promise<SivDetailsDto> {
    const res = await http.post(`/companies/${companyId}/siv/${sivId}/reverse`, request, {
      signal,
    });
    return unwrap<SivDetailsDto>(res);
  },
};