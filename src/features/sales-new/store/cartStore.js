import { create } from 'zustand'

/**
 * Cart store — manages the in-progress order on the POS terminal.
 *
 * When POST /orders and POST /sales are ready on the backend,
 * replace the local `items` state with server-side order IDs and
 * call those endpoints from the checkout flow instead.
 */
export const useCartStore = create((set, get) => ({
  items: [],       // [{ id, name, emoji, price, qty, modifiers?, notes? }]
  tableId: null,   // number | null
  notes: '',
  discount: 0,     // fraction e.g. 0.10 = 10%
  payMethod: 'Cash',

  // ── Item actions ────────────────────────────────────────────────────────────
  addItem(item) {
    set((s) => {
      const existing = s.items.find((i) => i.id === item.id)
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.id === item.id ? { ...i, qty: i.qty + 1 } : i
          ),
        }
      }
      return { items: [...s.items, { ...item, qty: 1 }] }
    })
  },

  removeItem(id) {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  },

  setQty(id, qty) {
    if (qty <= 0) {
      get().removeItem(id)
      return
    }
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, qty } : i)),
    }))
  },

  incrementQty(id) {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)),
    }))
  },

  decrementQty(id) {
    const item = get().items.find((i) => i.id === id)
    if (!item) return
    if (item.qty <= 1) {
      get().removeItem(id)
      return
    }
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)),
    }))
  },

  clearCart() {
    set({ items: [], notes: '', discount: 0 })
  },

  // ── Order metadata ─────────────────────────────────────────────────────────
  setTable(tableId) {
    set({ tableId })
  },

  setNotes(notes) {
    set({ notes })
  },

  setDiscount(discount) {
    set({ discount })
  },

  setPayMethod(method) {
    set({ payMethod: method })
  },

  // ── Computed ───────────────────────────────────────────────────────────────
  get subtotal() {
    return get().items.reduce((sum, i) => sum + i.price * i.qty, 0)
  },

  get taxAmount() {
    return get().subtotal * 0.08
  },

  get discountAmount() {
    return get().subtotal * get().discount
  },

  get total() {
    return get().subtotal + get().taxAmount - get().discountAmount
  },

  get itemCount() {
    return get().items.reduce((sum, i) => sum + i.qty, 0)
  },
}))
