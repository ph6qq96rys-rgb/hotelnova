import { http } from "../../../api/http";
import type { CateringPackage } from "../screens/PackagesScreen";
// src/features/eventmanagment/sales/QuotationsScreen.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import {
  acceptQuotation,
  approveQuotation,
  createQuotation,
  listInquiries,
  listQuotations,
  rejectQuotation,
  reviseQuotation,
  submitQuotation,
  type CateringInquiryDto,
  type CateringQuotationDto,
  type CateringQuotationStatus,
  type UpsertCateringQuotationDto,
} from "./salesApi";
import { humanize, quotationStatusOptions } from "./options";
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

type PricingForm = {
  selectedLineKeys?: string[];
  priceOverrideReason?: string;
  pricingMode?: string;
  packageId: string;
  inquiryId: string;
  guestCount: number | "";
  pricePerPerson: number | "";
  venueCharge: number | "";
  equipmentCharge: number | "";
  staffingCharge: number | "";
  transportationCharge: number | "";
  otherCharge: number | "";
  serviceChargePercent: number | "";
  discountAmount: number | "";
  taxPercent: number | "";
  requiredDepositAmount: number | "";
  validUntilUtc: string;
  notes: string;
};

function emptyPricing(inquiryId = ""): PricingForm {
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 14);
  return {
    inquiryId,
    packageId: "",
    guestCount: 100,
    pricePerPerson: 0,
    venueCharge: 0,
    equipmentCharge: 0,
    staffingCharge: 0,
    transportationCharge: 0,
    otherCharge: 0,
    serviceChargePercent: 0,
    discountAmount: 0,
    taxPercent: 15,
    requiredDepositAmount: 0,
    validUntilUtc: toDateTimeInput(validUntil.toISOString()),
    notes: "",
  };
}

function toPricing(quote: CateringQuotationDto): PricingForm {
  let snapshot: {offering?:{pricingMode?:string;sections?:{items:{itemId:string}[]}[]};selectedLineKeys?:string[];items?:{itemId:string}[]}|null=null;
  try{snapshot=quote.packageSnapshotJson?JSON.parse(quote.packageSnapshotJson):null;}catch{/* Legacy quotation without snapshot. */}
  return {
    pricingMode:snapshot?.offering?.pricingMode,
    selectedLineKeys:snapshot?.selectedLineKeys??snapshot?.offering?.sections?.flatMap((s,i)=>s.items.filter(l=>snapshot?.items?.some(x=>x.itemId===l.itemId)).map(l=>`${i}:${l.itemId}`))??[],
    priceOverrideReason:quote.priceOverrideReason??"",
    inquiryId: quote.inquiryId,
    packageId: quote.packageId ?? "",
    guestCount: quote.guestCount,
    pricePerPerson: snapshot?.offering?.pricingMode==="Fixed"?quote.foodAmount:quote.pricePerPerson,
    venueCharge: quote.venueCharge,
    equipmentCharge: quote.equipmentCharge,
    staffingCharge: quote.staffingCharge,
    transportationCharge: quote.transportationCharge,
    otherCharge: quote.otherCharge,
    serviceChargePercent: quote.serviceChargePercent,
    discountAmount: quote.discountAmount,
    taxPercent: quote.taxPercent,
    requiredDepositAmount: quote.requiredDepositAmount,
    validUntilUtc: toDateTimeInput(quote.validUntilUtc),
    notes: quote.notes ?? "",
  };
}

const n = (value: number | "") => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function toPayload(form: PricingForm): UpsertCateringQuotationDto {
  return {
    selectedLineKeys: form.selectedLineKeys ?? [],
    priceOverrideReason: form.priceOverrideReason || null,
    inquiryId: form.inquiryId,
    packageId: form.packageId || null,
    guestCount: n(form.guestCount),
    pricePerPerson: typeof form.pricePerPerson === "number" ? form.pricePerPerson : null,
    venueCharge: n(form.venueCharge),
    equipmentCharge: n(form.equipmentCharge),
    staffingCharge: n(form.staffingCharge),
    transportationCharge: n(form.transportationCharge),
    otherCharge: n(form.otherCharge),
    serviceChargePercent: n(form.serviceChargePercent),
    discountAmount: n(form.discountAmount),
    taxPercent: n(form.taxPercent),
    requiredDepositAmount: n(form.requiredDepositAmount),
    validUntilUtc: fromDateTimeInput(form.validUntilUtc) ?? new Date().toISOString(),
    notes: form.notes.trim() || null,
  };
}

