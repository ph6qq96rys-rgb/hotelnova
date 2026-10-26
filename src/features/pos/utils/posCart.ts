import type { CartItem, MenuItemDto } from "../types/posTypes";
import type { PosTicketDto } from "../api/posServiceApi";

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
}

/** Why a menu item cannot be ordered, or null when it can. */
export function itemBlockReason(item: MenuItemDto): string | null {
  if (item.isActive === false) return `${item.name} is inactive and cannot be added to the order.`;
  if (item.isAvailableForSale === false) return `${item.name} is not currently available for POS sale.`;
  if (item.hasRecipe === false) return `${item.name} cannot be sold because no production recipe is configured.`;
  if (item.hasConsumptionLocation === false)
    return `${item.name} cannot be sold because the inventory consumption location is not configured.`;
  return null;
}

export function toCartItem(item: MenuItemDto, qty = 1, price = Number(item.sellingPrice || 0)): CartItem {
  const unit = round2(price);
  return {
    id: item.id,
    pricing: item.pricing,
    name: item.name,
    categoryName: item.categoryName,
    price: unit,
    qty,
    lineTotal: round2(unit * qty),
    hasRecipe: item.hasRecipe,
    hasConsumptionLocation: item.hasConsumptionLocation,
    isAvailableForSale: item.isAvailableForSale,
    code: item.code,
  };
}

const withQty = (item: CartItem, qty: number): CartItem => ({ ...item, qty, lineTotal: round2(item.price * qty) });

export type CartAction =
  | { type: "ADD"; item: MenuItemDto }
  | { type: "INCREMENT"; id: string }
  | { type: "DECREMENT"; id: string }
  | { type: "REMOVE"; id: string }
  /** Price override on a counter-sale line (pos.price.override); a reason is required. */
  | { type: "SET_PRICE"; id: string; price: number; reason: string }
  | { type: "CLEAR" };

/** Items picked on this device that have not been sent to the ticket (or paid) yet. */
export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "ADD": {
      const existing = state.find((x) => x.id === action.item.id);
      return existing
        ? state.map((x) => (x.id === action.item.id ? withQty(x, x.qty + 1) : x))
        : [...state, toCartItem(action.item)];
    }
    case "INCREMENT":
      return state.map((x) => (x.id === action.id ? withQty(x, x.qty + 1) : x));
    case "DECREMENT":
      return state.map((x) => (x.id === action.id ? withQty(x, x.qty - 1) : x)).filter((x) => x.qty > 0);
    case "REMOVE":
      return state.filter((x) => x.id !== action.id);
    case "SET_PRICE":
      return state.map((x) => {
        if (x.id !== action.id) return x;
        const listPrice = x.listPrice ?? x.price;
        const price = round2(action.price);
        return price === listPrice
          ? { ...withQty({ ...x, price }, x.qty), listPrice: undefined, overrideReason: null }
          : { ...withQty({ ...x, price }, x.qty), listPrice, overrideReason: action.reason.trim() };
      });
    case "CLEAR":
      return [];
    default:
      return state;
  }
}

/**
 * The ticket's chargeable items as cart lines, priced at the ticket's order-time prices
 * and taxed with the catalogue's current VAT/service settings (as the server will).
 */
export function ticketChargeLines(ticket: PosTicketDto | null, menu: MenuItemDto[]): CartItem[] {
  if (!ticket) return [];
  const byId = new Map(menu.map((item) => [item.id, item]));
  const grouped = new Map<string, CartItem>();
  // Items already paid on a split check are not charged again.
  for (const line of ticket.lines.filter((x) => !x.isVoided && !x.saleId)) {
    const key = `${line.menuItemId}|${line.unitPrice}`;
    const current = grouped.get(key);
    if (current) {
      grouped.set(key, withQty(current, current.qty + line.quantity));
      continue;
    }
    const menuItem = byId.get(line.menuItemId);
    grouped.set(key, menuItem
      ? toCartItem(menuItem, line.quantity, line.unitPrice)
      : {
          id: line.menuItemId, name: line.itemName, price: line.unitPrice, qty: line.quantity,
          lineTotal: round2(line.unitPrice * line.quantity),
        } as CartItem);
  }
  return [...grouped.values()];
}

/** Lines still owed on a ticket (not voided, not paid on an earlier split check). */
export function owedLines(ticket: PosTicketDto | null) {
  return (ticket?.lines ?? []).filter((line) => !line.isVoided && !line.saleId);
}

/** Split check: what one guest pays for, as cart lines (quantities chosen per ticket line). */
export function selectedChargeLines(ticket: PosTicketDto | null, menu: MenuItemDto[], selection: Record<string, number>): CartItem[] {
  if (!ticket) return [];
  const picked = owedLines(ticket)
    .filter((line) => (selection[line.id] ?? 0) > 0)
    .map((line) => ({ ...line, quantity: Math.min(line.quantity, selection[line.id]) }));
  return ticketChargeLines({ ...ticket, lines: picked }, menu);
}

export function minutesSince(iso: string, now: number): number {
  const time = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 60000)) : 0;
}
