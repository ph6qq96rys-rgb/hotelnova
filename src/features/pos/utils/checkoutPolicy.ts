import type { CartItem, PaymentMethod } from "../types/posTypes";
function round2(value: number) { return Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100; }
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
    serviceCharge += round2(net * (rates?.serviceChargeRate ?? 0) / 100);
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  serviceCharge = round2(serviceCharge);
  const discount = 0;
  const total = round2(subtotal + tax + serviceCharge - discount);

  return { subtotal, discount, serviceCharge, tax, total };
}

export function validateCheckout(args: {
  storeId: string;
  cart: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: string;
  referenceCode: string;
  orderContext: { orderType: string; tableNo: string; guestCount: number };
}): string | null {
  if (!args.storeId) return "Select a POS location before processing the sale.";
  if (args.cart.length === 0)
    return "At least one item must be added before checkout.";
  if (args.total <= 0)
    return "The transaction total must be greater than zero.";

  if (
    args.orderContext.orderType === "DINE_IN" &&
    !args.orderContext.tableNo.trim()
  ) {
    return "Table number is required for dine-in service.";
  }

  if (args.orderContext.guestCount <= 0) {
    return "Guest count must be one or greater.";
  }

  const blocked = args.cart.find(
    (x) =>
      x.isAvailableForSale === false ||
      x.hasRecipe === false ||
      x.hasConsumptionLocation === false,
  );

  if (blocked) {
    return `${blocked.name} is not ready for sale. Refresh the menu catalogue or contact the supervisor.`;
  }

  if (args.paymentMethod === "CASH") {
    const tendered = Number(args.amountTendered || 0);

    if (!Number.isFinite(tendered) || tendered < 0) {
      return "Enter a valid cash amount received from the customer.";
    }

    if (tendered < args.total) {
      return "Cash received is insufficient to complete the transaction.";
    }
  }

  if (args.paymentMethod !== "CASH" && !args.referenceCode.trim()) {
    return "Payment reference is required for card, mobile, and transfer payments.";
  }

  return null;
}

