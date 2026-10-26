/** Package prices are stored before charges; quotes apply service charge before VAT. */
export function packagePricing(subtotal: number, vatPercent: number, serviceChargePercent: number) {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const serviceCharge = round(subtotal * serviceChargePercent / 100);
  const vat = round((subtotal + serviceCharge) * vatPercent / 100);
  return { serviceCharge, vat, total: round(subtotal + serviceCharge + vat) };
}
