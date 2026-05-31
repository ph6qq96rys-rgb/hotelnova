// src/features/inventory/siv/hooks/useSiv.ts
//
// React Query hooks for every SIV API operation.
// All mutations follow the same pattern:
//   1. Call the API
//   2. Invalidate relevant queries
//   3. Return error strings via getApiError for the UI to display
//
// These hooks are consumed by the page components and isolate all
// server-state logic from the render tree.

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sivApi } from "../api/sivApi";
import {
  mapToVm, mapToListItem, normalizeStatus, getApiError,
  type SivVm, type SivListItemDto, type PagedResult,
  type SivStatus,
} from "../types/sivTypes";
import type {
  ApproveSivLineRequest,
  CreateSivDraftRequest,
  IssueSivLineRequest,
  SivLineFifoPreviewDto,
} from "../api/sivApi";

// ─── List ─────────────────────────────────────────────────────────────────────

export interface UseSivListParams {
  companyId:       string;
  branchId?:       string;
  q?:              string;
  docStatus?:      string;
  dateFrom?:       string;
  dateTo?:         string;
  page?:           number;
  pageSize?:       number;
}

export interface UseSivListResult {
  data:    PagedResult<SivListItemDto>;
  loading: boolean;
  error:   string | null;
  reload:  () => void;
}

export function useSivList(params: UseSivListParams): UseSivListResult {
  const [data, setData] = useState<PagedResult<SivListItemDto>>({
    items: [], page: 1, pageSize: 20, totalCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!params.companyId) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await sivApi.getList(params.companyId, {
        branchId:    params.branchId    || undefined,
        q:           params.q           || undefined,
        docStatus:   params.docStatus   || undefined,
        dateFrom:    params.dateFrom    || undefined,
        dateTo:      params.dateTo      || undefined,
        page:        params.page        ?? 1,
        pageSize:    params.pageSize    ?? 20,
      });
      const r = raw as any;
      const rawItems = Array.isArray(r)             ? r
                     : Array.isArray(r?.items)       ? r.items
                     : Array.isArray(r?.data?.items) ? r.data.items
                     : Array.isArray(r?.data)        ? r.data
                     : [];
      setData({
        items:      rawItems.map(mapToListItem).filter(Boolean) as SivListItemDto[],
        page:       Number(r?.page       ?? 1),
        pageSize:   Number(r?.pageSize   ?? 20),
        totalCount: Number(r?.totalCount ?? rawItems.length),
      });
    } catch (e) {
      setError(getApiError(e, "Failed to load SIV list."));
    } finally {
      setLoading(false);
    }
  }, [
    params.companyId, params.branchId, params.q,
    params.docStatus, params.dateFrom, params.dateTo,
    params.page, params.pageSize,
  ]);

  return { data, loading, error, reload: load };
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export interface UseSivDetailResult {
  doc:     SivVm | null;
  loading: boolean;
  error:   string | null;
  reload:  () => Promise<void>;
  setDoc:  React.Dispatch<React.SetStateAction<SivVm | null>>;
}

export function useSivDetail(companyId: string, sivId: string): UseSivDetailResult {
  const [doc,     setDoc]     = useState<SivVm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!companyId || !sivId) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await sivApi.getById(companyId, sivId);
      setDoc(mapToVm(raw.data));
    } catch (e) {
      setError(getApiError(e, "Failed to load SIV."));
    } finally {
      setLoading(false);
    }
  }, [companyId, sivId]);

  return { doc, loading, error, reload, setDoc };
}

// ─── FIFO preview ─────────────────────────────────────────────────────────────

export interface UseFifoPreviewResult {
  preview: SivLineFifoPreviewDto | null;
  loading: boolean;
  error:   string | null;
  load:    (lineId: string) => Promise<void>;
}

export function useFifoPreview(companyId: string, sivId: string): UseFifoPreviewResult {
  const [preview, setPreview] = useState<SivLineFifoPreviewDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async (lineId: string) => {
    setLoading(true); setError(null); setPreview(null);
    try {
      const data = await sivApi.getFifoPreview(companyId, sivId, lineId);
      setPreview(data.data);
    } catch (e) {
      setError(getApiError(e, "Failed to load FIFO preview."));
    } finally {
      setLoading(false);
    }
  }, [companyId, sivId]);

  return { preview, loading, error, load };
}

// ─── Mutations ────────────────────────────────────────────────────────────────
//
// Each mutation hook returns { run, busy, error, success }.
// Pages call run(args) and check error / success to show feedback.

interface MutationState {
  busy:    boolean;
  error:   string | null;
  success: string | null;
  reset:   () => void;
}

