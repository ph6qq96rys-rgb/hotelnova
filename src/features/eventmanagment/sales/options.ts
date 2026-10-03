// src/features/eventmanagment/sales/options.ts
//
// Dropdown options for the catering enums in RestaurantFNB.Domain.Catering.
// Values are the camelCase names the API serialises, because Program.cs
// registers JsonStringEnumConverter(JsonNamingPolicy.CamelCase).

export type Option<T extends string = string> = { value: T; label: string };

export const customerTypeOptions = [
  { value: "individual", label: "Individual" },
  { value: "company", label: "Company" },
  { value: "government", label: "Government" },
  { value: "ngo", label: "NGO" },
  { value: "embassy", label: "Embassy" },
  { value: "weddingCustomer", label: "Wedding customer" },
  { value: "conferenceOrganizer", label: "Conference organizer" },
  { value: "otherOrganization", label: "Other organization" },
] as const;

export const inquiryStatusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "quoted", label: "Quoted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

export const eventTypeOptions = [
  { value: "wedding", label: "Wedding" },
  { value: "conference", label: "Conference" },
  { value: "meeting", label: "Meeting" },
  { value: "banquet", label: "Banquet" },
  { value: "reception", label: "Reception" },
  { value: "training", label: "Training" },
  { value: "governmentEvent", label: "Government event" },
  { value: "embassyEvent", label: "Embassy event" },
  { value: "corporateEvent", label: "Corporate event" },
  { value: "other", label: "Other" },
] as const;

export const serviceStyleOptions = [
  { value: "buffet", label: "Buffet" },
  { value: "plated", label: "Plated" },
  { value: "familyStyle", label: "Family style" },
  { value: "cocktail", label: "Cocktail" },
  { value: "coffeeBreak", label: "Coffee break" },
  { value: "packedMeal", label: "Packed meal" },
  { value: "mixed", label: "Mixed" },
  { value: "other", label: "Other" },
] as const;

export const leadSourceOptions = [
  { value: "walkIn", label: "Walk in" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "socialMedia", label: "Social media" },
  { value: "referral", label: "Referral" },
  { value: "corporateAccount", label: "Corporate account" },
  { value: "repeatCustomer", label: "Repeat customer" },
  { value: "other", label: "Other" },
] as const;

export const quotationStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "superseded", label: "Superseded" },
] as const;

export const eventStatusOptions = [
  { value: "pendingDeposit", label: "Pending deposit" },
  { value: "confirmed", label: "Confirmed" },
  { value: "inPlanning", label: "In planning" },
  { value: "inExecution", label: "In execution" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const paymentTypeOptions = [
  { value: "deposit", label: "Deposit" },
  { value: "progress", label: "Progress payment" },
  { value: "final", label: "Final payment" },
  { value: "additionalCharge", label: "Additional charge" },
  { value: "refund", label: "Refund" },
] as const;

export const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "bankTransfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "mobileMoney", label: "Mobile money" },
  { value: "cheque", label: "Cheque" },
  { value: "credit", label: "Credit" },
  { value: "other", label: "Other" },
] as const;

/** Turns a camelCase enum value into readable text for display. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
