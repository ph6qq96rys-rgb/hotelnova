import type { TelegramTabKey } from "./TelegramTabBar";

export type TelegramMiniAppModule =
  | "workspace"
  | "hr"
  | "inventory"
  | "approval"
  | "profile";

export type TelegramMenuItem = {
  tab: TelegramTabKey;
  module: TelegramMiniAppModule;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
};

export type TelegramPageMeta = {
  title: string;
  subtitle: string;
};

export type TelegramMiniAppAuthResult = {
  success: boolean;
  message?: string | null;
  requiresEmployeeLink: boolean;

  companyId?: string | null;
  employeeId?: string | null;
  userId?: string | null;
  branchId?: string | null;

  employeeName?: string | null;
  employeeCode?: string | null;

  telegramUserId?: number | null;
  telegramUserName?: string | null;
  telegramDisplayName?: string | null;
};

export type TelegramMiniAppSession =
  | {
      state: "loading";
      message?: string;
    }
  | {
      state: "browser-preview";
      message?: string;
    }
  | {
      state: "missing-init-data";
      message?: string;
    }
  | {
      state: "needs-link";
      auth: TelegramMiniAppAuthResult;
    }
  | {
      state: "ready";
      auth: TelegramMiniAppAuthResult;
    }
  | {
      state: "error";
      message: string;
    };