/**
 * Client-side preview of what the quotation will total. The server recomputes
 * and is authoritative — this exists so the person pricing the job can see the
 * effect of a change before saving.
 */
function estimate(form: PricingForm) {
  const food = form.pricingMode === "Fixed" ? n(form.pricePerPerson) : n(form.guestCount) * n(form.pricePerPerson);
  const subtotal =
    food +
    n(form.venueCharge) +
    n(form.equipmentCharge) +
    n(form.staffingCharge) +
    n(form.transportationCharge) +
    n(form.otherCharge);
  const serviceCharge = (subtotal * n(form.serviceChargePercent)) / 100;
  const net = subtotal + serviceCharge - n(form.discountAmount);
  const tax = (net * n(form.taxPercent)) / 100;
  return { food, subtotal, serviceCharge, net, tax, grandTotal: net + tax };
}

export function QuotationsScreen({
  companyId,
  branchId,
  selectedId,
  onSelect,
  draftForInquiryId,
  onDraftConsumed,
  onConfirmEvent,
}: {
  companyId: string;
  branchId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Set when the operator clicked "Raise quotation" on an inquiry. */
  draftForInquiryId: string | null;
  onDraftConsumed: () => void;
  onConfirmEvent: (quotationId: string) => void;
}) {
  const [packages, setPackages] = useState<CateringPackage[]>([]);
  useEffect(() => { const c = new AbortController(); setPackages([]); if (companyId) http.get<CateringPackage[]>("/companies/"+companyId+"/catering/packages",{params:{branchId:branchId||undefined},signal:c.signal}).then(r=>{if(!c.signal.aborted)setPackages(r.data);}).catch(e=>{if(!c.signal.aborted)setLoadError(readApiError(e,"Could not load packages."));}); return ()=>c.abort(); },[companyId,branchId]);
  const [rows, setRows] = useState<CateringQuotationDto[]>([]);
  const [inquiries, setInquiries] = useState<CateringInquiryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<CateringQuotationStatus | "">("");
  const [editing, setEditing] = useState<{ mode: "create" | "revise"; form: PricingForm } | null>(null);
  const [accepting, setAccepting] = useState<{ reference: string } | null>(null);
  const [rejecting, setRejecting] = useState<{ reason: string } | null>(null);
  const mutation = useMutation();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const data = await listQuotations(companyId, {
          branchId: branchId || undefined,
          status: status || undefined,
          signal,
        });
        if (!signal?.aborted) setRows(data);
      } catch (cause) {
        if (!signal?.aborted) setLoadError(readApiError(cause, "Could not load quotations."));
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
    void listInquiries(companyId, { branchId: branchId || undefined, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setInquiries(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [branchId, companyId]);

  // Opening a draft from the inquiry screen.
  useEffect(() => {
    if (!draftForInquiryId) return;
    mutation.setError(null);
    setEditing({ mode: "create", form: emptyPricing(draftForInquiryId) });
    onDraftConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftForInquiryId]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function submitForm() {
    if (!editing) return;
    const payload = toPayload(editing.form);
    const ok = await mutation.run(
      async () =>
        editing.mode === "create"
          ? createQuotation(companyId, payload)
          : reviseQuotation(companyId, selectedId ?? "", payload),
      (saved) => {
        setEditing(null);
        onSelect(saved.id);
      },
    );
    if (ok) void load();
  }

  async function runLifecycle(action: () => Promise<CateringQuotationDto>) {
    const ok = await mutation.run(action, (saved) => onSelect(saved.id));
    if (ok) void load();
  }

  if (selected) {
    const canRevise = selected.status === "draft";
    const canSubmit = selected.status === "draft";
    const canApprove = selected.status === "submitted";
    const canAccept = selected.status === "approved";
    const canReject = selected.status === "submitted" || selected.status === "approved";
    const canConfirmEvent = selected.status === "accepted";

    return (
      <div className="cat-stack">
        <DetailHeader
          actions={
            <>
              {canRevise ? (
                <button
                  className="cat-btn"
                  onClick={() => {
                    mutation.setError(null);
                    setEditing({ mode: "revise", form: toPricing(selected) });
                  }}
                  type="button"
                >
                  Revise
                </button>
              ) : null}
              {canSubmit ? (
                <button
                  className="cat-btn"
                  disabled={mutation.busy}
                  onClick={() => void runLifecycle(() => submitQuotation(companyId, selected.id))}
                  type="button"
                >
                  Submit for approval
                </button>
              ) : null}
              {canApprove ? (
                <button
                  className="cat-btn cat-btn--primary"
                  disabled={mutation.busy}
                  onClick={() => void runLifecycle(() => approveQuotation(companyId, selected.id))}
                  type="button"
                >
                  Approve
                </button>
              ) : null}
              {canAccept ? (
                <button
                  className="cat-btn cat-btn--primary"
                  onClick={() => {
                    mutation.setError(null);
                    setAccepting({ reference: "" });
                  }}
                  type="button"
                >
                  Mark accepted
                </button>
              ) : null}
              {canReject ? (
                <button
                  className="cat-btn cat-btn--danger"
                  onClick={() => {
                    mutation.setError(null);
                    setRejecting({ reason: "" });
                  }}
                  type="button"
                >
                  Reject
                </button>
              ) : null}
              {canConfirmEvent ? (
                <button
                  className="cat-btn cat-btn--primary"
                  onClick={() => onConfirmEvent(selected.id)}
                  type="button"
                >
                  Confirm event
                </button>
              ) : null}
            </>
          }
          eyebrow={`Quotation · version ${selected.versionNo}`}
          meta={
            <>
              <Pill value={humanize(selected.status)} />
              <span>{selected.customerName}</span>
            </>
          }
          onBack={() => onSelect(null)}
          title={selected.quoteNo}
        />

        {mutation.error ? <ErrorBanner message={mutation.error} /> : null}

        <div className="cat-split">
          <Card title="Pricing">
            <table className="cat-table cat-table--totals">
              <tbody>
                <tr>
                  <td>Food ({selected.guestCount} guests × {formatCurrency(selected.pricePerPerson)})</td>
                  <td className="is-end">{formatCurrency(selected.foodAmount)}</td>
                </tr>
                <tr>
                  <td>Venue</td>
                  <td className="is-end">{formatCurrency(selected.venueCharge)}</td>
                </tr>
                <tr>
                  <td>Equipment</td>
                  <td className="is-end">{formatCurrency(selected.equipmentCharge)}</td>
                </tr>
                <tr>
                  <td>Staffing</td>
                  <td className="is-end">{formatCurrency(selected.staffingCharge)}</td>
                </tr>
                <tr>
                  <td>Transportation</td>
                  <td className="is-end">{formatCurrency(selected.transportationCharge)}</td>
                </tr>
                <tr>
                  <td>Other</td>
                  <td className="is-end">{formatCurrency(selected.otherCharge)}</td>
                </tr>
                <tr>
                  <td>Service charge ({selected.serviceChargePercent}%)</td>
                  <td className="is-end">{formatCurrency(selected.serviceChargeAmount)}</td>
                </tr>
                <tr>
                  <td>Discount</td>
                  <td className="is-end">−{formatCurrency(selected.discountAmount)}</td>
                </tr>
                <tr>
                  <td>Tax ({selected.taxPercent}%)</td>
                  <td className="is-end">{formatCurrency(selected.taxAmount)}</td>
                </tr>
                <tr className="cat-total-row">
                  <td>Grand total</td>
                  <td className="is-end">{formatCurrency(selected.grandTotal)}</td>
                </tr>
                <tr>
                  <td>Required deposit</td>
                  <td className="is-end">{formatCurrency(selected.requiredDepositAmount)}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {selected.packageSnapshotJson&&<QuotedPackage json={selected.packageSnapshotJson}/>}
          <Card title="Document">
            <Facts
              items={[
                ["Inquiry", selected.inquiryNo],
                ["Customer", selected.customerName],
                ["Branch", selected.branchName],
                ["Package", selected.packageNameSnapshot || "—"],
                ["Valid until", formatDay(selected.validUntilUtc)],
                ["Submitted", formatDateTime(selected.submittedAtUtc)],
                ["Approved", formatDateTime(selected.approvedAtUtc)],
                ["Accepted", formatDateTime(selected.acceptedAtUtc)],
                ["Acceptance ref.", selected.customerAcceptanceReference || "—"],
                ["Rejected", formatDateTime(selected.rejectedAtUtc)],
                ["Rejection reason", selected.rejectionReason || "—"],
                ["Notes", selected.notes || "—"],
              ]}
            />
          </Card>
        </div>

        {editing ? (
          <PricingDialog
          packages={packages}
            busy={mutation.busy}
            error={mutation.error}
            form={editing.form}
            inquiries={inquiries}
            mode={editing.mode}
            onChange={(form) => setEditing({ ...editing, form })}
            onClose={() => setEditing(null)}
            onSubmit={submitForm}
          />
        ) : null}

        {accepting ? (
          <FormDialog
            busy={mutation.busy}
            description="Records the customer's acceptance. The quotation becomes the contract basis for the event."
            error={mutation.error}
            onClose={() => setAccepting(null)}
            onSubmit={() =>
              void (async () => {
                const ok = await mutation.run(
                  () =>
                    acceptQuotation(companyId, selected.id, {
                      customerAcceptanceReference: accepting.reference.trim() || null,
                    }),
                  () => setAccepting(null),
                );
                if (ok) void load();
              })()
            }
            submitLabel="Mark accepted"
            title="Accept quotation"
          >
            <TextField
              help="Signed quote reference, email subject, or PO number."
              label="Customer acceptance reference"
              onChange={(value) => setAccepting({ reference: value })}
              value={accepting.reference}
            />
          </FormDialog>
        ) : null}

        {rejecting ? (
          <FormDialog
            busy={mutation.busy}
            destructive
            disabled={!rejecting.reason.trim()}
            error={mutation.error}
            onClose={() => setRejecting(null)}
            onSubmit={() =>
              void (async () => {
                const ok = await mutation.run(
                  () => rejectQuotation(companyId, selected.id, { reason: rejecting.reason.trim() }),
                  () => setRejecting(null),
                );
                if (ok) void load();
              })()
            }
            submitLabel="Reject quotation"
            title="Reject quotation"
          >
            <TextAreaField
              label="Reason"
              onChange={(value) => setRejecting({ reason: value })}
              required
              value={rejecting.reason}
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
          onChange={(value) => setStatus(value as CateringQuotationStatus | "")}
          options={quotationStatusOptions}
          placeholder="All statuses"
          value={status}
        />
        <button className="cat-btn" onClick={() => void load()} type="button">
          <RefreshCw className={loading ? "cat-spin" : ""} size={15} /> Refresh
        </button>
        <button
          className="cat-btn cat-btn--primary"
          disabled={!inquiries.length}
          onClick={() => {
            mutation.setError(null);
            setEditing({ mode: "create", form: emptyPricing() });
          }}
          title={inquiries.length ? undefined : "An inquiry is required before quoting"}
          type="button"
        >
          <Plus size={15} /> New quotation
        </button>
      </Toolbar>

      {loadError ? <ErrorBanner message={loadError} /> : null}

      {rows.length ? (
        <table className="cat-table">
          <thead>
            <tr>
              <th>Quote</th>
              <th className="is-end">Ver.</th>
              <th>Customer</th>
              <th>Inquiry</th>
              <th className="is-end">Guests</th>
              <th className="is-end">Total</th>
              <th>Valid until</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row.id)} tabIndex={0}>
                <td>
                  <strong>{row.quoteNo}</strong>
                </td>
                <td className="is-end">{row.versionNo}</td>
                <td>{row.customerName}</td>
                <td>{row.inquiryNo}</td>
                <td className="is-end">{row.guestCount}</td>
                <td className="is-end">{formatCurrency(row.grandTotal)}</td>
                <td>{formatDay(row.validUntilUtc)}</td>
                <td>
                  <Pill value={humanize(row.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          detail={
            loading
              ? "Loading quotations."
              : "Raise a quotation from an inquiry to price the job."
          }
          title="No quotations"
        />
      )}

      {editing ? (
        <PricingDialog
          packages={packages}
          busy={mutation.busy}
          error={mutation.error}
          form={editing.form}
          inquiries={inquiries}
          mode={editing.mode}
          onChange={(form) => setEditing({ ...editing, form })}
          onClose={() => setEditing(null)}
          onSubmit={submitForm}
        />
      ) : null}
    </div>
  );
}

function PricingDialog({
  packages,
  mode,
  form,
  inquiries,
  onChange,
  onSubmit,
  onClose,
  busy,
  error,
}: {
  packages: CateringPackage[];
  mode: "create" | "revise";
  form: PricingForm;
  inquiries: CateringInquiryDto[];
  onChange: (form: PricingForm) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
}) {
  const set = <K extends keyof PricingForm>(key: K, value: PricingForm[K]) =>
    onChange({ ...form, [key]: value });
  const totals = useMemo(() => estimate(form), [form]);
  const selectedPackage=packages.find(p=>p.id===form.packageId);
  const packagePrice=(p:CateringPackage,selected:string[],guests:number)=>{const o=p.offering;const extras=o?.sections.flatMap((s,i)=>s.items.filter(l=>s.rule==="All"||selected.includes(`${i}:${l.itemId}`))).reduce((sum,l)=>sum+l.additionalCharge*(l.perGuest?guests:1),0)??0;return o?.pricingMode==="Fixed"?o.fixedPrice+extras:p.pricePerPerson+extras/Math.max(1,guests);};

  return (
    <FormDialog
      busy={busy}
      description={
        mode === "revise"
          ? "Creates a new version of this quotation. The previous version is superseded."
          : "Prices the job against an inquiry. Totals are recalculated by the server on save."
      }
      disabled={!form.inquiryId}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={mode === "create" ? "Create quotation" : "Save revision"}
      title={mode === "create" ? "New quotation" : "Revise quotation"}
    >
      {mode === "create" ? (
        <SelectField
          label="Inquiry"
          onChange={(value) => set("inquiryId", value)}
          options={inquiries.map((inquiry) => ({
            value: inquiry.id,
            label: `${inquiry.inquiryNo} · ${inquiry.customerName} · ${inquiry.expectedGuests} guests`,
          }))}
          placeholder="Select inquiry"
          required
          value={form.inquiryId}
        />
      ) : null}

      <SelectField label="Menu package" value={form.packageId} placeholder="Custom pricing (no package)" options={packages.filter(p=>p.offering&&!p.offering.archived&&(p.offering.companyWide||p.branchId===inquiries.find(i=>i.id===form.inquiryId)?.branchId)).map(p=>({value:p.id!,label:p.name}))} onChange={id=>{const p=packages.find(p=>p.id===id);onChange({...form,packageId:id,selectedLineKeys:[],pricingMode:p?.offering?.pricingMode,pricePerPerson:p?packagePrice(p,[],n(form.guestCount)):form.pricePerPerson,taxPercent:p?.offering?.taxPercent??form.taxPercent,serviceChargePercent:p?.offering?.serviceChargePercent??form.serviceChargePercent});}} />
      {selectedPackage?.offering?.sections.map((s,i)=>s.rule!=="All"&&<fieldset key={i}><legend>{s.name} · {s.rule==="Choose"?"Select "+s.selectCount:"Optional add-ons"}</legend>{s.items.map(l=><label key={l.itemId}><input type="checkbox" checked={form.selectedLineKeys?.includes(`${i}:${l.itemId}`)??false} onChange={e=>{const selected=e.target.checked?[...(form.selectedLineKeys??[]),`${i}:${l.itemId}`]:(form.selectedLineKeys??[]).filter(id=>id!==`${i}:${l.itemId}`);onChange({...form,selectedLineKeys:selected,pricePerPerson:packagePrice(selectedPackage,selected,n(form.guestCount))});}}/>{l.name??"Catering option"} {l.additionalCharge>0?" + "+formatCurrency(l.additionalCharge):""}</label>)}</fieldset>)}
      <div className="cat-form-grid">
        <NumberField
          label="Guest count"
          min={0}
          onChange={(value) => onChange({...form,guestCount:value,pricePerPerson:selectedPackage?packagePrice(selectedPackage,form.selectedLineKeys??[],n(value)):form.pricePerPerson})}
          value={form.guestCount}
        />
        <NumberField
          label={form.pricingMode==="Fixed"?"Fixed package price":"Price per person"}
          min={0}
          onChange={(value) => set("pricePerPerson", value)}
          step={10}
          value={form.pricePerPerson}
        />
        <NumberField
          label="Venue charge"
          min={0}
          onChange={(value) => set("venueCharge", value)}
          step={100}
          value={form.venueCharge}
        />
        <NumberField
          label="Equipment charge"
          min={0}
          onChange={(value) => set("equipmentCharge", value)}
          step={100}
          value={form.equipmentCharge}
        />
        <NumberField
          label="Staffing charge"
          min={0}
          onChange={(value) => set("staffingCharge", value)}
          step={100}
          value={form.staffingCharge}
        />
        <NumberField
          label="Transportation charge"
          min={0}
          onChange={(value) => set("transportationCharge", value)}
          step={100}
          value={form.transportationCharge}
        />
        <NumberField
          label="Other charge"
          min={0}
          onChange={(value) => set("otherCharge", value)}
          step={100}
          value={form.otherCharge}
        />
        <NumberField
          label="Service charge"
          min={0}
          onChange={(value) => set("serviceChargePercent", value)}
          step={0.5}
          suffix="%"
          value={form.serviceChargePercent}
        />
        <NumberField
          label="Discount amount"
          min={0}
          onChange={(value) => set("discountAmount", value)}
          step={100}
          value={form.discountAmount}
        />
        <NumberField
          label="Tax"
          min={0}
          onChange={(value) => set("taxPercent", value)}
          step={0.5}
          suffix="%"
          value={form.taxPercent}
        />
        <NumberField
          help="Amount required before the event is confirmed."
          label="Required deposit"
          min={0}
          onChange={(value) => set("requiredDepositAmount", value)}
          step={100}
          value={form.requiredDepositAmount}
        />
        <DateTimeField
          label="Valid until"
          onChange={(value) => set("validUntilUtc", value)}
          value={form.validUntilUtc}
        />
      </div>

      <div className="cat-estimate">
        <strong>Estimated total</strong>
        <ul>
          <li>
            <span>Food</span>
            <em>{formatCurrency(totals.food)}</em>
          </li>
          <li>
            <span>Subtotal</span>
            <em>{formatCurrency(totals.subtotal)}</em>
          </li>
          <li>
            <span>Service charge</span>
            <em>{formatCurrency(totals.serviceCharge)}</em>
          </li>
          <li>
            <span>Tax</span>
            <em>{formatCurrency(totals.tax)}</em>
          </li>
          <li className="is-total">
            <span>Grand total</span>
            <em>{formatCurrency(totals.grandTotal)}</em>
          </li>
        </ul>
        <small>Preview only — the server recalculates and stores the authoritative figures.</small>
      </div>

      <TextAreaField label="Commercial override reason (requires catering approval permission)" onChange={value=>set("priceOverrideReason",value)} value={form.priceOverrideReason??""}/>
      <TextAreaField label="Notes" onChange={(value) => set("notes", value)} value={form.notes} />
    </FormDialog>
  );
}


function QuotedPackage({json}:{json:string}){
 let snapshot:{packageVersion:number;offering:{terms?:string;inclusions?:string;exclusions?:string};items:{itemId:string;name:string;quantity:number;sellingPrice:number}[]};
 try{snapshot=JSON.parse(json);}catch{return <p>Package snapshot could not be displayed.</p>;}
 return <Card title={"Quoted package · revision "+snapshot.packageVersion}><ul>{snapshot.items.map((i,n)=><li key={n}>{i.name} · {i.quantity} units · catalog price {formatCurrency(i.sellingPrice)}</li>)}</ul><p>{snapshot.offering.inclusions}</p><p>{snapshot.offering.exclusions}</p><p>{snapshot.offering.terms}</p></Card>;
}
