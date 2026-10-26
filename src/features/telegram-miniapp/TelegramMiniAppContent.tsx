import { memo } from "react";
import { UserRound } from "lucide-react";

import { useI18n } from "../../i18n";

import TelegramAttendanceScannerPage from "./attendance/TelegramAttendanceScannerPage";
import TelegramApprovalsPage from "./approvals/TelegramApprovalsPage";
import TelegramMyRequestsPage from "./requests/TelegramMyRequestsPage";
import TelegramSivRequestPage from "./siv-request/TelegramSivRequestPage";
import TelegramMiniAppHome from "./TelegramMiniAppHome";

import type { TelegramTabKey } from "./TelegramTabBar";
import type { TelegramMiniAppAuthResult } from "./telegramMiniApp.types";
import type { TelegramRuntimeState } from "./telegramWebApp";

type Props = {
  activeTab: TelegramTabKey;
  onOpenTab: (tab: TelegramTabKey) => void;
  auth: TelegramMiniAppAuthResult;
  runtime: TelegramRuntimeState;
  onApprovalsChanged?: (count: number) => void;
};

function TelegramMiniAppContent({ activeTab, onOpenTab, auth, runtime, onApprovalsChanged }: Props) {
  switch (activeTab) {
    case "attendance":
      return <TelegramAttendanceScannerPage />;

    case "inventory":
      return <TelegramSivRequestPage auth={auth} onSubmitted={() => onOpenTab("requests")} />;

    case "requests":
      return <TelegramMyRequestsPage auth={auth} onNewStockRequest={() => onOpenTab("inventory")} />;

    case "approvals":
      return <TelegramApprovalsPage auth={auth} onCountChange={onApprovalsChanged} />;

    case "profile":
      return <TelegramProfilePanel auth={auth} runtime={runtime} />;

    case "workspace":
    default:
      return <TelegramMiniAppHome onOpenTab={onOpenTab} auth={auth} runtime={runtime} />;
  }
}

export default memo(TelegramMiniAppContent);

function TelegramProfilePanel({ auth, runtime }: { auth: TelegramMiniAppAuthResult; runtime: TelegramRuntimeState }) {
  const { tx } = useI18n();
  const telegram = auth.telegramUserName
    ? `@${auth.telegramUserName}`
    : auth.telegramDisplayName ?? runtime.user?.username ?? tx("Linked");

  return (
    <section className="tg-card">
      <div className="tg-avatar" aria-hidden="true">
        <UserRound size={28} />
      </div>

      <div>
        <h2 className="tg-card__title">{auth.employeeName ?? tx("Employee")}</h2>
        <p className="tg-card__hint">{auth.employeeCode ?? tx("No employee code")}</p>
      </div>

      <dl className="tg-details">
        <div>
          <dt>{tx("Company")}</dt>
          <dd>{auth.companyName ?? "-"}</dd>
        </div>
        <div>
          <dt>{tx("Branch")}</dt>
          <dd>{auth.branchName ?? tx("Not assigned")}</dd>
        </div>
        <div>
          <dt>{tx("ERP access")}</dt>
          <dd>{auth.userId ? tx("ERP user linked") : tx("Not linked: stock requests and approvals are unavailable")}</dd>
        </div>
        <div>
          <dt>{tx("Telegram")}</dt>
          <dd>{telegram}</dd>
        </div>
      </dl>
    </section>
  );
}
