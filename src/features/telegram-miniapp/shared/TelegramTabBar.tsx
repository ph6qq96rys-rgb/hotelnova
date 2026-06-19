import React from "react";

export type TelegramTabKey =
  | "home"
  | "attendance"
  | "siv"
  | "inventory"
  | "requests"
  | "profile";

export interface TelegramTabItem {
  key: TelegramTabKey;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

interface TelegramTabBarProps {
  activeTab: TelegramTabKey;
  onChange: (tab: TelegramTabKey) => void;
  items?: TelegramTabItem[];
}

const defaultTabs: TelegramTabItem[] = [
  {
    key: "home",
    label: "Home",
    icon: "🏠"
  },
  {
    key: "attendance",
    label: "Scan",
    icon: "📷"
  },
  {
    key: "siv",
    label: "Request",
    icon: "📝"
  },
  {
    key: "inventory",
    label: "Stock",
    icon: "📦"
  },
  {
    key: "profile",
    label: "Me",
    icon: "👤"
  }
];

export default function TelegramTabBar({
  activeTab,
  onChange,
  items = defaultTabs
}: TelegramTabBarProps) {
  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 64,
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        background: "#ffffff",
        borderTop: "1px solid #e5e7eb",
        zIndex: 1000,
        boxShadow: "0 -2px 8px rgba(0,0,0,0.08)"
      }}
    >
      {items.map(tab => {
        const isActive = tab.key === activeTab;

        return (
          <button
            key={tab.key}
            type="button"
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            style={{
              border: "none",
              background: "transparent",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              cursor: tab.disabled ? "not-allowed" : "pointer",
              opacity: tab.disabled ? 0.4 : 1,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#2481cc" : "#6b7280"
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>

            <span
              style={{
                fontSize: 11,
                lineHeight: 1
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}