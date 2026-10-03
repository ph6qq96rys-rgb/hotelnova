// src/features/eventmanagment/sales/CustomersScreen.tsx

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import {
  createCustomer,
  listCustomers,
  updateCustomer,
  type CateringCustomerDto,
  type CateringCustomerType,
} from "./salesApi";
import { customerTypeOptions, humanize } from "./options";
import {
  Card,
  DetailHeader,
  EmptyState,
  ErrorBanner,
  Facts,
  FormDialog,
  Pill,
  SearchInput,
  SelectField,
  TextAreaField,
  TextField,
  Toolbar,
  readApiError,
  useMutation,
} from "./ui";

type FormState = {
  type: CateringCustomerType;
  displayName: string;
  primaryContactName: string;
  primaryPhone: string;
  primaryEmail: string;
  billingAddress: string;
  taxRegistrationNo: string;
  notes: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  type: "company",
  displayName: "",
  primaryContactName: "",
  primaryPhone: "",
  primaryEmail: "",
  billingAddress: "",
  taxRegistrationNo: "",
  notes: "",
  isActive: true,
};

function toForm(customer: CateringCustomerDto): FormState {
  return {
    type: customer.type,
    displayName: customer.displayName,
    primaryContactName: customer.primaryContactName ?? "",
    primaryPhone: customer.primaryPhone ?? "",
    primaryEmail: customer.primaryEmail ?? "",
    billingAddress: customer.billingAddress ?? "",
    taxRegistrationNo: customer.taxRegistrationNo ?? "",
    notes: customer.notes ?? "",
    isActive: customer.isActive,
  };
}

function toPayload(form: FormState) {
  return {
    type: form.type,
    displayName: form.displayName.trim(),
    primaryContactName: form.primaryContactName.trim() || null,
    primaryPhone: form.primaryPhone.trim() || null,
    primaryEmail: form.primaryEmail.trim() || null,
    billingAddress: form.billingAddress.trim() || null,
    taxRegistrationNo: form.taxRegistrationNo.trim() || null,
    notes: form.notes.trim() || null,
  };
}

export function CustomersScreen({
  companyId,
  selectedId,
  onSelect,
}: {
  companyId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [rows, setRows] = useState<CateringCustomerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; form: FormState } | null>(null);
  const mutation = useMutation();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const data = await listCustomers(companyId, { search, includeInactive, signal });
        if (!signal?.aborted) setRows(data);
      } catch (cause) {
        if (!signal?.aborted) setLoadError(readApiError(cause, "Could not load customers."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [companyId, includeInactive, search],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), search ? 300 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, search]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function submitForm() {
    if (!editing) return;
    const payload = toPayload(editing.form);
    const ok = await mutation.run(
      async () =>
        editing.mode === "create"
          ? createCustomer(companyId, payload)
          : updateCustomer(companyId, selectedId ?? "", { ...payload, isActive: editing.form.isActive }),
      (saved) => {
        setEditing(null);
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
            <button
              className="cat-btn"
              onClick={() => setEditing({ mode: "edit", form: toForm(selected) })}
              type="button"
            >
              Edit customer
            </button>
          }
          eyebrow="Customer"
          meta={<Pill value={selected.isActive ? "Active" : "Inactive"} />}
          onBack={() => onSelect(null)}
          title={`${selected.customerNo} · ${selected.displayName}`}
        />

        <Card title="Details">
          <Facts
            items={[
              ["Type", humanize(selected.type)],
              ["Contact", selected.primaryContactName || "—"],
              ["Phone", selected.primaryPhone || "—"],
              ["Email", selected.primaryEmail || "—"],
              ["Tax registration", selected.taxRegistrationNo || "—"],
              ["Inquiries", String(selected.inquiryCount)],
              ["Billing address", selected.billingAddress || "—"],
              ["Notes", selected.notes || "—"],
            ]}
          />
        </Card>

        {editing ? (
          <CustomerForm
            busy={mutation.busy}
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

  return (
    <div className="cat-stack">
      <Toolbar>
        <SearchInput onChange={setSearch} placeholder="Search customers" value={search} />
        <label className="cat-check">
          <input
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
            type="checkbox"
          />
          Include inactive
        </label>
        <button className="cat-btn" onClick={() => void load()} type="button">
          <RefreshCw className={loading ? "cat-spin" : ""} size={15} /> Refresh
        </button>
        <button
          className="cat-btn cat-btn--primary"
          onClick={() => {
            mutation.setError(null);
            setEditing({ mode: "create", form: emptyForm });
          }}
          type="button"
        >
          <Plus size={15} /> New customer
        </button>
      </Toolbar>

      {loadError ? <ErrorBanner message={loadError} /> : null}

      {rows.length ? (
        <table className="cat-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Name</th>
              <th>Type</th>
              <th>Contact</th>
              <th>Phone</th>
              <th className="is-end">Inquiries</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row.id)} tabIndex={0}>
                <td>{row.customerNo}</td>
                <td>
                  <strong>{row.displayName}</strong>
                </td>
                <td>{humanize(row.type)}</td>
                <td>{row.primaryContactName || "—"}</td>
                <td>{row.primaryPhone || "—"}</td>
                <td className="is-end">{row.inquiryCount}</td>
                <td>
                  <Pill value={row.isActive ? "Active" : "Inactive"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          detail={
            loading
              ? "Loading customers."
              : "Create a customer to start taking inquiries and raising quotations."
          }
          title="No customers"
        />
      )}

      {editing ? (
        <CustomerForm
          busy={mutation.busy}
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

function CustomerForm({
  mode,
  form,
  onChange,
  onSubmit,
  onClose,
  busy,
  error,
}: {
  mode: "create" | "edit";
  form: FormState;
  onChange: (form: FormState) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <FormDialog
      busy={busy}
      disabled={!form.displayName.trim()}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={mode === "create" ? "Create customer" : "Save changes"}
      title={mode === "create" ? "New customer" : "Edit customer"}
    >
      <div className="cat-form-grid">
        <TextField
          label="Display name"
          onChange={(value) => set("displayName", value)}
          required
          value={form.displayName}
        />
        <SelectField
          label="Customer type"
          onChange={(value) => set("type", value as CateringCustomerType)}
          options={customerTypeOptions}
          value={form.type}
        />
        <TextField
          label="Primary contact"
          onChange={(value) => set("primaryContactName", value)}
          value={form.primaryContactName}
        />
        <TextField
          label="Phone"
          onChange={(value) => set("primaryPhone", value)}
          type="tel"
          value={form.primaryPhone}
        />
        <TextField
          label="Email"
          onChange={(value) => set("primaryEmail", value)}
          type="email"
          value={form.primaryEmail}
        />
        <TextField
          label="Tax registration no."
          onChange={(value) => set("taxRegistrationNo", value)}
          value={form.taxRegistrationNo}
        />
      </div>
      <TextAreaField
        label="Billing address"
        onChange={(value) => set("billingAddress", value)}
        value={form.billingAddress}
      />
      <TextAreaField label="Notes" onChange={(value) => set("notes", value)} value={form.notes} />
      {mode === "edit" ? (
        <label className="cat-check">
          <input
            checked={form.isActive}
            onChange={(event) => set("isActive", event.target.checked)}
            type="checkbox"
          />
          Customer is active
        </label>
      ) : null}
    </FormDialog>
  );
}
