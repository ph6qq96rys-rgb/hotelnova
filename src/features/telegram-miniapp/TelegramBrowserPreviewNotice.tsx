import { memo } from "react";
import { useI18n } from "../../i18n";

function TelegramBrowserPreviewNotice() {
  const { tx } = useI18n();
  return (
    <div className="tg-mini-notice">
      <strong>{tx("Preview mode")}</strong>
      <span>
        {tx("Open this page from the Telegram bot to authenticate, link your employee profile, and use Telegram-only features.")}
      </span>
    </div>
  );
}

export default memo(TelegramBrowserPreviewNotice);
