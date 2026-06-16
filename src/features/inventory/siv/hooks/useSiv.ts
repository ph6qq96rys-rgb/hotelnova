// src/features/inventory/siv/hooks/useSiv.ts

import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { sivApi } from "../api/sivApi";
import {
  getApiError,
  mapToListItem,
  mapToVm,
  type PagedResult,
  type SivListItemDto,
  type SivVm,
} from "../types/sivTypes";
import type {
  ApproveSivLineRequest,
  CreateSivDraftRequest,
  IssueSivLineRequest,
  SivLineFifoPreviewDto,
} from "../api/sivApi";

function unwrapData<T>(response: unknown): T {
  const r = response as any;
  return (r?.data ?? r) as T;
}

function unwrapListPayload(response: unknown): {
  items: unknown[];
  page: number;
  pageSize: number;
  totalCount: number;
} {
  const r = unwrapData<any>(response);
  const items = Array.isArray(r)
    ? r
    : Array.isArray(r?.items)
      ? r.items
      : Array.isArray(r?.data)
        ? r.data
        : [];

  return {
    items,
    page: Number(r?.page ?? r?.pageNumber ?? 1),
    pageSize: Number(r?.pageSize ?? 20),
    totalCount: Number(r?.totalCount ?? r?.total ?? items.length),
  };
}

export interface UseSivListParams {
  companyId: string;
  branchId?: string;
  q?: string;
  docStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface UseSivListResult {
  data: PagedResult<SivListItemDto>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useSivList(params: UseSivListParams): UseSivListResult {
  const [data, setData] = useState<PagedResult<SivListItemDto>>({
    items: [],
    page: 1,
    pageSize: 20,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!params.companyId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await sivApi.getList(params.companyId, {
        branchId: params.branchId || undefined,
        q: params.q || undefined,
        docStatus: params.docStatus || undefined,
        dateFrom: params.dateFrom || undefined,
        dateTo: params.dateTo || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      });

      const payload = unwrapListPayload(response);
      setData({
        items: payload.items
          .map(mapToListItem)
          .filter(Boolean) as SivListItemDto[],
        page: payload.page,
        pageSize: payload.pageSize,
        totalCount: payload.totalCount,
      });
    } catch (e) {
      setError(getApiError(e, "Failed to load SIV list."));
    } finally {
      setLoading(false);
    }
  }, [
    params.companyId,
    params.branchId,
    params.q,
    params.docStatus,
    params.dateFrom,
    params.dateTo,
    params.page,
    params.pageSize,
  ]);

  return { data, loading, error, reload };
}

export interface UseSivDetailResult {
  doc: SivVm | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setDoc: Dispatch<SetStateAction<SivVm | null>>;
}

export function useSivDetail(
  companyId: string,
  sivId: string,
): UseSivDetailResult {
  const [doc, setDoc] = useState<SivVm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!companyId || !sivId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await sivApi.getById(companyId, sivId);
      setDoc(mapToVm(unwrapData(response)));
    } catch (e) {
      setError(getApiError(e, "Failed to load SIV."));
    } finally {
      setLoading(false);
    }
  }, [companyId, sivId]);

  return { doc, loading, error, reload, setDoc };
}

export interface UseFifoPreviewResult {
  preview: SivLineFifoPreviewDto | null;
  loading: boolean;
  error: string | null;
  load: (lineId: string) => Promise<void>;
}

export function useFifoPreview(
  companyId: string,
  sivId: string,
): UseFifoPreviewResult {
  const [preview, setPreview] = useState<SivLineFifoPreviewDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (lineId: string) => {
      if (!companyId || !sivId || !lineId) return;

      setLoading(true);
      setError(null);
      setPreview(null);

      try {
        const response = await sivApi.getFifoPreview(companyId, sivId, lineId);
        setPreview(unwrapData(response));
      } catch (e) {
        setError(getApiError(e, "Failed to load FIFO preview."));
      } finally {
        setLoading(false);
      }
    },
    [companyId, sivId],
  );

  return { preview, loading, error, load };
}

type AsyncAction<TArgs extends unknown[]> = (...args: TArgs) => Promise<void>;

