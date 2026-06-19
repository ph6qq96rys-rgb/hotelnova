import type { ReactNode } from "react";
import { useMemo } from "react";
import { getTelegramTheme } from "../telegramWebApp";

type TelegramMiniAppShellProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
};

export default function TelegramMiniAppShell({
  title,
  subtitle,
  children,
  footer,
  noPadding = false
}: TelegramMiniAppShellProps) {
  const theme = getTelegramTheme();

  const shellStyle = useMemo<React.CSSProperties>(
    () => ({
      minHeight: "100vh",
      padding: noPadding ? 0 : 16,
      paddingBottom: footer ? 96 : noPadding ? 0 : 16,
      boxSizing: "border-box",
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      background: theme.bg_color ?? "#ffffff",
      color: theme.text_color ?? "#111111"
    }),
    [theme, footer, noPadding]
  );

  return (
    <>
      <main style={shellStyle}>
        {(title || subtitle) && (
          <header style={{ marginBottom: 16 }}>
            {title && (
              <h2 style={{ margin: "0 0 4px" }}>
                {title}
              </h2>
            )}

            {subtitle && (
              <p
                style={{
                  margin: 0,
                  color: theme.hint_color ?? "#6b7280",
                  fontSize: 14
                }}
              >
                {subtitle}
              </p>
            )}
          </header>
        )}

        {children}
      </main>

      {footer}
    </>
  );
}