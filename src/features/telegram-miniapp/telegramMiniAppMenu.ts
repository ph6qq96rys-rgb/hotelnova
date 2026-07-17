import type { TelegramTabKey } from "./TelegramTabBar";
import type { TelegramMenuItem, TelegramPageMeta } from "./telegramMiniApp.types";

export const TELEGRAM_MENU_ITEMS: TelegramMenuItem[] = [
  {
    tab: "attendance",
    module: "hr",
    icon: "📷",
    title: "Attendance",
    description: "Clock in or clock out using your branch QR code.",
  },
  {
    tab: "inventory",
    module: "inventory",
    icon: "📦",
    title: "Inventory",
    description: "Submit store requests and check stock tools.",
  },
  {
    tab: "requests",
    module: "approval",
    icon: "📋",
    title: "My Requests",
    description: "Track submitted SIVs and operational requests.",
  },
  {
    tab: "approvals",
    module: "approval",
    icon: "✅",
    title: "Approvals",
    description: "Review approvals assigned to you.",
    badge: "Soon",
    disabled: true,
  },
  {
    tab: "profile",
    module: "profile",
    icon: "👤",
    title: "My Profile",
    description: "View employee, branch, and Telegram link status.",
  },
];

export function getTelegramPageMeta(tab: TelegramTabKey): TelegramPageMeta {
  switch (tab) {
    case "attendance":
      return {
        title: "Attendance",
        subtitle: "Scan your branch QR code.",
      };

    case "inventory":
      return {
        title: "Inventory",
        subtitle: "Store requests and stock operations.",
      };

    case "requests":
      return {
        title: "My Requests",
        subtitle: "Track submitted requests.",
      };

    case "approvals":
      return {
        title: "Approvals",
        subtitle: "Review assigned approvals.",
      };

    case "profile":
      return {
        title: "My Profile",
        subtitle: "Employee and Telegram link status.",
      };

    case "workspace":
    default:
      return {
        title: "Workspace",
        subtitle: "HotelNova ERP mobile workspace",
      };
  }
}