function useAction<TArgs extends unknown[]>(handler: AsyncAction<TArgs>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const run = useCallback(
    async (...args: TArgs) => {
      setBusy(true);
      setError(null);
      setSuccess(null);

      try {
        await handler(...args);
      } catch (e) {
        setError(getApiError(e, "Operation failed."));
      } finally {
        setBusy(false);
      }
    },
    [handler],
  );

  return { busy, error, success, setSuccess, reset, run };
}

export function useSivSubmit(
  companyId: string,
  sivId: string,
  onSuccess: () => Promise<void>,
) {
  const action = useAction(
    async (rowVersion: string | null, remarks?: string) => {
      await sivApi.submit(companyId, sivId, {
        rowVersion,
        remarks: remarks || null,
      });
      action.setSuccess("SIV submitted for approval.");
      await onSuccess();
    },
  );

  return { ...action, submit: action.run };
}

export function useSivApprove(
  companyId: string,
  sivId: string,
  onSuccess: () => Promise<void>,
) {
  const action = useAction(
    async (
      rowVersion: string | null,
      remarks?: string,
      lines?: ApproveSivLineRequest[],
    ) => {
      await sivApi.approve(companyId, sivId, {
        rowVersion,
        remarks: remarks || null,
        lines: lines?.length ? lines : null,
      });
      action.setSuccess("SIV approved.");
      await onSuccess();
    },
  );

  return { ...action, approve: action.run };
}

export function useSivReject(
  companyId: string,
  sivId: string,
  onSuccess: () => Promise<void>,
) {
  const action = useAction(
    async (rowVersion: string | null, remarks: string) => {
      await sivApi.reject(companyId, sivId, { rowVersion, remarks });
      action.setSuccess("SIV rejected.");
      await onSuccess();
    },
  );

  return { ...action, reject: action.run };
}

export function useSivRequestChanges(
  companyId: string,
  sivId: string,
  onSuccess: () => Promise<void>,
) {
  const action = useAction(
    async (rowVersion: string | null, remarks: string) => {
      await sivApi.requestChanges(companyId, sivId, { rowVersion, remarks });
      action.setSuccess("SIV returned to requester for changes.");
      await onSuccess();
    },
  );

  return { ...action, requestChanges: action.run };
}

export function useSivIssue(
  companyId: string,
  sivId: string,
  onSuccess: () => Promise<void>,
) {
  const action = useAction(
    async (
      rowVersion: string | null,
      remarks?: string,
      lines?: IssueSivLineRequest[],
    ) => {
      await sivApi.issue(companyId, sivId, {
        rowVersion,
        remarks: remarks || null,
        lines: lines?.length ? lines : null,
      });
      action.setSuccess("SIV issued. Ready to post.");
      await onSuccess();
    },
  );

  return { ...action, issue: action.run };
}

export function useSivPost(
  companyId: string,
  sivId: string,
  onSuccess: () => Promise<void>,
) {
  const action = useAction(async () => {
    const response = await sivApi.post(companyId, sivId);
    const result = unwrapData<any>(response);

    if (result?.error) throw new Error(String(result.error));

    action.setSuccess(
      result?.message ||
        "SIV posted. FIFO lots consumed and ledger entries created.",
    );
    await onSuccess();
  });

  return { ...action, post: action.run };
}

export function useSivReverse(
  companyId: string,
  sivId: string,
  onSuccess: () => Promise<void>,
) {
  const action = useAction(
    async (rowVersion: string | null, reason: string) => {
      await sivApi.reverse(companyId, sivId, { rowVersion, reason });
      action.setSuccess("SIV reversed. Stock balances restored.");
      await onSuccess();
    },
  );

  return { ...action, reverse: action.run };
}

export function useSivCreateDraft(companyId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (body: CreateSivDraftRequest): Promise<string | null> => {
      if (!companyId) {
        setError("Missing company scope.");
        return null;
      }

      setBusy(true);
      setError(null);

      try {
        const response = await sivApi.createDraft(companyId, body);
        return unwrapData<any>(response)?.id ?? null;
      } catch (e) {
        setError(getApiError(e, "Failed to create SIV draft."));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [companyId],
  );

  return { busy, error, create };
}
