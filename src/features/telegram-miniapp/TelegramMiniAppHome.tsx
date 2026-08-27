import { memo, useCallback } from "react";

import type { TelegramTabKey } from "./TelegramTabBar";
import type {
  TelegramMenuItem,
  TelegramMiniAppAuthResult,
} from "./telegramMiniApp.types";
import type { TelegramRuntimeState } from "./telegramWebApp";
import { TELEGRAM_MENU_ITEMS } from "./telegramMiniAppMenu";

type Props = {
  onOpenTab: (tab: TelegramTabKey) => void;
  auth: TelegramMiniAppAuthResult;
  runtime: TelegramRuntimeState;
};

function TelegramMiniAppHome({ onOpenTab, auth, runtime }: Props) {
  return (
    <section className="tg-mini-home">
      <section className="tg-mini-hero">
        <div className="tg-mini-hero__top">
          <div>
            <div className="tg-mini-eyebrow">Hotel Nova</div>
            <h2 className="tg-mini-hero__title">
              {auth.employeeName
                ? `Welcome, ${auth.employeeName}`
                : "Mobile operations workspace"}
            </h2>
          </div>

          <div className="tg-mini-hero__icon"></div>
        </div>

        <p className="tg-mini-hero__text">
          Attendance, inventory requests, approvals, and employee self-service
          from Telegram.
        </p>
      </section>

      <section className="tg-mini-stats">
        <InfoPill label="Access" value="Linked Employee" />
        <InfoPill
          label="Telegram"
          value={
            auth.telegramUserName
              ? `@${auth.telegramUserName}`
              : runtime.user?.username
                ? `@${runtime.user.username}`
                : "Verified"
          }
        />
        <InfoPill label="Employee" value={auth.employeeCode ?? "-"} />
        <InfoPill
          label="Branch"
          value={auth.branchId ? "Assigned" : "Not assigned"}
        />
      </section>

      <section className="tg-mini-section">
        <div className="tg-mini-section__header">
          <h3>ERP modules</h3>
          <span>Tap to continue</span>
        </div>

        <div className="tg-mini-menu">
          {TELEGRAM_MENU_ITEMS.map((item) => (
            <MenuCard key={item.tab} item={item} onOpenTab={onOpenTab} />
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
      <strong>{value}</strong>
    </div>
  );
}

function MenuCard({
  item,
  onOpenTab,
}: {
  item: TelegramMenuItem;
  onOpenTab: (tab: TelegramTabKey) => void;
}) {
  const handleClick = useCallback(() => {
    if (!item.disabled) {
      onOpenTab(item.tab);
    }
  }, [item.disabled, item.tab, onOpenTab]);

  return (
    <button
      type="button"
      className={`tg-mini-menu-card ${
        item.disabled ? "tg-mini-menu-card--disabled" : ""
      }`}
      onClick={handleClick}
      disabled={item.disabled}
    >
      <span className="tg-mini-menu-card__icon">{item.icon}</span>

      <span className="tg-mini-menu-card__body">
        <span className="tg-mini-menu-card__title-row">
          <strong>{item.title}</strong>
          {item.badge ? <span>{item.badge}</span> : null}
        </span>

        <small>{item.description}</small>
      </span>

      <span className="tg-mini-menu-card__chevron"></span>
    </button>
  );
}
