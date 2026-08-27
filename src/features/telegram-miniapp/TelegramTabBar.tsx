import React, { memo, useMemo } from "react";

import { getTelegramTheme } from "./telegramWebApp";

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
  icon: React.ReactNode;
  disabled?: boolean;
}

interface TelegramTabBarProps {
  activeTab: TelegramTabKey;
  onChange: (tab: TelegramTabKey) => void;
  items?: TelegramTabItem[];
}

const defaultTabs: TelegramTabItem[] = [
  { key: "workspace", label: "Home", icon: "" },
  { key: "attendance", label: "Scan", icon: "" },
  { key: "inventory", label: "Inventory", icon: "" },
  { key: "requests", label: "Requests", icon: "" },
  { key: "profile", label: "Me", icon: "" },
];

export default function TelegramTabBar({
  activeTab,
  onChange,
  items = defaultTabs,
}: TelegramTabBarProps) {
  const theme = getTelegramTheme();
  const styles = useMemo(
    () => createStyles(theme, items.length),
    [theme, items.length]
  );

  return (
    <nav style={styles.nav} aria-label="Telegram Mini App navigation">
      {items.map((tab) => (
        <TabButton
          key={tab.key}
          tab={tab}
          active={tab.key === activeTab}
          onChange={onChange}
          styles={styles}
        />
      ))}
    </nav>
  );
}

const TabButton = memo(function TabButton({
  tab,
  active,
  onChange,
  styles,
}: {
  tab: TelegramTabItem;
  active: boolean;
  onChange: (tab: TelegramTabKey) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <button
      type="button"
      disabled={tab.disabled}
      onClick={() => {
        if (!tab.disabled) onChange(tab.key);
      }}
      aria-current={active ? "page" : undefined}
      style={{
        ...styles.button,
        ...(active ? styles.buttonActive : null),
        ...(tab.disabled ? styles.buttonDisabled : null),
      }}
    >
      <span
        style={{
          ...styles.activeIndicator,
          ...(active ? styles.activeIndicatorVisible : null),
        }}
      />

      <span
        style={{
          ...styles.icon,
          ...(active ? styles.iconActive : null),
        }}
      >
        {tab.icon}
      </span>

      <span
        style={{
          ...styles.label,
          ...(active ? styles.labelActive : null),
        }}
      >
        {tab.label}
      </span>
    </button>
  );
});

function createStyles(theme: Record<string, string>, itemCount: number) {
  const cardBg = theme.secondary_bg_color ?? "#ffffff";
  const hint = theme.hint_color ?? "#6b7280";
  const button = theme.button_color ?? "#2481cc";
  const border = theme.hint_color ? `${theme.hint_color}33` : "#e5e7eb";

  return {
    nav: {
      height: 68,
      display: "grid",
      gridTemplateColumns: `repeat(${itemCount}, minmax(0, 1fr))`,
      background: cardBg,
      borderTop: `1px solid ${border}`,
      boxShadow: "0 -12px 26px rgba(15, 23, 42, 0.08)",
      padding: "4px 8px calc(4px + env(safe-area-inset-bottom))",
      boxSizing: "content-box",
    },

    button: {
      position: "relative",
      border: "none",
      background: "transparent",
      minWidth: 0,
      minHeight: 60,
      padding: "8px 4px 6px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      cursor: "pointer",
      color: hint,
      WebkitTapHighlightColor: "transparent",
      borderRadius: 16,
    },

    buttonActive: {
      color: button,
      background: `${button}12`,
    },

    buttonDisabled: {
      opacity: 0.42,
      cursor: "not-allowed",
    },

    activeIndicator: {
      position: "absolute",
      top: 4,
      width: 20,
      height: 3,
      borderRadius: 999,
      background: button,
      opacity: 0,
    },

    activeIndicatorVisible: {
      opacity: 1,
    },

    icon: {
      fontSize: 21,
      lineHeight: 1,
      filter: "grayscale(0.15)",
    },

    iconActive: {
      filter: "none",
      transform: "translateY(-1px)",
    },

    label: {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: 11,
      lineHeight: 1,
      fontWeight: 700,
      color: hint,
    },

    labelActive: {
      color: button,
      fontWeight: 900,
    },
  } satisfies Record<string, React.CSSProperties>;
}
