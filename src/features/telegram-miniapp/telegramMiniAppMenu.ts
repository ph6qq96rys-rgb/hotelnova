import { ClipboardCheck, ClipboardList, Package, QrCode, UserRound } from "lucide-react";

import type { TelegramTabKey } from "./TelegramTabBar";
import type { TelegramMenuItem, TelegramPageMeta } from "./telegramMiniApp.types";

export const TELEGRAM_MENU_ITEMS: TelegramMenuItem[] = [
  {
    tab: "attendance",
    module: "hr",
    icon: QrCode,
    title: "Attendance",
    description: "Clock in or clock out using your branch QR code.",
  },
  {
    tab: "inventory",
    module: "inventory",
    icon: Package,
    title: "Stock request",
    description: "Request items from the store for your location.",
  },
  {
    tab: "requests",
    module: "approval",
    icon: ClipboardList,
    title: "My Requests",
    description: "Track stock, leave and overtime requests.",
  },
  {
    tab: "approvals",
    module: "approval",
    icon: ClipboardCheck,
    title: "Approvals",
    description: "Approve or reject stock requests waiting for you.",
  },
  {
    tab: "profile",
    module: "profile",
    icon: UserRound,
    title: "My Profile",
    description: "Your employee, branch and Telegram link details.",
  },
];

export function getTelegramPageMeta(tab: TelegramTabKey, companyName?: string | null): TelegramPageMeta {
  switch (tab) {
    case "attendance":
      return { title: "Attendance", subtitle: "Scan your branch QR code." };
    case "inventory":
      return { title: "Stock request", subtitle: "Request items from the store." };
    case "requests":
      return { title: "My Requests", subtitle: "Track submitted requests." };
    case "approvals":
      return { title: "Approvals", subtitle: "Requests waiting for your decision." };
    case "profile":
      return { title: "My Profile", subtitle: "Employee and Telegram link status." };
    case "workspace":
    default:
      return { title: "Workspace", subtitle: companyName?.trim() || "Mobile workspace" };
  }
}
