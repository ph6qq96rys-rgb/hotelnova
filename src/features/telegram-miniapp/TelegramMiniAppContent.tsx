import { memo } from "react";
import { useI18n } from "../../i18n";

import TelegramAttendanceScannerPage from "./attendance/TelegramAttendanceScannerPage";
import TelegramHrRequestsPage from "./hr-requests/TelegramHrRequestsPage";
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
  const { tx } = useI18n();
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
            <h3>{tx("Inventory Operations")}</h3>
            <span>ERP</span>
          </div>

          <div className="tg-mini-menu">
            <button
              type="button"
              className="tg-mini-menu-card"
              onClick={() => onOpenTab("requests")}
            >
              <span className="tg-mini-menu-card__icon">REQ</span>
              <span className="tg-mini-menu-card__body">
                <span className="tg-mini-menu-card__title-row">
                  <strong>{tx("My Requests")}</strong>
                </span>
                <small>{tx("Track leave, overtime, and SIV requests.")}</small>
              </span>
              <span className="tg-mini-menu-card__chevron">&gt;</span>
            </button>

            <TelegramSivRequestPage />
          </div>
        </section>
      );

    case "requests":
      return <TelegramHrRequestsPage auth={auth} />;

    case "approvals":
      return (
        <TelegramComingSoon
          icon="OK"
          title={tx("Approvals")}
          description={tx("Assigned approvals will appear here once approval list endpoints are connected.")}
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
  const { tx } = useI18n();
  return (
    <section className="tg-profile-card">
      <div className="tg-profile-card__icon">ME</div>

      <h2>{auth.employeeName ?? tx("Employee")}</h2>
      <p>{auth.employeeCode ?? tx("No employee code")}</p>

      <dl>
        <div>
          <dt>{tx("Company")}</dt>
          <dd>{auth.companyId ?? "-"}</dd>
        </div>

        <div>
          <dt>{tx("Branch")}</dt>
          <dd>{auth.branchId ?? tx("Not assigned")}</dd>
        </div>

        <div>
          <dt>{tx("ERP User")}</dt>
          <dd>{auth.userId ?? tx("Not linked")}</dd>
        </div>

        <div>
          <dt>{tx("Telegram")}</dt>
          <dd>
            {auth.telegramUserName
              ? `@${auth.telegramUserName}`
              : auth.telegramDisplayName ?? runtime.user?.username ?? tx("Linked")}
          </dd>
        </div>

        <div>
          <dt>{tx("Telegram ID")}</dt>
          <dd>{auth.telegramUserId ?? runtime.userId ?? "-"}</dd>
        </div>
      </dl>
    </section>
  );
}
