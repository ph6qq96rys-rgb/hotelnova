import { memo } from "react";
import { Building2, ChevronRight } from "lucide-react";

import { useI18n } from "../../i18n";
import type { TelegramTabKey } from "./TelegramTabBar";
import type { TelegramMenuItem, TelegramMiniAppAuthResult } from "./telegramMiniApp.types";
import type { TelegramRuntimeState } from "./telegramWebApp";
import { TELEGRAM_MENU_ITEMS } from "./telegramMiniAppMenu";

type Props = {
  onOpenTab: (tab: TelegramTabKey) => void;
  auth: TelegramMiniAppAuthResult;
  runtime: TelegramRuntimeState;
};

function TelegramMiniAppHome({ onOpenTab, auth, runtime }: Props) {
  const { tx } = useI18n();
  const telegramName = auth.telegramUserName
    ? `@${auth.telegramUserName}`
    : runtime.user?.username
      ? `@${runtime.user.username}`
      : tx("Verified");

  return (
    <section className="tg-mini-page">
      <section className="tg-mini-hero">
        <div className="tg-mini-hero__top">
          <div>
            {auth.companyName ? <div className="tg-mini-eyebrow">{auth.companyName}</div> : null}
            <h2 className="tg-mini-hero__title">
              {auth.employeeName
                ? tx("Welcome, {name}", { name: auth.employeeName })
                : tx("Mobile operations workspace")}
            </h2>
          </div>

          <div className="tg-mini-hero__icon" aria-hidden="true">
            <Building2 size={24} />
          </div>
        </div>

        <p className="tg-mini-hero__text">
          {tx("Attendance, stock requests, approvals and employee self-service from Telegram.")}
        </p>
      </section>

      <section className="tg-mini-stats">
        <InfoPill label={tx("Employee")} value={auth.employeeCode ?? "-"} />
        <InfoPill label={tx("Branch")} value={auth.branchName ?? tx("Not assigned")} />
        <InfoPill label="Telegram" value={telegramName} />
        <InfoPill label={tx("Access")} value={auth.userId ? tx("ERP user linked") : tx("Employee only")} />
      </section>

      <section className="tg-mini-section">
        <div className="tg-mini-section__header">
          <h3>{tx("What do you need?")}</h3>
        </div>

        <div className="tg-mini-menu">
          {TELEGRAM_MENU_ITEMS.map((item) => (
            <MenuCard key={item.tab} item={item} onOpenTab={onOpenTab} translate={tx} />
          ))}
        </div>
      </section>
    </section>
  );
}

export default memo(TelegramMiniAppHome);

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="tg-mini-pill">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function MenuCard({
  item,
  onOpenTab,
  translate,
}: {
  item: TelegramMenuItem;
  onOpenTab: (tab: TelegramTabKey) => void;
  translate: (text: string) => string;
}) {
  const Icon = item.icon;
  return (
    <button type="button" className="tg-mini-menu-card" onClick={() => onOpenTab(item.tab)}>
      <span className="tg-mini-menu-card__icon" aria-hidden="true">
        <Icon size={22} />
      </span>

      <span className="tg-mini-menu-card__body">
        <strong>{translate(item.title)}</strong>
        <small>{translate(item.description)}</small>
      </span>

      <ChevronRight className="tg-mini-menu-card__chevron" size={20} aria-hidden="true" />
    </button>
  );
}
