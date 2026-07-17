import type { CSSProperties, ReactNode } from "react";
import { memo, useMemo } from "react";

import { getTelegramTheme } from "./telegramWebApp";

type TelegramMiniAppShellProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
};

function TelegramMiniAppShell({
  title,
  subtitle,
  children,
  footer,
  noPadding = false,
}: TelegramMiniAppShellProps) {
  const theme = getTelegramTheme();

  const styles = useMemo(
    () => createStyles(theme, footer, noPadding),
    [theme, footer, noPadding]
  );

  return (
    <div style={styles.root}>
      <main style={styles.shell}>
        {(title || subtitle) && (
          <header style={styles.header}>
            {title && <h1 style={styles.title}>{title}</h1>}
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </header>
        )}

        <section style={styles.content}>{children}</section>
      </main>

      {footer && <div style={styles.footer}>{footer}</div>}
    </div>
  );
}

export default memo(TelegramMiniAppShell);

function createStyles(
  theme: Record<string, string>,
  footer: ReactNode,
  noPadding: boolean
): Record<string, CSSProperties> {
  const bg = theme.bg_color ?? "#f6f7fb";
  const text = theme.text_color ?? "#111827";
  const hint = theme.hint_color ?? "#6b7280";
  const cardBg = theme.secondary_bg_color ?? "#ffffff";
  const border = theme.hint_color ? `${theme.hint_color}33` : "#e5e7eb";

  return {
    root: {
      minHeight: "100vh",
      background: bg,
      color: text,
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    },

    shell: {
      minHeight: "100vh",
      boxSizing: "border-box",
      padding: noPadding ? 0 : 16,
      paddingBottom: footer ? 112 : noPadding ? 0 : 16,
    },

    header: {
      marginBottom: 16,
      padding: "14px 14px",
      borderRadius: 22,
      background: cardBg,
      border: `1px solid ${border}`,
      boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)",
    },

    title: {
      margin: 0,
      fontSize: 22,
      lineHeight: 1.15,
      fontWeight: 900,
      color: text,
    },

    subtitle: {
      margin: "6px 0 0",
      color: hint,
      fontSize: 14,
      lineHeight: 1.4,
      fontWeight: 600,
    },

    content: {
      minWidth: 0,
    },

    footer: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      background: cardBg,
      borderTop: `1px solid ${border}`,
      boxShadow: "0 -12px 26px rgba(15, 23, 42, 0.08)",
      paddingBottom: "env(safe-area-inset-bottom)",
    },
  };
}
