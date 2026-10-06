import type { CartItem } from "../types/posTypes";
/** Rounds half away from zero to cents, like the server's MidpointRounding.AwayFromZero. */
function round2(value: number) { return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100; }
export function buildTotals(cart: CartItem[]) {
  let subtotal = 0;
  let tax = 0;
  let serviceCharge = 0;
  for (const item of cart) {
    const rates = item.pricing;
    const vat = rates?.vatRate ?? 0;
    const net = rates?.pricesIncludeVat ? item.lineTotal / (1 + vat / 100) : item.lineTotal;
    subtotal += round2(net);
    tax += round2(rates?.pricesIncludeVat ? item.lineTotal - net : net * vat / 100);
    const charge = round2(net * (rates?.serviceChargeRate ?? 0) / 100);
    serviceCharge += charge;
    // Mirrors the server: when the company charges VAT on the service charge, it is part of the VAT.
    if (rates?.vatOnServiceCharge) tax += round2(charge * vat / 100);
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  serviceCharge = round2(serviceCharge);
  const discount = 0;
  const total = round2(subtotal + tax + serviceCharge - discount);

  return { subtotal, discount, serviceCharge, tax, total };
}
