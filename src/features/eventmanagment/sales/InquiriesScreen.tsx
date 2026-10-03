// src/features/eventmanagment/sales/InquiriesScreen.tsx

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import {
  createInquiry,
  listCustomers,
  listInquiries,
  updateInquiry,
  updateInquiryStatus,
  type CateringCustomerDto,
  type CateringEventType,
  type CateringInquiryDto,
  type CateringInquiryStatus,
  type CateringLeadSource,
  type CateringServiceStyle,
} from "./salesApi";
import {
  eventTypeOptions,
  humanize,
  inquiryStatusOptions,
  leadSourceOptions,
  serviceStyleOptions,
} from "./options";
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
  formatDay,
  fromDateTimeInput,
  readApiError,
  toDateTimeInput,
  useMutation,
} from "./ui";

type FormState = {
  customerId: string;
  eventType: CateringEventType;
  proposedEventDateUtc: string;
  venueName: string;
  venueAddress: string;
  expectedGuests: number | "";
  budgetAmount: number | "";
  serviceStyle: CateringServiceStyle;
  menuPreference: string;
  contactPersonName: string;
  contactPhone: string;
  contactEmail: string;
  leadSource: CateringLeadSource;
  notes: string;
};

function emptyForm(): FormState {
  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
  inTwoWeeks.setHours(18, 0, 0, 0);
  return {
    customerId: "",
    eventType: "wedding",
    proposedEventDateUtc: toDateTimeInput(inTwoWeeks.toISOString()),
    venueName: "",
    venueAddress: "",
    expectedGuests: 100,
    budgetAmount: "",
    serviceStyle: "buffet",
    menuPreference: "",
    contactPersonName: "",
    contactPhone: "",
    contactEmail: "",
    leadSource: "phone",
    notes: "",
  };
}

function toForm(inquiry: CateringInquiryDto): FormState {
  return {
    customerId: inquiry.customerId,
    eventType: inquiry.eventType,
    proposedEventDateUtc: toDateTimeInput(inquiry.proposedEventDateUtc),
    venueName: inquiry.venueName,
    venueAddress: inquiry.venueAddress ?? "",
    expectedGuests: inquiry.expectedGuests,
    budgetAmount: inquiry.budgetAmount ?? "",
    serviceStyle: inquiry.serviceStyle,
    menuPreference: inquiry.menuPreference ?? "",
    contactPersonName: inquiry.contactPersonName,
    contactPhone: inquiry.contactPhone ?? "",
    contactEmail: inquiry.contactEmail ?? "",
    leadSource: inquiry.leadSource,
    notes: inquiry.notes ?? "",
  };
}

function corePayload(form: FormState) {
  return {
    eventType: form.eventType,
    proposedEventDateUtc: fromDateTimeInput(form.proposedEventDateUtc) ?? new Date().toISOString(),
    venueName: form.venueName.trim(),
    venueAddress: form.venueAddress.trim() || null,
    expectedGuests: typeof form.expectedGuests === "number" ? form.expectedGuests : 0,
    budgetAmount: typeof form.budgetAmount === "number" ? form.budgetAmount : null,
    serviceStyle: form.serviceStyle,
    menuPreference: form.menuPreference.trim() || null,
    contactPersonName: form.contactPersonName.trim(),
    contactPhone: form.contactPhone.trim() || null,
    contactEmail: form.contactEmail.trim() || null,
    leadSource: form.leadSource,
    notes: form.notes.trim() || null,
  };
}

