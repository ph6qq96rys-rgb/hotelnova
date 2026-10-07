// src/features/eventmanagment/sales/EventsScreen.tsx

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import {
  cancelEvent,
  confirmEventFromQuotation,
  listEvents,
  listQuotations,
  recordEventPayment,
  reverseEventPayment,
  type CateringEventPaymentDto,
  type CateringEventRecordDto,
  type CateringEventStatus,
  type CateringPaymentMethod,
  type CateringPaymentType,
  type CateringQuotationDto,
} from "./salesApi";
import { eventStatusOptions, humanize, paymentMethodOptions, paymentTypeOptions } from "./options";
import {
  Card,
  DateTimeField,
  DetailHeader,
  EmptyState,
  ErrorBanner,
  Facts,
  FormDialog,
  NumberField,
  Pill,
  SelectField,
  TextAreaField,
  TextField,
  Toolbar,
  formatDateTime,
  formatDay,
  fromDateTimeInput,
  readApiError,
  toDateTimeInput,
  useMutation,
} from "./ui";

type PaymentForm = {
  type: CateringPaymentType;
  method: CateringPaymentMethod;
  amount: number | "";
  receivedAtUtc: string;
  referenceNo: string;
  receivedByName: string;
  notes: string;
  /** Fixed for the life of the form so a retried submit cannot record the payment twice. */
  clientRequestId: string;
};

const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
      );

/** Methods that leave a trail outside the till need its reference (bank slip, cheque, transaction id). */
const needsReference = (method: CateringPaymentMethod) => method !== "cash" && method !== "credit";

function paymentProblem(form: PaymentForm): string | null {
  if (typeof form.amount !== "number" || form.amount <= 0) return "Enter an amount above zero.";
  if (form.receivedAtUtc && new Date(form.receivedAtUtc).getTime() > Date.now() + 5 * 60_000)
    return "The received date cannot be in the future.";
  if (needsReference(form.method) && !form.referenceNo.trim()) return "Enter the reference for this payment method.";
  if (form.type === "refund" && !form.referenceNo.trim() && !form.notes.trim())
    return "Give a reference or a note explaining the refund.";
  return null;
}

function emptyPayment(type: CateringPaymentType = "deposit"): PaymentForm {
  return {
    type,
    method: "bankTransfer",
    amount: "",
    receivedAtUtc: toDateTimeInput(new Date().toISOString()),
    referenceNo: "",
    receivedByName: "",
    notes: "",
    clientRequestId: newRequestId(),
  };
}

function paymentPayload(form: PaymentForm) {
  return {
    type: form.type,
    method: form.method,
    amount: typeof form.amount === "number" ? form.amount : 0,
    receivedAtUtc: fromDateTimeInput(form.receivedAtUtc),
    referenceNo: form.referenceNo.trim() || null,
    receivedByName: form.receivedByName.trim() || null,
    notes: form.notes.trim() || null,
    clientRequestId: form.clientRequestId,
  };
}

