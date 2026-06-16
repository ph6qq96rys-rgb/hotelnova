import { useCallback, useEffect, useState } from "react";
import { posApi } from "../api/posApi";
import type {
  OpenSessionRequest,
  PosSessionDto,
  SessionReportDto,
} from "../types/posTypes";

function normalizeSession(session: PosSessionDto | null | undefined): PosSessionDto | null {
  if (!session || typeof session !== "object") return null;
  if (!session.id) return null;

  return session;
}

export function isSessionOpen(session: PosSessionDto | null): boolean {
  if (!session) return false;

  const status = String(session.status ?? "")
    .trim()
    .toLowerCase();

  return status === "open" || status === "1";
}

export function usePosSession() {
  const [session, setSession] = useState<PosSessionDto | null>(null);
  const [xReport, setXReport] = useState<SessionReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const current = normalizeSession(await posApi.currentSession());
      setSession(current);
      return current;
    } catch (err) {
      setSession(null);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load POS session."
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = useCallback(async (body: OpenSessionRequest) => {
    setBusy(true);
    setError(null);

    try {
      const created = normalizeSession(await posApi.openSession(body));

      if (!created) {
        throw new Error("POS session was opened but could not be loaded.");
      }

      setSession(created);
      return created;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to open POS session."
      );
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const close = useCallback(async (closingFloat: number) => {
    if (!session?.id) {
      throw new Error("No active POS session.");
    }

    if (closingFloat < 0) {
      throw new Error("Closing float cannot be negative.");
    }

    setBusy(true);
    setError(null);

    try {
      const closed = await posApi.closeSession(session.id, {
        closingFloat,
      });

      setSession(null);
      setXReport(null);

      return closed;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to close POS session."
      );
      throw err;
    } finally {
      setBusy(false);
    }
  }, [session?.id]);

  const loadXReport = useCallback(async () => {
    if (!session?.id) {
      throw new Error("No active POS session.");
    }

    setError(null);

    try {
      const report = await posApi.xReport(session.id);
      setXReport(report);
      return report;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load X report."
      );
      throw err;
    }
  }, [session?.id]);

  const runZReport = useCallback(async () => {
    if (!session?.id) {
      throw new Error("No active POS session.");
    }

    setError(null);

    try {
      const report = await posApi.zReport(session.id);
      setXReport(report);
      return report;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to run Z report."
      );
      throw err;
    }
  }, [session?.id]);

  return {
    session,
    setSession,
    xReport,
    loading,
    busy,
    error,
    isOpen: isSessionOpen(session),
    refresh,
    open,
    close,
    loadXReport,
    runZReport,
  };
}