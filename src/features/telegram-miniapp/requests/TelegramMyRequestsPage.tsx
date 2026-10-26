import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { useI18n } from "../../../i18n";
import TelegramHrRequestsPage from "../hr-requests/TelegramHrRequestsPage";
import type { TelegramMiniAppAuthResult } from "../telegramMiniApp.types";
import { getMyTelegramSivs, type TelegramSivSummaryDto } from "../telegramMiniAppApi";
import { describeError } from "../telegramMiniAppClient";
import { TgCardHeader, TgSegment, TgStatus, fmtDateTime, fmtQty } from "../TelegramUi";

type View = "stock" | "leave" | "overtime";

const VIEWS: Array<{ value: View; label: string }> = [
  { value: "stock", label: "Stock" },
  { value: "leave", label: "Leave" },
  { value: "overtime", label: "Overtime" },
];

type Props = {
  auth: TelegramMiniAppAuthResult;
  onNewStockRequest: () => void;
};

/** Everything the employee has asked for: stock issue requests, leave and overtime. */
export default function TelegramMyRequestsPage({ auth, onNewStockRequest }: Props) {
  const [view, setView] = useState<View>(auth.userId ? "stock" : "leave");

  return (
    <section className="tg-mini-page">
      <TgSegment label="Request type" value={view} options={VIEWS} onChange={setView} />
      {view === "stock" ? (
        <MyStockRequests hasErpUser={Boolean(auth.userId)} onNew={onNewStockRequest} />
      ) : (
        <TelegramHrRequestsPage mode={view} />
      )}
    </section>
  );
}

function MyStockRequests({ hasErpUser, onNew }: { hasErpUser: boolean; onNew: () => void }) {
  const { tx } = useI18n();
  const [rows, setRows] = useState<TelegramSivSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        setRows(await getMyTelegramSivs(60, signal));
      } catch (err) {
        if (!signal?.aborted) setError(describeError(err, tx("Unable to load your stock requests.")));
      }
    },
    [tx],
  );

  useEffect(() => {
    if (!hasErpUser) return;
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [hasErpUser, load]);

  if (!hasErpUser) {
    return (
      <section className="tg-card">
        <EmptyState
          title={tx("Stock requests are unavailable")}
          detail={tx("Your employee profile has no ERP user. Ask an administrator to link one.")}
        />
      </section>
    );
  }

  if (error) {
    return (
      <StateMessage
        tone="error"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {tx("Retry")}
          </Button>
        }
      >
        {error}
      </StateMessage>
    );
  }

  if (rows === null) return <StateMessage tone="loading">{tx("Loading your stock requests...")}</StateMessage>;

  if (rows.length === 0) {
    return (
      <section className="tg-card">
        <EmptyState
          title={tx("No stock requests yet")}
          detail={tx("Requests you submit from the last 60 days appear here.")}
          action={
            <Button type="button" onClick={onNew}>
              {tx("New stock request")}
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <div className="tg-list">
      {rows.map((siv) => (
        <article key={siv.id} className="tg-card">
          <div className="tg-row__body">
            <div className="tg-mini-section__header">
              <TgCardHeader title={siv.sivNo} hint={fmtDateTime(siv.submittedAtUtc ?? siv.createdOrIssueDateUtc)} />
              <TgStatus status={siv.status} />
            </div>
          </div>

          <div className="tg-route">
            <span>{siv.fromLocationName ?? "-"}</span>
            <ArrowRight size={16} aria-hidden="true" />
            <span>{siv.toLocationName ?? "-"}</span>
          </div>

          <ul className="tg-lines">
            {siv.lines.map((line, index) => (
              <li key={`${siv.id}:${index}`}>
                <span>{line.itemName}</span>
                <span>
                  {fmtQty(line.issuedQty ?? line.approvedQty ?? line.requestedQty)} {line.uomCode ?? ""}
                </span>
              </li>
            ))}
          </ul>

          {siv.remarks ? <p className="tg-muted">{siv.remarks}</p> : null}
        </article>
      ))}
    </div>
  );
}