export function EventsScreen({
  companyId,
  branchId,
  selectedId,
  onSelect,
  confirmQuotationId,
  onConfirmConsumed,
}: {
  companyId: string;
  branchId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Set when the operator clicked "Confirm event" on an accepted quotation. */
  confirmQuotationId: string | null;
  onConfirmConsumed: () => void;
}) {
  const [rows, setRows] = useState<CateringEventRecordDto[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<CateringQuotationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<CateringEventStatus | "">("");
  const [confirming, setConfirming] = useState<{
    acceptedQuotationId: string;
    eventDateUtc: string;
    venueName: string;
    venueAddress: string;
    notes: string;
    withDeposit: boolean;
    deposit: PaymentForm;
  } | null>(null);
  const [payment, setPayment] = useState<PaymentForm | null>(null);
  const [cancelling, setCancelling] = useState<{ reason: string } | null>(null);
  const [reversing, setReversing] = useState<{ payment: CateringEventPaymentDto; reason: string } | null>(null);
  const mutation = useMutation();
  const { hasPermission } = useAuth();
  const canTakePayments = hasPermission("catering.payments.manage");
  const canReversePayments = hasPermission("catering.billing.approve");
  const canManageEvents = hasPermission("catering.events.manage");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const data = await listEvents(companyId, {
          branchId: branchId || undefined,
          status: status || undefined,
          signal,
        });
        if (!signal?.aborted) setRows(data);
      } catch (cause) {
        if (!signal?.aborted) setLoadError(readApiError(cause, "Could not load events."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [branchId, companyId, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    void listQuotations(companyId, {
      branchId: branchId || undefined,
      status: "accepted",
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setAcceptedQuotes(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [branchId, companyId]);

  useEffect(() => {
    if (!confirmQuotationId) return;
    mutation.setError(null);
    setConfirming({
      acceptedQuotationId: confirmQuotationId,
      eventDateUtc: "",
      venueName: "",
      venueAddress: "",
      notes: "",
      withDeposit: false,
      deposit: emptyPayment(),
    });
    onConfirmConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmQuotationId]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function submitConfirm() {
    if (!confirming) return;
    const ok = await mutation.run(
      () =>
        confirmEventFromQuotation(companyId, {
          acceptedQuotationId: confirming.acceptedQuotationId,
          eventDateUtc: fromDateTimeInput(confirming.eventDateUtc),
          venueName: confirming.venueName.trim() || null,
          venueAddress: confirming.venueAddress.trim() || null,
          notes: confirming.notes.trim() || null,
          initialDeposit: confirming.withDeposit ? paymentPayload(confirming.deposit) : null,
        }),
      (saved) => {
        setConfirming(null);
        onSelect(saved.id);
      },
    );
    if (ok) void load();
  }

  if (selected) {
    return (
      <div className="cat-stack">
        <DetailHeader
          actions={
            <>
              <button
                className="cat-btn cat-btn--primary"
                disabled={!canTakePayments || selected.status === "cancelled"}
                title={canTakePayments ? undefined : "Requires catering.payments.manage"}
                onClick={() => {
                  mutation.setError(null);
                  setPayment(emptyPayment(selected.depositReceivedAmount > 0 ? "progress" : "deposit"));
                }}
                type="button"
              >
                Record payment
              </button>
              {selected.status !== "cancelled" && selected.status !== "completed" ? (
                <button
                  className="cat-btn cat-btn--danger"
                  disabled={!canManageEvents}
                  title={canManageEvents ? undefined : "Requires catering.events.manage"}
                  onClick={() => {
                    mutation.setError(null);
                    setCancelling({ reason: "" });
                  }}
                  type="button"
                >
                  Cancel event
                </button>
              ) : null}
            </>
          }
          eyebrow="Event"
          meta={
            <>
              <Pill value={humanize(selected.status)} />
              <span>{selected.customerName}</span>
            </>
          }
          onBack={() => onSelect(null)}
          title={`${selected.eventNo} · ${selected.venueName}`}
        />

        {mutation.error ? <ErrorBanner message={mutation.error} /> : null}

        <div className="cat-split">
          <Card title="Event">
            <Facts
              items={[
                ["Event date", formatDay(selected.eventDateUtc)],
                ["Event type", humanize(selected.eventType)],
                ["Service style", humanize(selected.serviceStyle)],
                ["Guests", String(selected.guestCount)],
                ["Venue", selected.venueName],
                ["Venue address", selected.venueAddress || "—"],
                ["Branch", selected.branchName],
                ["Source quote", selected.quoteNoSnapshot],
                ["Package", selected.packageNameSnapshot || "—"],
                ["Confirmed", formatDateTime(selected.confirmedAtUtc)],
                ["Notes", selected.notes || "—"],
              ]}
            />
          </Card>

          <Card title="Contract and settlement">
            <table className="cat-table cat-table--totals">
              <tbody>
                <tr>
                  <td>Contract value</td>
                  <td className="is-end">{formatCurrency(selected.contractValue)}</td>
                </tr>
                <tr>
                  <td>Required deposit</td>
                  <td className="is-end">{formatCurrency(selected.requiredDepositAmount)}</td>
                </tr>
                <tr>
                  <td>Deposit received</td>
                  <td className="is-end">{formatCurrency(selected.depositReceivedAmount)}</td>
                </tr>
                <tr>
                  <td>Total received</td>
                  <td className="is-end">{formatCurrency(selected.paymentReceivedAmount)}</td>
                </tr>
                {selected.refundAmount ? (
                  <tr>
                    <td>Refunded</td>
                    <td className="is-end">−{formatCurrency(selected.refundAmount)}</td>
                  </tr>
                ) : null}
                {selected.additionalChargesAmount ? (
                  <tr>
                    <td>Final bill adjustment</td>
                    <td className="is-end">{formatCurrency(selected.additionalChargesAmount)}</td>
                  </tr>
                ) : null}
                <tr className="cat-total-row">
                  <td>Remaining balance</td>
                  <td className="is-end">{formatCurrency(selected.remainingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>

        <Card meta={`${selected.payments.length} recorded`} title="Payments">
          {selected.payments.length ? (
            <table className="cat-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th className="is-end">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {selected.payments.map((entry) => (
                  <tr key={entry.id} className={entry.status === "reversed" ? "is-muted" : undefined}>
                    <td>{formatDateTime(entry.receivedAtUtc)}</td>
                    <td>{humanize(entry.type)}</td>
                    <td>{humanize(entry.method)}</td>
                    <td>{entry.referenceNo || "—"}</td>
                    <td>
                      {entry.status === "reversed"
                        ? `Reversed ${formatDay(entry.reversedAtUtc ?? null)}: ${entry.reversalReason ?? ""}`
                        : entry.notes || "—"}
                    </td>
                    <td className="is-end">
                      {entry.type === "refund" ? "−" : ""}
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="is-end">
                      {entry.status !== "reversed" && canReversePayments ? (
                        <button
                          className="cat-btn"
                          onClick={() => {
                            mutation.setError(null);
                            setReversing({ payment: entry, reason: "" });
                          }}
                          type="button"
                        >
                          Reverse
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState detail="Record the deposit to move the event out of pending." title="No payments recorded" />
          )}
        </Card>

        {payment ? (
          <FormDialog
            busy={mutation.busy}
            disabled={Boolean(paymentProblem(payment))}
            description={paymentProblem(payment) ?? undefined}
            error={mutation.error}
            onClose={() => setPayment(null)}
            onSubmit={() =>
              void (async () => {
                const ok = await mutation.run(
                  () => recordEventPayment(companyId, selected.id, paymentPayload(payment)),
                  () => setPayment(null),
                );
                if (ok) void load();
              })()
            }
            submitLabel="Record payment"
            title="Record payment"
          >
            <PaymentFields form={payment} onChange={setPayment} />
          </FormDialog>
        ) : null}

        {reversing ? (
          <FormDialog
            busy={mutation.busy}
            description={`Reverses ${formatCurrency(reversing.payment.amount)} received ${formatDay(reversing.payment.receivedAtUtc)}. You cannot reverse a payment you recorded unless your company allows it.`}
            destructive
            disabled={!reversing.reason.trim()}
            error={mutation.error}
            onClose={() => setReversing(null)}
            onSubmit={() =>
              void (async () => {
                const ok = await mutation.run(
                  () =>
                    reverseEventPayment(companyId, selected.id, reversing.payment.id, {
                      reason: reversing.reason.trim(),
                    }),
                  () => setReversing(null),
                );
                if (ok) void load();
              })()
            }
            submitLabel="Reverse payment"
            title="Reverse payment"
          >
            <TextAreaField
              label="Reason"
              onChange={(value) => setReversing({ ...reversing, reason: value })}
              required
              value={reversing.reason}
            />
          </FormDialog>
        ) : null}

        {cancelling ? (
          <FormDialog
            busy={mutation.busy}
            description="Cancelling releases stock reservations and cancels open issues, dispatches and plans. It is refused while issued stock is still out at the event."
            destructive
            disabled={!cancelling.reason.trim()}
            error={mutation.error}
            onClose={() => setCancelling(null)}
            onSubmit={() =>
              void (async () => {
                const ok = await mutation.run(
                  () => cancelEvent(companyId, selected.id, { reason: cancelling.reason.trim() }),
                  () => setCancelling(null),
                );
                if (ok) void load();
              })()
            }
            submitLabel="Cancel event"
            title="Cancel event"
          >
            <TextAreaField
              label="Reason"
              onChange={(value) => setCancelling({ reason: value })}
              required
              value={cancelling.reason}
            />
          </FormDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cat-stack">
      <Toolbar>
        <SelectField
          label=""
          onChange={(value) => setStatus(value as CateringEventStatus | "")}
          options={eventStatusOptions}
          placeholder="All statuses"
          value={status}
        />
        <button className="cat-btn" onClick={() => void load()} type="button">
          <RefreshCw className={loading ? "cat-spin" : ""} size={15} /> Refresh
        </button>
        <button
          className="cat-btn cat-btn--primary"
          disabled={!acceptedQuotes.length || !canManageEvents}
          onClick={() => {
            mutation.setError(null);
            setConfirming({
              acceptedQuotationId: acceptedQuotes[0]?.id ?? "",
              eventDateUtc: "",
              venueName: "",
              venueAddress: "",
              notes: "",
              withDeposit: false,
              deposit: emptyPayment(),
            });
          }}
          title={acceptedQuotes.length ? undefined : "An accepted quotation is required"}
          type="button"
        >
          Confirm event from quotation
        </button>
      </Toolbar>

      {loadError ? <ErrorBanner message={loadError} /> : null}

      {rows.length ? (
        <table className="cat-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Venue</th>
              <th className="is-end">Guests</th>
              <th className="is-end">Contract</th>
              <th className="is-end">Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row.id)} tabIndex={0}>
                <td>
                  <strong>{row.eventNo}</strong>
                </td>
                <td>{row.customerName}</td>
                <td>{formatDay(row.eventDateUtc)}</td>
                <td>{row.venueName}</td>
                <td className="is-end">{row.guestCount}</td>
                <td className="is-end">{formatCurrency(row.contractValue)}</td>
                <td className="is-end">{formatCurrency(row.remainingBalance)}</td>
                <td>
                  <Pill value={humanize(row.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          detail={loading ? "Loading events." : "Accept a quotation, then confirm it to create the event."}
          title="No events"
        />
      )}

      {confirming ? (
        <FormDialog
          busy={mutation.busy}
          description="Creates the event from an accepted quotation. Contract values are copied from the quote."
          disabled={
            !confirming.acceptedQuotationId || (confirming.withDeposit && Boolean(paymentProblem(confirming.deposit)))
          }
          error={mutation.error}
          onClose={() => setConfirming(null)}
          onSubmit={submitConfirm}
          submitLabel="Confirm event"
          title="Confirm event"
        >
          <SelectField
            label="Accepted quotation"
            onChange={(value) => setConfirming({ ...confirming, acceptedQuotationId: value })}
            options={acceptedQuotes.map((quote) => ({
              value: quote.id,
              label: `${quote.quoteNo} · ${quote.customerName} · ${formatCurrency(quote.grandTotal)}`,
            }))}
            placeholder="Select quotation"
            required
            value={confirming.acceptedQuotationId}
          />
          <div className="cat-form-grid">
            <DateTimeField
              help="Leave blank to use the date from the quotation."
              label="Event date override"
              onChange={(value) => setConfirming({ ...confirming, eventDateUtc: value })}
              value={confirming.eventDateUtc}
            />
            <TextField
              help="Leave blank to use the venue from the inquiry."
              label="Venue override"
              onChange={(value) => setConfirming({ ...confirming, venueName: value })}
              value={confirming.venueName}
            />
          </div>
          <TextAreaField
            label="Venue address override"
            onChange={(value) => setConfirming({ ...confirming, venueAddress: value })}
            value={confirming.venueAddress}
          />
          <TextAreaField
            label="Notes"
            onChange={(value) => setConfirming({ ...confirming, notes: value })}
            value={confirming.notes}
          />

          <label className="cat-check">
            <input
              checked={confirming.withDeposit}
              onChange={(event) => setConfirming({ ...confirming, withDeposit: event.target.checked })}
              type="checkbox"
            />
            Record an initial deposit now
          </label>

          {confirming.withDeposit ? (
            <PaymentFields
              form={confirming.deposit}
              onChange={(deposit) => setConfirming({ ...confirming, deposit })}
            />
          ) : null}
        </FormDialog>
      ) : null}
    </div>
  );
}

function PaymentFields({ form, onChange }: { form: PaymentForm; onChange: (form: PaymentForm) => void }) {
  const set = <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => onChange({ ...form, [key]: value });

  return (
    <>
      <div className="cat-form-grid">
        <SelectField
          label="Payment type"
          onChange={(value) => set("type", value as CateringPaymentType)}
          options={paymentTypeOptions}
          value={form.type}
        />
        <SelectField
          label="Method"
          onChange={(value) => set("method", value as CateringPaymentMethod)}
          options={paymentMethodOptions}
          value={form.method}
        />
        <NumberField
          label="Amount"
          min={0}
          onChange={(value) => set("amount", value)}
          required
          step={100}
          value={form.amount}
        />
        <DateTimeField
          label="Received at"
          onChange={(value) => set("receivedAtUtc", value)}
          value={form.receivedAtUtc}
        />
        <TextField
          label={needsReference(form.method) ? "Reference no. (required)" : "Reference no."}
          onChange={(value) => set("referenceNo", value)}
          value={form.referenceNo}
        />
        <TextField label="Received by" onChange={(value) => set("receivedByName", value)} value={form.receivedByName} />
      </div>
      <TextAreaField label="Notes" onChange={(value) => set("notes", value)} value={form.notes} />
    </>
  );
}
