import type { CartItem } from "../types/posTypes";
/** Rounds half away from zero to cents, like the server's MidpointRounding.AwayFromZero. */
function round2(value: number) { return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100; }
/**
 * The bill as the server will price it. A discount is spread over the lines in proportion to their value
 * (the last line takes the remainder) and VAT and service charge are worked out on what is left, exactly
 * like SalesService, so the totals shown are the totals saved.
 */
export function buildTotals(cart: CartItem[], discountAmount = 0) {
  let subtotal = 0;
  let tax = 0;
  let serviceCharge = 0;
  const gross = round2(cart.reduce((sum, item) => sum + item.lineTotal, 0));
  const discount = round2(Math.min(Math.max(0, discountAmount), gross));
  let remaining = discount;
  cart.forEach((item, index) => {
    const lineDiscount = index === cart.length - 1 ? remaining
      : Math.min(remaining, gross === 0 ? 0 : round2(discount * item.lineTotal / gross));
    remaining = round2(remaining - lineDiscount);
    const price = item.lineTotal - lineDiscount;
    const rates = item.pricing;
    const vat = rates?.vatRate ?? 0;
    const net = rates?.pricesIncludeVat ? price / (1 + vat / 100) : price;
    subtotal += round2(net) + lineDiscount;
    tax += round2(rates?.pricesIncludeVat ? price - net : net * vat / 100);
    const charge = round2(net * (rates?.serviceChargeRate ?? 0) / 100);
    serviceCharge += charge;
    // Mirrors the server: when the company charges VAT on the service charge, it is part of the VAT.
    if (rates?.vatOnServiceCharge) tax += round2(charge * vat / 100);
  });
  subtotal = round2(subtotal);
  tax = round2(tax);
  serviceCharge = round2(serviceCharge);
  const total = round2(subtotal + tax + serviceCharge - discount);

  return { subtotal, discount, serviceCharge, tax, total };
}
