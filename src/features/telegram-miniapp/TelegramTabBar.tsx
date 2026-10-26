import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { ClipboardCheck, ClipboardList, Home, Package, QrCode } from "lucide-react";

import { useI18n } from "../../i18n";

export type TelegramTabKey =
  | "workspace"
  | "attendance"
  | "inventory"
  | "requests"
  | "approvals"
  | "profile";

export interface TelegramTabItem {
  key: TelegramTabKey;
  label: string;
  icon: LucideIcon;
}

interface TelegramTabBarProps {
  activeTab: TelegramTabKey;
  onChange: (tab: TelegramTabKey) => void;
  items?: TelegramTabItem[];
  /** Number shown on a tab (for example approvals waiting). */
  badges?: Partial<Record<TelegramTabKey, number>>;
}

const defaultTabs: TelegramTabItem[] = [
  { key: "workspace", label: "Home", icon: Home },
  { key: "attendance", label: "Scan", icon: QrCode },
  { key: "inventory", label: "Stock", icon: Package },
  { key: "requests", label: "Requests", icon: ClipboardList },
  { key: "approvals", label: "Approvals", icon: ClipboardCheck },
];

function TelegramTabBar({ activeTab, onChange, items = defaultTabs, badges }: TelegramTabBarProps) {
  const { tx } = useI18n();
  // Profile is opened from Home, so Home stays highlighted there.
  const current = activeTab === "profile" ? "workspace" : activeTab;

  return (
    <nav className="tg-mini-tabbar" aria-label={tx("Telegram Mini App navigation")}>
      {items.map((tab) => {
        const Icon = tab.icon;
        const badge = badges?.[tab.key] ?? 0;
        return (
          <button
            key={tab.key}
            type="button"
            className="tg-mini-tab"
            aria-current={tab.key === current ? "page" : undefined}
            onClick={() => onChange(tab.key)}
          >
            <Icon size={21} aria-hidden="true" />
            {badge > 0 ? <span className="tg-mini-tab__badge">{badge > 99 ? "99+" : badge}</span> : null}
            <span className="tg-mini-tab__label">{tx(tab.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default memo(TelegramTabBar);
