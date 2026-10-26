import type { ReactNode } from "react";
import { memo } from "react";

import { LanguageSelector } from "../../components/LanguageSelector";
import { useI18n } from "../../i18n";

type TelegramMiniAppShellProps = {
  title?: string;
  subtitle?: string;
  /** Shown as-is (a company name, for example) rather than translated. */
  subtitleIsName?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

/** Page frame for the Mini App. Colours come from the Telegram theme mapped onto the app tokens. */
function TelegramMiniAppShell({ title, subtitle, subtitleIsName = false, children, footer }: TelegramMiniAppShellProps) {
  const { tx } = useI18n();

  return (
    <div className="tg-mini-host">
      <div className="tg-mini-root">
        <main className={`tg-mini-shell${footer ? "" : " tg-mini-shell--bare"}`}>
          {(title || subtitle) && (
            <header className="tg-mini-header">
              <div className="tg-mini-header__text">
                {title && <h1>{tx(title)}</h1>}
                {subtitle && <p>{subtitleIsName ? subtitle : tx(subtitle)}</p>}
              </div>

              <div className="tg-mini-language">
                <LanguageSelector compact />
              </div>
            </header>
          )}

          {children}
        </main>

        {footer}
      </div>
    </div>
  );
}

export default memo(TelegramMiniAppShell);
