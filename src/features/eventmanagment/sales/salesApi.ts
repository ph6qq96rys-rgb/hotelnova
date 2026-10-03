// src/features/eventmanagment/sales/salesApi.ts
//
// Client for the catering sales spine: customers, inquiries, quotations and
// event confirmation.
//
// cateringManagementApi.ts covers reads and a few operational commands, but
// implements none of the create/lifecycle endpoints — there was no way to
// create a customer, take an inquiry, raise a quotation, move it through
// submit/approve/accept, confirm an event or record a payment. Those 26
// endpoints are wired here.
//
// Contracts mirror the C# DTOs in RestaurantFNB.Application.Catering.DTOs.
// Enums cross the wire as camelCase strings because Program.cs registers
// JsonStringEnumConverter(JsonNamingPolicy.CamelCase).

import { http } from "../../../api/http";

const base = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/catering`;

/* =========================
   Enum unions
========================= */

export type CateringCustomerType =
  | "individual" | "company" | "government" | "ngo" | "embassy"
  | "weddingCustomer" | "conferenceOrganizer" | "otherOrganization";

export type CateringInquiryStatus =
  | "new" | "contacted" | "quoted" | "negotiating" | "won" | "lost";

export type CateringEventType =
  | "wedding" | "conference" | "meeting" | "banquet" | "reception"
  | "training" | "governmentEvent" | "embassyEvent" | "corporateEvent" | "other";

export type CateringServiceStyle =
  | "buffet" | "plated" | "familyStyle" | "cocktail" | "coffeeBreak"
  | "packedMeal" | "mixed" | "other";

export type CateringLeadSource =
  | "walkIn" | "phone" | "email" | "website" | "socialMedia"
  | "referral" | "corporateAccount" | "repeatCustomer" | "other";

export type CateringQuotationStatus =
  | "draft" | "submitted" | "approved" | "accepted" | "rejected" | "superseded";

export type CateringEventStatus =
  | "pendingDeposit" | "confirmed" | "inPlanning" | "inExecution" | "completed" | "cancelled";

export type CateringPaymentType =
  | "deposit" | "progress" | "final" | "additionalCharge" | "refund";

export type CateringPaymentMethod =
  | "cash" | "bankTransfer" | "card" | "mobileMoney" | "cheque" | "credit" | "other";

/* =========================
   Customers
========================= */

export type CateringCustomerDto = {
  id: string;
  companyId: string;
  customerNo: string;
  type: CateringCustomerType;
  displayName: string;
  primaryContactName?: string | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  billingAddress?: string | null;
  taxRegistrationNo?: string | null;
  notes?: string | null;
  isActive: boolean;
  inquiryCount: number;
};

export type CreateCateringCustomerDto = {
  type: CateringCustomerType;
  displayName: string;
  primaryContactName?: string | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  billingAddress?: string | null;
  taxRegistrationNo?: string | null;
  notes?: string | null;
};

export type UpdateCateringCustomerDto = CreateCateringCustomerDto & { isActive: boolean };

export async function listCustomers(
  companyId: string,
  params?: { search?: string | null; includeInactive?: boolean; signal?: AbortSignal },
): Promise<CateringCustomerDto[]> {
  const { data } = await http.get<CateringCustomerDto[]>(`${base(companyId)}/customers`, {
    params: {
      search: params?.search || undefined,
      includeInactive: params?.includeInactive ? true : undefined,
    },
    signal: params?.signal,
  });
  return Array.isArray(data) ? data : [];
}

export async function getCustomer(companyId: string, customerId: string, signal?: AbortSignal) {
  const { data } = await http.get<CateringCustomerDto>(
    `${base(companyId)}/customers/${customerId}`,
    { signal },
  );
  return data;
}

export async function createCustomer(companyId: string, body: CreateCateringCustomerDto) {
  const { data } = await http.post<CateringCustomerDto>(`${base(companyId)}/customers`, body);
  return data;
}

export async function updateCustomer(
  companyId: string,
  customerId: string,
  body: UpdateCateringCustomerDto,
) {
  const { data } = await http.put<CateringCustomerDto>(
    `${base(companyId)}/customers/${customerId}`,
    body,
  );
  return data;
}

/* =========================
   Inquiries
========================= */

export type CateringInquiryDto = {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerNo: string;
  customerName: string;
  inquiryNo: string;
  eventType: CateringEventType;
  proposedEventDateUtc: string;
  venueName: string;
  venueAddress?: string | null;
  expectedGuests: number;
  budgetAmount?: number | null;
  serviceStyle: CateringServiceStyle;
  menuPreference?: string | null;
  contactPersonName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  leadSource: CateringLeadSource;
  status: CateringInquiryStatus;
  statusChangedAtUtc?: string | null;
  lostReason?: string | null;
  notes?: string | null;
};

export type CreateCateringInquiryDto = {
  branchId: string;
  customerId: string;
  eventType: CateringEventType;
  proposedEventDateUtc: string;
  venueName: string;
  venueAddress?: string | null;
  expectedGuests: number;
  budgetAmount?: number | null;
  serviceStyle: CateringServiceStyle;
  menuPreference?: string | null;
  contactPersonName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  leadSource: CateringLeadSource;
  notes?: string | null;
};

export type UpdateCateringInquiryDto = Omit<CreateCateringInquiryDto, "branchId" | "customerId">;

export async function listInquiries(
  companyId: string,
  params?: {
    branchId?: string | null;
    customerId?: string | null;
    status?: CateringInquiryStatus | null;
    signal?: AbortSignal;
  },
): Promise<CateringInquiryDto[]> {
  const { data } = await http.get<CateringInquiryDto[]>(`${base(companyId)}/inquiries`, {
    params: {
      branchId: params?.branchId || undefined,
      customerId: params?.customerId || undefined,
      status: params?.status || undefined,
    },
    signal: params?.signal,
  });
  return Array.isArray(data) ? data : [];
}

export async function getInquiry(companyId: string, inquiryId: string, signal?: AbortSignal) {
  const { data } = await http.get<CateringInquiryDto>(
    `${base(companyId)}/inquiries/${inquiryId}`,
    { signal },
  );
  return data;
}

export async function createInquiry(companyId: string, body: CreateCateringInquiryDto) {
  const { data } = await http.post<CateringInquiryDto>(`${base(companyId)}/inquiries`, body);
  return data;
}

export async function updateInquiry(
  companyId: string,
  inquiryId: string,
  body: UpdateCateringInquiryDto,
) {
  const { data } = await http.put<CateringInquiryDto>(
    `${base(companyId)}/inquiries/${inquiryId}`,
    body,
  );
  return data;
}

export async function updateInquiryStatus(
  companyId: string,
  inquiryId: string,
  body: { status: CateringInquiryStatus; reason?: string | null },
) {
  const { data } = await http.post<CateringInquiryDto>(
    `${base(companyId)}/inquiries/${inquiryId}/status`,
    body,
  );
  return data;
}

/* =========================
   Quotations
========================= */

export type CateringQuotationDto = {
  packageSnapshotJson?: string | null;
  priceOverrideReason?: string | null;
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  inquiryId: string;
  inquiryNo: string;
  customerId: string;
  customerName: string;
  packageId?: string | null;
  packageNameSnapshot?: string | null;
  quoteNo: string;
  versionNo: number;
  status: CateringQuotationStatus;
  guestCount: number;
  pricePerPerson: number;
  foodAmount: number;
  venueCharge: number;
  equipmentCharge: number;
  staffingCharge: number;
  transportationCharge: number;
  otherCharge: number;
  serviceChargePercent: number;
  serviceChargeAmount: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  requiredDepositAmount: number;
  grandTotal: number;
  validUntilUtc: string;
  submittedAtUtc?: string | null;
  approvedAtUtc?: string | null;
  acceptedAtUtc?: string | null;
  customerAcceptanceReference?: string | null;
  rejectedAtUtc?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
};

/** Used for both create and revise. */
export type UpsertCateringQuotationDto = {
  selectedItemIds?: string[];
  selectedLineKeys?: string[];
  priceOverrideReason?: string | null;
  inquiryId: string;
  packageId?: string | null;
  guestCount: number;
  pricePerPerson?: number | null;
  venueCharge: number;
  equipmentCharge: number;
  staffingCharge: number;
  transportationCharge: number;
  otherCharge: number;
  serviceChargePercent: number;
  discountAmount: number;
  taxPercent: number;
  requiredDepositAmount: number;
  validUntilUtc: string;
  notes?: string | null;
};

export async function listQuotations(
  companyId: string,
  params?: {
    branchId?: string | null;
    inquiryId?: string | null;
    status?: CateringQuotationStatus | null;
    signal?: AbortSignal;
  },
): Promise<CateringQuotationDto[]> {
  const { data } = await http.get<CateringQuotationDto[]>(`${base(companyId)}/quotations`, {
    params: {
      branchId: params?.branchId || undefined,
      inquiryId: params?.inquiryId || undefined,
      status: params?.status || undefined,
    },
    signal: params?.signal,
  });
  return Array.isArray(data) ? data : [];
}

export async function getQuotation(companyId: string, quotationId: string, signal?: AbortSignal) {
  const { data } = await http.get<CateringQuotationDto>(
    `${base(companyId)}/quotations/${quotationId}`,
    { signal },
  );
  return data;
}

export async function createQuotation(companyId: string, body: UpsertCateringQuotationDto) {
  const { data } = await http.post<CateringQuotationDto>(`${base(companyId)}/quotations`, body);
  return data;
}

export async function reviseQuotation(
  companyId: string,
  quotationId: string,
  body: UpsertCateringQuotationDto,
) {
  const { data } = await http.post<CateringQuotationDto>(
    `${base(companyId)}/quotations/${quotationId}/revise`,
    body,
  );
  return data;
}

export async function submitQuotation(companyId: string, quotationId: string) {
  const { data } = await http.post<CateringQuotationDto>(
    `${base(companyId)}/quotations/${quotationId}/submit`,
    {},
  );
  return data;
}

export async function approveQuotation(companyId: string, quotationId: string) {
  const { data } = await http.post<CateringQuotationDto>(
    `${base(companyId)}/quotations/${quotationId}/approve`,
    {},
  );
  return data;
}

export async function acceptQuotation(
  companyId: string,
  quotationId: string,
  body: { customerAcceptanceReference?: string | null },
) {
  const { data } = await http.post<CateringQuotationDto>(
    `${base(companyId)}/quotations/${quotationId}/accept`,
    body,
  );
  return data;
}

export async function rejectQuotation(
  companyId: string,
  quotationId: string,
  body: { reason: string },
) {
  const { data } = await http.post<CateringQuotationDto>(
    `${base(companyId)}/quotations/${quotationId}/reject`,
    body,
  );
  return data;
}

/* =========================
   Events
========================= */

export type CateringEventPaymentDto = {
  id: string;
  amount: number;
  receivedAtUtc: string;
  referenceNo?: string | null;
  notes?: string | null;
};

export type CateringEventRecordDto = {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  inquiryId: string;
  inquiryNo: string;
  customerId: string;
  customerName: string;
  acceptedQuotationId: string;
  eventNo: string;
  status: CateringEventStatus;
  eventType: CateringEventType;
  serviceStyle: CateringServiceStyle;
  eventDateUtc: string;
  venueName: string;
  venueAddress?: string | null;
  guestCount: number;
  packageNameSnapshot?: string | null;
  quoteNoSnapshot: string;
  contractValue: number;
  requiredDepositAmount: number;
  depositReceivedAmount: number;
  paymentReceivedAmount: number;
  remainingBalance: number;
  confirmedAtUtc: string;
  notes?: string | null;
  payments: CateringEventPaymentDto[];
};

export type RecordCateringEventPaymentDto = {
  type: CateringPaymentType;
  method: CateringPaymentMethod;
  amount: number;
  receivedAtUtc?: string | null;
  referenceNo?: string | null;
  receivedByName?: string | null;
  notes?: string | null;
};

export type ConfirmCateringEventDto = {
  acceptedQuotationId: string;
  eventDateUtc?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  notes?: string | null;
  initialDeposit?: RecordCateringEventPaymentDto | null;
};

export async function listEvents(
  companyId: string,
  params?: { branchId?: string | null; status?: CateringEventStatus | null; signal?: AbortSignal },
): Promise<CateringEventRecordDto[]> {
  const { data } = await http.get<CateringEventRecordDto[]>(`${base(companyId)}/events`, {
    params: {
      branchId: params?.branchId || undefined,
      status: params?.status || undefined,
    },
    signal: params?.signal,
  });
  return Array.isArray(data) ? data : [];
}

export async function getEvent(companyId: string, eventId: string, signal?: AbortSignal) {
  const { data } = await http.get<CateringEventRecordDto>(`${base(companyId)}/events/${eventId}`, {
    signal,
  });
  return data;
}

export async function confirmEventFromQuotation(
  companyId: string,
  body: ConfirmCateringEventDto,
) {
  const { data } = await http.post<CateringEventRecordDto>(
    `${base(companyId)}/events/from-quotation`,
    body,
  );
  return data;
}

export async function recordEventPayment(
  companyId: string,
  eventId: string,
  body: RecordCateringEventPaymentDto,
) {
  const { data } = await http.post<CateringEventRecordDto>(
    `${base(companyId)}/events/${eventId}/payments`,
    body,
  );
  return data;
}

export async function cancelEvent(
  companyId: string,
  eventId: string,
  body: { reason: string },
) {
  const { data } = await http.post<CateringEventRecordDto>(
    `${base(companyId)}/events/${eventId}/cancel`,
    body,
  );
  return data;
}