function useMutationState(): [
  MutationState,
  (fn: () => Promise<void>) => Promise<void>
] {
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => { setError(null); setSuccess(null); };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); reset();
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return [{ busy, error, success, reset }, run];
}

// ─── Submit ───────────────────────────────────────────────────────────────────

export function useSivSubmit(
  companyId: string,
  sivId:     string,
  onSuccess: () => Promise<void>
) {
  const [state, run] = useMutationState();

  const submit = (rowVersion: string | null, remarks?: string) =>
    run(async () => {
      try {
        await sivApi.submit(companyId, sivId, { rowVersion, remarks });
        await onSuccess();
        (state as any).success = "SIV submitted for approval.";
      } catch (e) {
        throw new Error(getApiError(e, "Submit failed."));
      }
    });

  return { ...state, submit };
}

// ─── Approve ──────────────────────────────────────────────────────────────────

export function useSivApprove(
  companyId: string,
  sivId:     string,
  onSuccess: () => Promise<void>
) {
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const approve = async (
    rowVersion: string | null,
    remarks?:   string,
    lines?:     ApproveSivLineRequest[]
  ) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await sivApi.approve(companyId, sivId, {
        rowVersion,
        remarks: remarks || null,
        lines:   lines?.length ? lines : null,
      });
      setSuccess("SIV approved.");
      await onSuccess();
    } catch (e) {
      setError(getApiError(e, "Approval failed."));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, approve, reset: () => { setError(null); setSuccess(null); } };
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export function useSivReject(
  companyId: string,
  sivId:     string,
  onSuccess: () => Promise<void>
) {
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reject = async (rowVersion: string | null, remarks: string) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await sivApi.reject(companyId, sivId, { rowVersion, remarks });
      setSuccess("SIV rejected.");
      await onSuccess();
    } catch (e) {
      setError(getApiError(e, "Rejection failed."));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, reject, reset: () => { setError(null); setSuccess(null); } };
}

// ─── Request Changes ──────────────────────────────────────────────────────────

export function useSivRequestChanges(
  companyId: string,
  sivId:     string,
  onSuccess: () => Promise<void>
) {
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requestChanges = async (rowVersion: string | null, remarks: string) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await sivApi.requestChanges(companyId, sivId, { rowVersion, remarks });
      setSuccess("SIV returned to requester for changes.");
      await onSuccess();
    } catch (e) {
      setError(getApiError(e, "Request changes failed."));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, requestChanges, reset: () => { setError(null); setSuccess(null); } };
}

// ─── Issue ────────────────────────────────────────────────────────────────────

export function useSivIssue(
  companyId: string,
  sivId:     string,
  onSuccess: () => Promise<void>
) {
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const issue = async (
    rowVersion: string | null,
    remarks?:   string,
    lines?:     IssueSivLineRequest[]
  ) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await sivApi.issue(companyId, sivId, {
        rowVersion,
        remarks: remarks || null,
        lines:   lines?.length ? lines : null,
      });
      setSuccess("SIV issued. Ready to post.");
      await onSuccess();
    } catch (e) {
      setError(getApiError(e, "Issue failed."));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, issue, reset: () => { setError(null); setSuccess(null); } };
}

// ─── Post ─────────────────────────────────────────────────────────────────────

export function useSivPost(
  companyId: string,
  sivId:     string,
  onSuccess: () => Promise<void>
) {
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const post = async () => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const res = await sivApi.post(companyId, sivId);
      if (res?.data?.error) throw new Error(res.data.error);
      setSuccess("SIV posted. FIFO lots consumed and ledger entries created.");
      await onSuccess();
    } catch (e) {
      setError(getApiError(e, "Post failed."));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, post, reset: () => { setError(null); setSuccess(null); } };
}

// ─── Reverse ──────────────────────────────────────────────────────────────────

export function useSivReverse(
  companyId: string,
  sivId:     string,
  onSuccess: () => Promise<void>
) {
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reverse = async (rowVersion: string | null, reason: string) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await sivApi.reverse(companyId, sivId, { rowVersion, reason });
      setSuccess("SIV reversed. Stock balances restored.");
      await onSuccess();
    } catch (e) {
      setError(getApiError(e, "Reversal failed."));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, reverse, reset: () => { setError(null); setSuccess(null); } };
}

// ─── Create Draft ─────────────────────────────────────────────────────────────

export function useSivCreateDraft(companyId: string) {
  const nav = useNavigate();
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const create = async (body: CreateSivDraftRequest): Promise<string | null> => {
    setBusy(true); setError(null);
    try {
      const result = await sivApi.createDraft(companyId, body);
      return result.data.id;
    } catch (e) {
      setError(getApiError(e, "Failed to create SIV draft."));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, create };
}
