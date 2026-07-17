import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getTelegramInitData,
  getTelegramRuntimeState,
  getTelegramStartParam,
  waitForTelegramMiniApp,
  type TelegramRuntimeState,
} from "./telegramWebApp";

import {
  authenticateTelegramMiniApp,
  linkTelegramEmployee,
} from "./telegramMiniAppApi";

import type {
  TelegramMiniAppAuthResult,
  TelegramMiniAppSession,
} from "./telegramMiniApp.types";

type Options = {
  tenantKey?: string | null;
};

function resolveTenantKey(options?: Options): string | null {
  return (
    options?.tenantKey ??
    getTelegramRuntimeState().startParam ??
    getTelegramStartParam() ??
    null
  );
}

export function useTelegramMiniAppSession(options?: Options) {
  const [runtime, setRuntime] = useState<TelegramRuntimeState>(() =>
    getTelegramRuntimeState(),
  );

  const [session, setSession] = useState<TelegramMiniAppSession>({
    state: "loading",
    message: "Preparing Telegram Mini App...",
  });

  const initData = useMemo(() => getTelegramInitData(), [runtime.hasInitData]);

  const authenticate = useCallback(
    async (signal?: AbortSignal) => {
      const current = getTelegramRuntimeState();
      setRuntime(current);

      if (!current.webAppLoaded) {
        setSession({
          state: "browser-preview",
          message: "Open this page from Telegram to authenticate.",
        });
        return;
      }

      const currentInitData = getTelegramInitData();

      if (!currentInitData) {
        setSession({
          state: "missing-init-data",
          message:
            "Open this Mini App from the Telegram bot menu or WebApp button.",
        });
        return;
      }

      const tenantKey =
        options?.tenantKey ?? current.startParam ?? getTelegramStartParam();

      if (!tenantKey) {
        setSession({
          state: "error",
          message:
            "Tenant context is missing. Open the Mini App from the tenant bot link, for example ?startapp=ambassador.",
        });
        return;
      }

      setSession({
        state: "loading",
        message: "Authenticating Telegram account...",
      });

      const result = await authenticateTelegramMiniApp({
        initData: currentInitData,
        tenantKey,
        signal,
      });

      setSession(resolveAuthState(result));
    },
    [options?.tenantKey],
  );

  useEffect(() => {
    const abort = new AbortController();

    const stopWaiting = waitForTelegramMiniApp((state) => {
      setRuntime(state);

      if (state.webAppLoaded) {
        authenticate(abort.signal).catch((error) => {
          if (!abort.signal.aborted) {
            setSession({
              state: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Telegram authentication failed.",
            });
          }
        });
      } else {
        setSession({
          state: "browser-preview",
          message: "Telegram runtime was not detected.",
        });
      }
    });

    return () => {
      abort.abort();
      stopWaiting();
    };
  }, [authenticate]);

  const linkEmployee = useCallback(
    async (linkToken: string) => {
      const token = linkToken.trim();

      if (!token) {
        throw new Error("Employee link code is required.");
      }

      const tenantKey = resolveTenantKey(options);

      if (!tenantKey) {
        throw new Error(
          "Tenant context is missing. Open the Mini App from the tenant bot link.",
        );
      }

      const currentInitData = getTelegramInitData();

      if (!currentInitData) {
        throw new Error("Telegram authentication data is missing.");
      }

      await linkTelegramEmployee({
        initData: currentInitData,
        tenantKey,
        linkToken: token,
        consentAccepted: true,
      });

      const result = await authenticateTelegramMiniApp({
        initData: currentInitData,
        tenantKey,
      });

      setSession(resolveAuthState(result));
    },
    [options?.tenantKey],
  );

  const refresh = useCallback(() => {
    authenticate().catch((error) => {
      setSession({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "Telegram authentication failed.",
      });
    });
  }, [authenticate]);

  return {
    runtime,
    session,
    initData,
    refresh,
    linkEmployee,
  };
}

function resolveAuthState(
  result: TelegramMiniAppAuthResult,
): TelegramMiniAppSession {
  if (!result.success) {
    return {
      state: "error",
      message: result.message ?? "Telegram authentication failed.",
    };
  }

  if (result.requiresEmployeeLink) {
    return {
      state: "needs-link",
      auth: result,
    };
  }

  return {
    state: "ready",
    auth: result,
  };
}
