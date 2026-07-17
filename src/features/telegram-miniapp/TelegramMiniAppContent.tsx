import { memo } from "react";

import TelegramAttendanceScannerPage from "./attendance/TelegramAttendanceScannerPage";
import TelegramSivRequestPage from "./siv-request/TelegramSivRequestPage";
import TelegramMiniAppHome from "./TelegramMiniAppHome";
import TelegramComingSoon from "./TelegramComingSoon";

import type { TelegramTabKey } from "./TelegramTabBar";
import type { TelegramMiniAppAuthResult } from "./telegramMiniApp.types";
import type { TelegramRuntimeState } from "./telegramWebApp";

type Props = {
  activeTab: TelegramTabKey;
  onOpenTab: (tab: TelegramTabKey) => void;
  auth: TelegramMiniAppAuthResult;
  runtime: TelegramRuntimeState;
};

function TelegramMiniAppContent({
  activeTab,
  onOpenTab,
  auth,
  runtime,
}: Props) {
  switch (activeTab) {
    case "workspace":
      return (
        <TelegramMiniAppHome
          onOpenTab={onOpenTab}
          auth={auth}
          runtime={runtime}
        />
      );

    case "attendance":
      return <TelegramAttendanceScannerPage />;

    case "inventory":
      return (
        <section className="tg-mini-section">
          <div className="tg-mini-section__header">
            <h3>Inventory Operations</h3>
            <span>ERP</span>
          </div>

          <div className="tg-mini-menu">
            <button
              type="button"
              className="tg-mini-menu-card"
              onClick={() => onOpenTab("requests")}
            >
              <span className="tg-mini-menu-card__icon">📋</span>
              <span className="tg-mini-menu-card__body">
                <span className="tg-mini-menu-card__title-row">
                  <strong>My Requests</strong>
                </span>
                <small>Track submitted SIV requests.</small>
              </span>
              <span className="tg-mini-menu-card__chevron">›</span>
            </button>

            <TelegramSivRequestPage />
          </div>
        </section>
      );

    case "requests":
      return (
        <TelegramComingSoon
          icon="📋"
          title="My Requests"
          description="Submitted SIVs, approvals, rejections, and request history will be connected to the backend request list next."
        />
      );

    case "approvals":
      return (
        <TelegramComingSoon
          icon="✅"
          title="Approvals"
          description="Assigned approvals will appear here once approval list endpoints are connected."
        />
      );

    case "profile":
      return <TelegramProfilePanel auth={auth} runtime={runtime} />;

    default:
      return (
        <TelegramMiniAppHome
          onOpenTab={onOpenTab}
          auth={auth}
          runtime={runtime}
        />
      );
  }
}

export default memo(TelegramMiniAppContent);

function TelegramProfilePanel({
  auth,
  runtime,
}: {
  auth: TelegramMiniAppAuthResult;
  runtime: TelegramRuntimeState;
}) {
  return (
    <section className="tg-profile-card">
      <div className="tg-profile-card__icon">👤</div>

      <h2>{auth.employeeName ?? "Employee"}</h2>
      <p>{auth.employeeCode ?? "No employee code"}</p>

      <dl>
        <div>
          <dt>Company</dt>
          <dd>{auth.companyId ?? "—"}</dd>
        </div>

        <div>
          <dt>Branch</dt>
          <dd>{auth.branchId ?? "Not assigned"}</dd>
        </div>

        <div>
          <dt>ERP User</dt>
          <dd>{auth.userId ?? "Not linked"}</dd>
        </div>

        <div>
          <dt>Telegram</dt>
          <dd>
            {auth.telegramUserName
              ? `@${auth.telegramUserName}`
              : auth.telegramDisplayName ?? runtime.user?.username ?? "Linked"}
          </dd>
        </div>

        <div>
          <dt>Telegram ID</dt>
          <dd>{auth.telegramUserId ?? runtime.userId ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
