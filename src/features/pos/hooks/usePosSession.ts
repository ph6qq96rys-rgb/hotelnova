import { useCallback, useEffect, useMemo, useState } from "react";
import { posApi, type PosScope } from "../api/posApi";
import { extractApiError } from "../utils/posUtils";
import type {
  OpenSessionRequest,
  PosSessionDto,
  SessionReportDto,
} from "../types/posTypes";

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSession(
  session: PosSessionDto | null | undefined,
): PosSessionDto | null {
  if (!session || typeof session !== "object") return null;
  if (!normalizeText(session.id)) return null;

  return session;
}

function validateScope(scope: PosScope): string | null {
  if (!normalizeText(scope.companyId)) {
    return "Company context is required before loading the POS session.";
  }

  if (!normalizeText(scope.branchId)) {
    return "Branch context is required before loading the POS session.";
  }

  return null;
}

function requireValidClosingFloat(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      "Closing float must be a valid non-negative amount.",
    );
  }
}

export function isSessionOpen(
  session: PosSessionDto | null,
): boolean {
  if (!session) return false;

  const status = normalizeText(session.status).toLowerCase();

  return status === "open" || status === "1";
}

export function usePosSession(scope: PosScope) {
  const activeScope = useMemo<PosScope>(
    () => ({
      companyId: normalizeText(scope.companyId),
      branchId: normalizeText(scope.branchId),
    }),
    [scope.companyId, scope.branchId],
  );

  const [session, setSession] = useState<PosSessionDto | null>(null);
  const [xReport, setXReport] = useState<SessionReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSessionState = useCallback(() => {
    setSession(null);
    setXReport(null);
  }, []);

  const requireValidScope = useCallback((): PosScope => {
    const scopeError = validateScope(activeScope);

    if (scopeError) {
      throw new Error(scopeError);
    }

    return activeScope;
  }, [activeScope]);

  const requireSessionId = useCallback((): string => {
    const sessionId = normalizeText(session?.id);

    if (!sessionId) {
      throw new Error("No active POS session.");
    }

    return sessionId;
  }, [session?.id]);

  const refresh = useCallback(async (): Promise<PosSessionDto | null> => {
    const scopeError = validateScope(activeScope);

    if (scopeError) {
      clearSessionState();
      setError(scopeError);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const current = normalizeSession(
        await posApi.currentSession(activeScope),
      );

      setSession(current);

      if (!current) {
        setXReport(null);
      }

      return current;
    } catch (requestError) {
      const message = extractApiError(
        requestError,
        "Failed to load the current POS session.",
      );

      clearSessionState();
      setError(message);

      return null;
    } finally {
      setLoading(false);
    }
  }, [activeScope, clearSessionState]);

  useEffect(() => {
    clearSessionState();
    void refresh();
  }, [
    activeScope.companyId,
    activeScope.branchId,
    clearSessionState,
    refresh,
  ]);

  const open = useCallback(
    async (body: OpenSessionRequest): Promise<PosSessionDto> => {
      const resolvedScope = requireValidScope();

      setBusy(true);
      setError(null);

      try {
        const created = normalizeSession(
          await posApi.openSession(resolvedScope, body),
        );

        if (!created) {
          throw new Error(
            "POS session was opened but the server did not return a valid session.",
          );
        }

        setSession(created);
        setXReport(null);

        return created;
      } catch (requestError) {
        const message = extractApiError(
          requestError,
          "Failed to open the POS session.",
        );

        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [requireValidScope],
  );

  const close = useCallback(
    async (closingFloat: number) => {
      const resolvedScope = requireValidScope();
      const sessionId = requireSessionId();

      requireValidClosingFloat(closingFloat);

      setBusy(true);
      setError(null);

      try {
        const closed = await posApi.closeSession(
          resolvedScope,
          sessionId,
          { closingFloat },
        );

        clearSessionState();

        return closed;
      } catch (requestError) {
        const message = extractApiError(
          requestError,
          "Failed to close the POS session.",
        );

        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [
      clearSessionState,
      requireSessionId,
      requireValidScope,
    ],
  );

  const loadXReport = useCallback(
    async (): Promise<SessionReportDto> => {
      const resolvedScope = requireValidScope();
      const sessionId = requireSessionId();

      setError(null);

      try {
        const report = await posApi.xReport(
          resolvedScope,
          sessionId,
        );

        setXReport(report);

        return report;
      } catch (requestError) {
        const message = extractApiError(
          requestError,
          "Failed to load the X report.",
        );

        setError(message);
        throw new Error(message);
      }
    },
    [requireSessionId, requireValidScope],
  );

  const runZReport = useCallback(
    async (): Promise<SessionReportDto> => {
      const resolvedScope = requireValidScope();
      const sessionId = requireSessionId();

      setBusy(true);
      setError(null);

      try {
        const report = await posApi.zReport(
          resolvedScope,
          sessionId,
        );

        setXReport(report);

        return report;
      } catch (requestError) {
        const message = extractApiError(
          requestError,
          "Failed to run the Z report.",
        );

        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [requireSessionId, requireValidScope],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
    clearError,
  };
}
