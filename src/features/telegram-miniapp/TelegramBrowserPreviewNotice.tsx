import { memo } from "react";

function TelegramBrowserPreviewNotice() {
  return (
    <div className="tg-mini-notice">
      <strong>Preview mode</strong>
      <span>
        Open this page from the Telegram bot to authenticate, link your employee
        profile, and use Telegram-only features.
      </span>
    </div>
  );
}

export default memo(TelegramBrowserPreviewNotice);
