import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useI18n } from "../../../i18n";
import type { TelegramMiniAppAuthResult } from "../telegramMiniApp.types";
import {
  approveTelegramSiv,
  getTelegramSivApprovals,
  rejectTelegramSiv,
  type TelegramSivSummaryDto,
} from "../telegramMiniAppApi";
import { MiniAppApiError, describeError } from "../telegramMiniAppClient";
import { notifyTelegram } from "../telegramWebApp";
import { TgCardHeader, TgField, fmtDateTime, fmtQty } from "../TelegramUi";

type Props = {
  auth: TelegramMiniAppAuthResult;
  onCountChange?: (count: number) => void;
};

type Decision = { siv: TelegramSivSummaryDto; mode: "approve" | "reject" };
type Load = "loading" | "ready" | "forbidden" | "error";

/** Stock issue requests waiting for this employee's approval. */
export default function TelegramApprovalsPage({ auth, onCountChange }: Props) {
  const { tx } = useI18n();
  const [state, setState] = useState<Load>("loading");
  const [rows, setRows] = useState<TelegramSivSummaryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!auth.userId) {
        setState("forbidden");
        return;
      }
      setState("loading");
      setError(null);
      try {
        const data = await getTelegramSivApprovals(signal);
        setRows(data);
        onCountChange?.(data.length);
        setState("ready");
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof MiniAppApiError && err.status === 403) {
          setState("forbidden");
          onCountChange?.(0);
          return;
        }
        setError(describeError(err, tx("Unable to load approvals.")));
        setState("error");
      }
    },
    [auth.userId, onCountChange, tx],
  );

  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [load]);

  const decided = useCallback(
    (sivId: string, message: string) => {
      setDecision(null);
      setNotice(message);
      setRows((current) => {
        const next = current.filter((row) => row.id !== sivId);
        onCountChange?.(next.length);
        return next;
      });
    },
    [onCountChange],
  );

  if (state === "loading") return <StateMessage tone="loading">{tx("Loading approvals...")}</StateMessage>;

  if (state === "forbidden") {
    return (
      <section className="tg-card">
        <EmptyState
          title={tx("No approvals for you")}
          detail={tx("Only stock approvers see requests here. Ask an administrator if you should approve stock requests.")}
        />
      </section>
    );
  }

  if (state === "error") {
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

  return (
    <section className="tg-mini-page">
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}

      <div className="tg-mini-section__header">
        <h3>{tx("Stock requests waiting")}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()} aria-label={tx("Refresh")}>
          <RefreshCw size={16} aria-hidden="true" />
        </Button>
      </div>

      {rows.length === 0 ? (
        <section className="tg-card">
          <EmptyState title={tx("All caught up")} detail={tx("There are no stock requests waiting for your approval.")} />
        </section>
      ) : (
        rows.map((siv) => (
          <article key={siv.id} className="tg-card">
            <TgCardHeader
              title={siv.sivNo}
              hint={tx("{name}, {time}", {
                name: siv.requesterName ?? tx("Unknown requester"),
                time: fmtDateTime(siv.submittedAtUtc ?? siv.createdOrIssueDateUtc),
              })}
            />

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
                    {fmtQty(line.requestedQty)} {line.uomCode ?? ""}
                  </span>
                </li>
              ))}
            </ul>

            {siv.remarks ? <p className="tg-muted">{siv.remarks}</p> : null}

            <div className="tg-actions tg-actions--row">
              <Button type="button" variant="outline" onClick={() => setDecision({ siv, mode: "reject" })}>
                {tx("Reject")}
              </Button>
              <Button type="button" onClick={() => setDecision({ siv, mode: "approve" })}>
                {tx("Approve")}
              </Button>
            </div>
          </article>
        ))
      )}

      {decision ? (
        <DecisionSheet decision={decision} onCancel={() => setDecision(null)} onDone={decided} />
      ) : null}
    </section>
  );
}

function DecisionSheet({
  decision,
  onCancel,
  onDone,
}: {
  decision: Decision;
  onCancel: () => void;
  onDone: (sivId: string, message: string) => void;
}) {
  const { tx } = useI18n();
  const [remarks, setRemarks] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [needsOverride, setNeedsOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLTextAreaElement>(null);
  const reject = decision.mode === "reject";

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function confirm() {
    if (reject && !remarks.trim()) {
      setError(tx("Explain why the request is rejected."));
      return;
    }
    if (needsOverride && !overrideReason.trim()) {
      setError(tx("Enter the override reason."));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (reject) {
        await rejectTelegramSiv(decision.siv.id, remarks.trim());
        notifyTelegram("success");
        onDone(decision.siv.id, tx("{no} rejected.", { no: decision.siv.sivNo }));
      } else {
        await approveTelegramSiv(decision.siv.id, {
          remarks: remarks.trim() || null,
          overrideReason: overrideReason.trim() || null,
        });
        notifyTelegram("success");
        onDone(decision.siv.id, tx("{no} approved.", { no: decision.siv.sivNo }));
      }
    } catch (err) {
      notifyTelegram("error");
      const message = describeError(err, tx("The decision could not be saved."));
      if (!reject && /override/i.test(message)) setNeedsOverride(true);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tg-dialog-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="tg-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={reject ? tx("Reject {no}", { no: decision.siv.sivNo }) : tx("Approve {no}", { no: decision.siv.sivNo })}
        onClick={(event) => event.stopPropagation()}
      >
        <TgCardHeader
          title={reject ? tx("Reject {no}", { no: decision.siv.sivNo }) : tx("Approve {no}", { no: decision.siv.sivNo })}
          hint={
            reject
              ? tx("The requester is told why.")
              : tx("Approves the requested quantities. The store then issues the stock.")
          }
        />

        <TgField label={reject ? tx("Reason") : tx("Remarks")} required={reject}>
          <Textarea
            ref={firstField}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder={reject ? tx("Why is this request rejected?") : tx("Optional note")}
            maxLength={500}
            disabled={busy}
          />
        </TgField>

        {needsOverride ? (
          <TgField label={tx("Override reason")} required help={tx("Required when approving more than the stock rules allow.")}>
            <Input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} disabled={busy} />
          </TgField>
        ) : null}

        {error ? <StateMessage tone="error">{error}</StateMessage> : null}

        <div className="tg-actions tg-actions--row">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {tx("Cancel")}
          </Button>
          <Button type="button" variant={reject ? "destructive" : "default"} onClick={() => void confirm()} disabled={busy}>
            {busy ? tx("Saving...") : reject ? tx("Reject") : tx("Approve")}
          </Button>
        </div>
      </div>
    </div>
  );
}
