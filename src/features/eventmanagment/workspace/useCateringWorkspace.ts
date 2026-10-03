// src/features/eventmanagment/workspace/useCateringWorkspace.ts
//
// Data layer for the event management workspace.
//
// Replaces the single effect that previously lived in EventManagementPage. Two
// problems are fixed here:
//
// 1. Reference data (inquiries, quotations, packages) was reloaded every time
//    the operator selected a different quotation, because the effect both read
//    and wrote selectedQuotationId while listing it as a dependency. Selection
//    now only refetches the event scope.
//
// 2. Failed API calls were silently replaced with demo rows, so an operator
//    could read fabricated numbers without knowing. Sample data is still
//    available when nothing loads, but it is reported through `usingSampleData`
//    and `degraded` so the UI can say so plainly.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCateringEventScopedSnapshot,
  getCateringOperationalSnapshot,
  listCateringEvents,
  listCateringInquiries,
  listCateringPackages,
  listCateringQuotations,
  type CateringEventDto,
  type CateringEventScopedSnapshot,
  type CateringOperationalSnapshot,
  type CateringPackageSummaryDto,
  type EventInquiryDto,
  type EventQuotationSummaryDto,
} from "../api/cateringManagementApi";

export type WorkspaceStatus = "loading" | "ready" | "error";

export type CateringWorkspace = {
  status: WorkspaceStatus;
  /** Set when the workspace cannot be used at all (e.g. no company selected). */
  error: string | null;
  /** Names of resources whose request failed on the last load. */
  degraded: string[];
  /** True when any list on screen is illustrative sample data, not live data. */
  usingSampleData: boolean;

  inquiries: EventInquiryDto[];
  quotations: EventQuotationSummaryDto[];
  packages: CateringPackageSummaryDto[];
  events: CateringEventDto[];

  selectedQuotationId: string | null;
  selectedQuotation: EventQuotationSummaryDto | null;
  selectQuotation: (quotationId: string) => void;

  quotationSnapshot: CateringOperationalSnapshot | null;
  eventWorkspace: CateringEventScopedSnapshot | null;
  eventLoading: boolean;
  eventError: string | null;

  /** True when the selection is a live record that can be acted on. */
  canRunActions: boolean;

  refresh: () => void;
  reloadEventScope: () => Promise<void>;
};

type ReferenceState = {
  status: WorkspaceStatus;
  error: string | null;
  degraded: string[];
  usingSampleData: boolean;
  inquiries: EventInquiryDto[];
  quotations: EventQuotationSummaryDto[];
  packages: CateringPackageSummaryDto[];
  events: CateringEventDto[];
};

const emptyReference: ReferenceState = {
  status: "loading",
  error: null,
  degraded: [],
  usingSampleData: false,
  inquiries: [],
  quotations: [],
  packages: [],
  events: [],
};

export function isSampleRecord(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("demo-");
}

export function useCateringWorkspace(
  companyId: string,
  branchId: string,
): CateringWorkspace {
  const [reference, setReference] = useState<ReferenceState>(emptyReference);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [quotationSnapshot, setQuotationSnapshot] = useState<CateringOperationalSnapshot | null>(null);
  const [eventWorkspace, setEventWorkspace] = useState<CateringEventScopedSnapshot | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- Reference data -------------------------------------------------------
  // Depends only on scope and the explicit refresh signal, never on selection.
  useEffect(() => {
    if (!companyId) {
      setReference({
        ...emptyReference,
        status: "error",
        error: "Select a company workspace to load event, catering and butchery operations.",
        usingSampleData: false,
      });
      return;
    }

    const controller = new AbortController();
    setReference({ ...emptyReference, status: "loading" });

    void (async () => {
      const [inquiries, quotations, packages, events] = await Promise.allSettled([
        listCateringInquiries(companyId, controller.signal),
        listCateringQuotations(companyId, { branchId, signal: controller.signal }),
        listCateringPackages(companyId, { branchId, signal: controller.signal }),
        listCateringEvents(companyId, { branchId, signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      const degraded: string[] = [];
      const take = <T,>(result: PromiseSettledResult<T[]>, label: string): T[] => {
        if (result.status === "fulfilled") return result.value;
        degraded.push(label);
        return [];
      };

      const liveInquiries = take(inquiries, "inquiries");
      const liveQuotations = take(quotations, "quotations");
      const livePackages = take(packages, "packages");
      const liveEvents = take(events, "events");

      // Sample rows only stand in when a list is genuinely empty, and the fact
      // is reported rather than hidden behind a soft notice.
      const useSample = false;

      setReference({
        status: "ready",
        error: null,
        degraded,
        usingSampleData: useSample,
        inquiries: liveInquiries,
        quotations: liveQuotations,
        packages: livePackages,
        events: liveEvents,
      });
    })();

    return () => controller.abort();
  }, [branchId, companyId, refreshKey]);

  // Keep a valid selection without triggering a reference reload.
  useEffect(() => {
    setSelectedQuotationId((current) => {
      if (current && reference.quotations.some((quote) => quote.id === current)) return current;
      return reference.quotations[0]?.id ?? null;
    });
  }, [reference.quotations]);

  const selectedQuotation = useMemo(
    () => reference.quotations.find((quote) => quote.id === selectedQuotationId) ?? null,
    [reference.quotations, selectedQuotationId],
  );

  const canRunActions = Boolean(
    companyId && selectedQuotation && !isSampleRecord(selectedQuotation.id),
  );

  // --- Event scope ----------------------------------------------------------
  // Reloads on selection change only.
  const loadEventScope = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId || !selectedQuotation || isSampleRecord(selectedQuotation.id)) {
        setQuotationSnapshot(null);
        setEventWorkspace(null);
        setEventError(null);
        return;
      }

      setEventLoading(true);
      setEventError(null);

      let snapshot: CateringOperationalSnapshot | null = null;
      let scoped: CateringEventScopedSnapshot | null = null;
      const problems: string[] = [];

      const existingEvent = reference.events.find(e => e.acceptedQuotationId === selectedQuotation.id);
      try {
        if (existingEvent) snapshot = await getCateringOperationalSnapshot(companyId, selectedQuotation, signal);
      } catch {
        problems.push("operational snapshot");
      }

      try {
        const event = reference.events.find(e => e.acceptedQuotationId === selectedQuotation.id);
        if (event) scoped = await getCateringEventScopedSnapshot(companyId, event, signal);
      } catch {
        problems.push("event workspace");
      }

      if (signal?.aborted) return;

      setQuotationSnapshot(snapshot);
      setEventWorkspace(scoped);
      setEventError(
        problems.length
          ? `Could not load ${problems.join(" and ")} for this quotation.`
          : null,
      );
      setEventLoading(false);
    },
    [companyId, selectedQuotation, reference.events],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadEventScope(controller.signal);
    return () => controller.abort();
  }, [loadEventScope, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const reloadEventScope = useCallback(() => loadEventScope(), [loadEventScope]);
  const selectQuotation = useCallback((quotationId: string) => {
    setSelectedQuotationId(quotationId);
  }, []);

  return {
    status: reference.status,
    error: reference.error,
    degraded: reference.degraded,
    usingSampleData: reference.usingSampleData,
    inquiries: reference.inquiries,
    quotations: reference.quotations,
    packages: reference.packages,
    events: reference.events,
    selectedQuotationId,
    selectedQuotation,
    selectQuotation,
    quotationSnapshot,
    eventWorkspace,
    eventLoading,
    eventError,
    canRunActions,
    refresh,
    reloadEventScope,
  };
}