export function InquiriesScreen({
  companyId,
  branchId,
  selectedId,
  onSelect,
  onRaiseQuotation,
  startNew = false,
  onNewConsumed,
}: {
  startNew?: boolean;
  onNewConsumed?: () => void;
  companyId: string;
  branchId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRaiseQuotation: (inquiryId: string) => void;
}) {
  const [rows, setRows] = useState<CateringInquiryDto[]>([]);
  const [customers, setCustomers] = useState<CateringCustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<CateringInquiryStatus | "">("");
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; form: FormState } | null>(null);
  const [statusChange, setStatusChange] = useState<{
    status: CateringInquiryStatus;
    reason: string;
  } | null>(null);
  const mutation = useMutation();
  useEffect(() => { if (startNew) { setEditing({mode:"create",form:emptyForm()}); onNewConsumed?.(); } }, [startNew, onNewConsumed]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId) return;
      setLoading(true);
      setLoadError(null);
      setRows([]);
      try {
        const data = await listInquiries(companyId, {
          branchId: branchId || undefined,
          status: status || undefined,
          signal,
        });
        if (!signal?.aborted) setRows(data);
      } catch (cause) {
        if (!signal?.aborted) setLoadError(readApiError(cause, "Could not load inquiries."));
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
    void listCustomers(companyId, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setCustomers(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [companyId]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function submitForm() {
    if (!editing) return;
    const ok = await mutation.run(
      async () => {
        if (editing.mode === "create") {
          return createInquiry(companyId, {
            branchId,
            customerId: editing.form.customerId,
            ...corePayload(editing.form),
          });
        }
        return updateInquiry(companyId, selectedId ?? "", corePayload(editing.form));
      },
      (saved) => {
        setEditing(null);
        onSelect(saved.id);
      },
    );
    if (ok) void load();
  }

  async function submitStatus() {
    if (!statusChange || !selected) return;
    const ok = await mutation.run(
      () =>
        updateInquiryStatus(companyId, selected.id, {
          status: statusChange.status,
          reason: statusChange.reason.trim() || null,
        }),
      () => setStatusChange(null),
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
                className="cat-btn"
                onClick={() => {
                  mutation.setError(null);
                  setEditing({ mode: "edit", form: toForm(selected) });
                }}
                type="button"
              >
                Edit
              </button>
              <button
                className="cat-btn"
                onClick={() => {
                  mutation.setError(null);
                  setStatusChange({ status: selected.status, reason: "" });
                }}
                type="button"
              >
                Change status
              </button>
              <button
                className="cat-btn cat-btn--primary"
                onClick={() => onRaiseQuotation(selected.id)}
                type="button"
              >
                Raise quotation
              </button>
            </>
          }
          eyebrow="Inquiry"
          meta={<Pill value={humanize(selected.status)} />}
          onBack={() => onSelect(null)}
          title={`${selected.inquiryNo} · ${selected.customerName}`}
        />

        <Card title="Event request">
          <Facts
            items={[
              ["Event type", humanize(selected.eventType)],
              ["Service style", humanize(selected.serviceStyle)],
              ["Proposed date", formatDay(selected.proposedEventDateUtc)],
              ["Expected guests", String(selected.expectedGuests)],
              ["Budget", selected.budgetAmount != null ? selected.budgetAmount.toLocaleString() : "—"],
              ["Venue", selected.venueName],
              ["Venue address", selected.venueAddress || "—"],
              ["Branch", selected.branchName],
            ]}
          />
        </Card>

        <Card title="Contact and source">
          <Facts
            items={[
              ["Contact person", selected.contactPersonName],
              ["Phone", selected.contactPhone || "—"],
              ["Email", selected.contactEmail || "—"],
              ["Lead source", humanize(selected.leadSource)],
              ["Menu preference", selected.menuPreference || "—"],
              ["Lost reason", selected.lostReason || "—"],
              ["Notes", selected.notes || "—"],
            ]}
          />
        </Card>

        {editing ? (
          <InquiryForm
            busy={mutation.busy}
            customers={customers}
            error={mutation.error}
            form={editing.form}
            mode={editing.mode}
            onChange={(form) => setEditing({ ...editing, form })}
            onClose={() => setEditing(null)}
            onSubmit={submitForm}
          />
        ) : null}

        {statusChange ? (
          <FormDialog
            busy={mutation.busy}
            error={mutation.error}
            onClose={() => setStatusChange(null)}
            onSubmit={submitStatus}
            submitLabel="Update status"
            title="Change inquiry status"
          >
            <SelectField
              label="Status"
              onChange={(value) =>
                setStatusChange({ ...statusChange, status: value as CateringInquiryStatus })
              }
              options={inquiryStatusOptions}
              value={statusChange.status}
            />
            <TextAreaField
              help="Recorded against the status change. Required by the backend when marking an inquiry lost."
              label="Reason"
              onChange={(value) => setStatusChange({ ...statusChange, reason: value })}
              value={statusChange.reason}
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
          onChange={(value) => setStatus(value as CateringInquiryStatus | "")}
          options={inquiryStatusOptions}
          placeholder="All statuses"
          value={status}
        />
        <button className="cat-btn" onClick={() => void load()} type="button">
          <RefreshCw className={loading ? "cat-spin" : ""} size={15} /> Refresh
        </button>
        <button
          className="cat-btn cat-btn--primary"
          disabled={!branchId}
          onClick={() => {
            mutation.setError(null);
            setEditing({ mode: "create", form: emptyForm() });
          }}
          title={branchId ? undefined : "Select a branch to create an inquiry"}
          type="button"
        >
          <Plus size={15} /> New inquiry
        </button>
      </Toolbar>

      {loadError ? <ErrorBanner message={loadError} /> : null}

      {loadError ? null : loading ? (
        <EmptyState title="Loading inquiries" detail="Please wait while inquiries are loaded." />
      ) : rows.length ? (
        <table className="cat-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Event</th>
              <th>Date</th>
              <th className="is-end">Guests</th>
              <th>Venue</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row.id)} tabIndex={0}>
                <td>{row.inquiryNo}</td>
                <td>
                  <strong>{row.customerName}</strong>
                </td>
                <td>{humanize(row.eventType)}</td>
                <td>{formatDay(row.proposedEventDateUtc)}</td>
                <td className="is-end">{row.expectedGuests}</td>
                <td>{row.venueName}</td>
                <td>
                  <Pill value={humanize(row.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          detail="Take an inquiry to start the sales pipeline."
          title="No inquiries"
        />
      )}

      {editing ? (
        <InquiryForm
          busy={mutation.busy}
          customers={customers}
          error={mutation.error}
          form={editing.form}
          mode={editing.mode}
          onChange={(form) => setEditing({ ...editing, form })}
          onClose={() => setEditing(null)}
          onSubmit={submitForm}
        />
      ) : null}
    </div>
  );
}

function InquiryForm({
  mode,
  form,
  customers,
  onChange,
  onSubmit,
  onClose,
  busy,
  error,
}: {
  mode: "create" | "edit";
  form: FormState;
  customers: CateringCustomerDto[];
  onChange: (form: FormState) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  const incomplete =
    !form.venueName.trim() ||
    !form.contactPersonName.trim() ||
    (mode === "create" && !form.customerId);

  return (
    <FormDialog
      busy={busy}
      disabled={incomplete}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={mode === "create" ? "Create inquiry" : "Save changes"}
      title={mode === "create" ? "New inquiry" : "Edit inquiry"}
    >
      <div className="cat-form-grid">
        {mode === "create" ? (
          <SelectField
            help={customers.length ? undefined : "No customers loaded — create one first."}
            label="Customer"
            onChange={(value) => set("customerId", value)}
            options={customers.map((customer) => ({
              value: customer.id,
              label: `${customer.customerNo} · ${customer.displayName}`,
            }))}
            placeholder="Select customer"
            required
            value={form.customerId}
          />
        ) : null}
        <SelectField
          label="Event type"
          onChange={(value) => set("eventType", value as CateringEventType)}
          options={eventTypeOptions}
          value={form.eventType}
        />
        <SelectField
          label="Service style"
          onChange={(value) => set("serviceStyle", value as CateringServiceStyle)}
          options={serviceStyleOptions}
          value={form.serviceStyle}
        />
        <DateTimeField
          label="Proposed event date"
          onChange={(value) => set("proposedEventDateUtc", value)}
          required
          value={form.proposedEventDateUtc}
        />
        <NumberField
          label="Expected guests"
          min={0}
          onChange={(value) => set("expectedGuests", value)}
          required
          value={form.expectedGuests}
        />
        <NumberField
          help="Optional. What the customer expects to spend."
          label="Budget amount"
          min={0}
          onChange={(value) => set("budgetAmount", value)}
          step={100}
          value={form.budgetAmount}
        />
        <TextField
          label="Venue name"
          onChange={(value) => set("venueName", value)}
          required
          value={form.venueName}
        />
        <SelectField
          label="Lead source"
          onChange={(value) => set("leadSource", value as CateringLeadSource)}
          options={leadSourceOptions}
          value={form.leadSource}
        />
        <TextField
          label="Contact person"
          onChange={(value) => set("contactPersonName", value)}
          required
          value={form.contactPersonName}
        />
        <TextField
          label="Contact phone"
          onChange={(value) => set("contactPhone", value)}
          type="tel"
          value={form.contactPhone}
        />
        <TextField
          label="Contact email"
          onChange={(value) => set("contactEmail", value)}
          type="email"
          value={form.contactEmail}
        />
      </div>
      <TextAreaField
        label="Venue address"
        onChange={(value) => set("venueAddress", value)}
        value={form.venueAddress}
      />
      <TextAreaField
        label="Menu preference"
        onChange={(value) => set("menuPreference", value)}
        value={form.menuPreference}
      />
      <TextAreaField label="Notes" onChange={(value) => set("notes", value)} value={form.notes} />
    </FormDialog>
  );
}
