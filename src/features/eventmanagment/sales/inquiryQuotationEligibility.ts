import type { CateringInquiryDto } from "./salesApi";

export function canQuoteInquiry(inquiry: CateringInquiryDto | undefined): boolean {
  return !!inquiry && ["new", "contacted", "quoted", "negotiating"].includes(inquiry.status);
}

export function closedInquiryMessage(inquiry: CateringInquiryDto | undefined): string | null {
  if (inquiry?.status === "won") {
    return "This inquiry is closed as Won. Use its accepted quotation and event for the confirmed booking. Create a new inquiry for a separate booking.";
  }
  if (inquiry?.status === "lost") {
    return "This inquiry is closed as Lost. Create a new inquiry if the customer wants a new quotation.";
  }
  return null;
}
