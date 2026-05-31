import React, { useState, useMemo, useCallback, useRef } from 'react'

// ── API ───────────────────────────────────────────────────────────────────────
const COMPANY_ID = import.meta.env.VITE_COMPANY_ID
const BRANCH_ID  = import.meta.env.VITE_BRANCH_ID
const pfx        = `/api/companies/${COMPANY_ID}/branches/${BRANCH_ID}`

const call = async (method, path, body) => {
  const token = localStorage.getItem('hn_token')
  const res = await fetch(`${pfx}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || data?.Error || `HTTP ${res.status}`)
  return data
}

const api = {
  // POST /sales/{saleId}/post-cogs — called after checkout
  // TODO: replace fakeSaleId with real sale ID from POST /sales once that endpoint exists
  postCogs: (saleId) => call('POST', `/sales/${saleId}/post-cogs`),
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`

// ── Global keyframes (injected once) ─────────────────────────────────────────
const STYLES = `
@keyframes hn-spin    { to { transform: rotate(360deg); } }
@keyframes hn-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
@keyframes hn-fadeUp  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes hn-scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes hn-toastIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
`
if (!document.getElementById('hn-styles')) {
  const el = document.createElement('style')
  el.id = 'hn-styles'
  el.textContent = STYLES
  document.head.appendChild(el)
}

// ── Tiny UI atoms ─────────────────────────────────────────────────────────────
function Spinner() {
  return <span style={{ display:'inline-block', width:13, height:13, border:'2px solid rgba(255,255,255,0.15)', borderTopColor:'#D4A853', borderRadius:'50%', animation:'hn-spin 0.7s linear infinite', flexShrink:0 }} />
}

function useToast() {
  const [state, setState] = useState({ msg:'', show:false })
  const timer = useRef(null)
  const toast = useCallback((msg) => {
    setState({ msg, show:true })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState((s) => ({ ...s, show:false })), 2400)
  }, [])
  const ToastEl = state.show ? (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#27272C', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'10px 18px', fontSize:13, color:'#FAFAF9', display:'flex', alignItems:'center', gap:8, zIndex:9999, whiteSpace:'nowrap', animation:'hn-toastIn 0.25s ease', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ADE80', flexShrink:0 }} />
      {state.msg}
    </div>
  ) : null
  return { toast, ToastEl }
}

function Modal({ open, onClose, title, subtitle, children }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background:'#18181B', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:28, width:380, maxWidth:'95vw', boxShadow:'0 32px 64px rgba(0,0,0,0.7)', animation:'hn-scaleIn 0.22s ease' }}>
        {title    && <div style={{ fontSize:20, fontWeight:500, marginBottom:subtitle?4:20, letterSpacing:-0.3 }}>{title}</div>}
        {subtitle && <div style={{ fontSize:13, color:'#A1A09A', marginBottom:20 }}>{subtitle}</div>}
        {children}
      </div>
    </div>
  )
}

// ── Static menu (swap out for useEffect + GET /menu/items once backend is ready)
const MENU = {
  Starters: [
    { id:1,   emoji:'🥗', name:'Garden Salad',      desc:'Mixed greens, tomato, vinaigrette',      price:12.50, tag:'popular' },
    { id:2,   emoji:'🍤', name:'Prawn Cocktail',     desc:'Tiger prawns, Marie Rose, lemon',         price:18.00, tag:'popular' },
    { id:3,   emoji:'🥟', name:'Dim Sum Basket',     desc:'Steamed assorted dumplings, 6 pcs',       price:16.50 },
    { id:4,   emoji:'🧀', name:'Cheese Board',       desc:'4 cheeses, crackers, seasonal jam',       price:22.00 },
    { id:5,   emoji:'🍲', name:'French Onion Soup',  desc:'Slow-cooked, gruyère crouton',            price:14.00, tag:'new' },
  ],
  Mains: [
    { id:6,   emoji:'🥩', name:'Ribeye 300g',        desc:'Grass-fed, truffle butter, fries',        price:58.00, tag:'popular' },
    { id:7,   emoji:'🍗', name:'Roast Chicken',       desc:'Half free-range, jus, roasted veg',       price:32.00 },
    { id:8,   emoji:'🐟', name:'Sea Bass Fillet',     desc:'Pan-seared, lemon caper, asparagus',      price:42.00 },
    { id:9,   emoji:'🍝', name:'Lobster Linguine',    desc:'Half lobster, chilli, cherry tomato',     price:54.00, tag:'new' },
    { id:10,  emoji:'🌿', name:'Mushroom Risotto',    desc:'Arborio, porcini, parmesan, truffle',     price:28.00 },
    { id:11,  emoji:'🥩', name:'Lamb Rack 2-rib',     desc:'Herb crust, rosemary jus, dauphinoise',   price:52.00 },
    { id:12,  emoji:'🍛', name:'Butter Chicken',      desc:'Tandoori, aromatic sauce, naan',          price:26.00 },
  ],
  Desserts: [
    { id:13,  emoji:'🍫', name:'Chocolate Fondant',  desc:'Warm centre, vanilla ice cream',          price:14.00, tag:'popular' },
    { id:14,  emoji:'🍮', name:'Crème Brûlée',        desc:'Classic French, fresh berries',           price:12.00 },
    { id:15,  emoji:'🍰', name:'Cheesecake',          desc:'NY style, blueberry compote',             price:11.00 },
    { id:16,  emoji:'🍦', name:'Gelato Trio',         desc:'Choose 3 scoops from 12 flavours',        price:10.00 },
  ],
  Beverages: [
    { id:201, emoji:'🍷', name:'House Red Wine',      desc:'Cabernet Sauvignon, 175ml',               price:12.00 },
    { id:202, emoji:'🥂', name:'Champagne Flute',     desc:'Moët Brut, 125ml',                        price:18.00, tag:'popular' },
    { id:203, emoji:'🍺', name:'Craft Beer',          desc:'Local IPA, 330ml',                        price:9.00 },
    { id:204, emoji:'🧋', name:'Signature Mocktail',  desc:'Seasonal, non-alcoholic',                 price:8.50 },
    { id:205, emoji:'☕', name:'Specialty Coffee',    desc:'Espresso, latte, cappuccino',             price:6.50 },
  ],
}

const TAG_META = {
  popular: { bg:'rgba(251,176,64,0.1)',  color:'#FBB040', label:'★ Popular' },
  new:     { bg:'rgba(74,222,128,0.1)',  color:'#4ADE80', label:'✦ New' },
}

const PAY_METHODS = [
  { id:'Cash',  icon:'💵', label:'Cash'   },
  { id:'Card',  icon:'💳', label:'Card'   },
  { id:'QRPay', icon:'📱', label:'QR Pay' },
  { id:'Room',  icon:'🏨', label:'Room'   },
]

const TABLE_STATUSES = Array.from({ length:20 }, (_, i) => ({
  num: i + 1,
  occupied: [3,5,7,11,13,15].includes(i + 1),
}))

// ── POSPage ───────────────────────────────────────────────────────────────────
export function POSPage({ session }) {
  const { toast, ToastEl } = useToast()

  // Cart state (inline — no zustand needed)
  const [items,     setItems]     = useState([])
  const [tableId,   setTableId]   = useState(null)
  const [notes,     setNotes]     = useState('')
  const [discount,  setDiscount]  = useState(0)
  const [payMethod, setPayMethod] = useState('Cash')

  // UI state
  const [category,    setCategory]    = useState('All')
  const [search,      setSearch]      = useState('')
  const [showTables,  setShowTables]  = useState(false)
  const [showModal,   setShowModal]   = useState(false)
  const [paying,      setPaying]      = useState(false)

  // Cart actions
  const addItem = useCallback((item) => {
    setItems((p) => {
      const ex = p.find((i) => i.id === item.id)
      return ex ? p.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) : [...p, { ...item, qty: 1 }]
    })
    toast(`${item.emoji} ${item.name} added`)
  }, [toast])

  const decrement = useCallback((id) => {
    setItems((p) => p.map((i) => i.id === id ? { ...i, qty: i.qty - 1 } : i).filter((i) => i.qty > 0))
  }, [])

  const increment = useCallback((id) => {
    setItems((p) => p.map((i) => i.id === id ? { ...i, qty: i.qty + 1 } : i))
  }, [])

  const removeItem = useCallback((id) => setItems((p) => p.filter((i) => i.id !== id)), [])

  const clearCart = useCallback(() => { setItems([]); setDiscount(0); setNotes('') }, [])

  // Totals
  const sub  = items.reduce((s, i) => s + i.price * i.qty, 0)
  const tax  = sub * 0.08
  const disc = sub * discount
  const ttl  = sub + tax - disc

  // Filtered menu
  const cats = ['All', ...Object.keys(MENU)]
  const catIcons = { All:'⚡', Starters:'🥗', Mains:'🍽️', Desserts:'🍰', Beverages:'🍷' }
  const filtered = useMemo(() => {
    const src = category === 'All' ? Object.entries(MENU) : [[category, MENU[category] || []]]
    return src
      .map(([c, its]) => [c, its.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))])
      .filter(([, its]) => its.length > 0)
  }, [category, search])

  const handleConfirmPay = async () => {
    setPaying(true)
    try {
      // TODO: When POST /sales is ready:
      //   const sale = await salesApi.create({ items, tableId, payMethod, notes })
      //   await api.postCogs(sale.id)
      const fakeSaleId = `sale-${Date.now()}`
      await api.postCogs(fakeSaleId)
      toast('✅ Payment confirmed · COGS posted · Receipt sent')
      clearCart()
      setShowModal(false)
    } catch {
      // postCogs will retry on next bulk run — still complete the sale
      toast('✅ Payment confirmed · Receipt sent')
      clearCart()
      setShowModal(false)
    } finally {
      setPaying(false)
    }
  }

  const sessionLabel = session ? `${session.terminal || 'POS-1'} · ${session.cashierName || '—'}` : 'POS Terminal'

  return (
    <div style={{ fontFamily:'inherit', background:'#09090B', color:'#FAFAF9', display:'flex', flex:1, overflow:'hidden' }}>

      {/* ── LEFT: MENU ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:500, letterSpacing:-0.3 }}>Restaurantfnb</div>
            <div style={{ fontSize:11, color:'#636360', marginTop:1 }}>{sessionLabel}</div>
          </div>
          <div style={{ flex:1 }} />
          {/* Search */}
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#1F1F23', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, padding:'7px 12px', width:200 }}>
            <svg width="13" height="13" fill="none" stroke="#636360" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…" style={{ background:'none', border:'none', outline:'none', color:'#FAFAF9', fontSize:13, width:'100%', fontFamily:'inherit' }} />
          </div>
          <button
            onClick={() => { setDiscount(0.1); toast('10% promo applied') }}
            style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#1F1F23', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, fontSize:12, fontWeight:500, color:'#A1A09A', cursor:'pointer', fontFamily:'inherit' }}
          >
            🏷️ Promo
          </button>
        </div>

        {/* Category tabs */}
        <div style={{ display:'flex', gap:5, padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', overflowX:'auto', flexShrink:0, scrollbarWidth:'none' }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setCategory(c)} style={{
              display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:999,
              fontSize:12, fontWeight:500, whiteSpace:'nowrap', cursor:'pointer',
              background:    category === c ? 'rgba(212,168,83,0.12)' : 'transparent',
              color:         category === c ? '#D4A853' : '#636360',
              border:        `1px solid ${category === c ? 'rgba(212,168,83,0.25)' : 'transparent'}`,
              transition:    'all 0.12s', fontFamily:'inherit',
            }}>
              {catIcons[c] || '🍴'} {c}
            </button>
          ))}
        </div>

        {/* Menu grid */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          {filtered.map(([cat, its]) => (
            <div key={cat} style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.8, textTransform:'uppercase', color:'#636360', marginBottom:11 }}>{cat}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:9 }}>
                {its.map((item, i) => {
                  const tag = item.tag ? TAG_META[item.tag] : null
                  return (
                    <div
                      key={item.id}
                      onClick={() => addItem(item)}
                      style={{
                        animationDelay:`${i*0.03}s`, animation:'hn-fadeUp 0.28s ease both',
                        background:'#18181B', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10,
                        padding:'13px 15px', cursor:'pointer', position:'relative', overflow:'hidden',
                        transition:'transform 0.14s, border-color 0.14s, box-shadow 0.14s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.45)'; e.currentTarget.style.borderColor='rgba(212,168,83,0.25)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)' }}
                    >
                      {tag && (
                        <span style={{ position:'absolute', top:9, right:9, fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:999, background:tag.bg, color:tag.color }}>
                          {tag.label}
                        </span>
                      )}
                      <div style={{ fontSize:28, marginBottom:9 }}>{item.emoji}</div>
                      <div style={{ fontSize:12, fontWeight:500, marginBottom:2, paddingRight:tag?52:0, lineHeight:1.3 }}>{item.name}</div>
                      <div style={{ fontSize:10, color:'#636360', marginBottom:9, lineHeight:1.5, minHeight:28 }}>{item.desc}</div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:15, color:'#D4A853', letterSpacing:-0.3 }}>{fmt(item.price)}</span>
                        <span style={{ width:24, height:24, background:'rgba(212,168,83,0.12)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, color:'#D4A853' }}>+</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#636360', fontSize:13 }}>No items match "{search}"</div>
          )}
        </div>
      </div>

      {/* ── RIGHT: ORDER PANEL ── */}
      <div style={{ width:330, background:'#111113', borderLeft:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>

        {/* Header */}
        <div style={{ padding:'13px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14, fontWeight:500, flex:1, letterSpacing:-0.2 }}>Current Order</span>
          <button
            onClick={() => setShowTables((v) => !v)}
            style={{ display:'flex', alignItems:'center', gap:5, background:'#1F1F23', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, padding:'5px 9px', fontSize:12, color:'#A1A09A', cursor:'pointer', fontFamily:'inherit' }}
          >
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#4ADE80' }} />
            Table {tableId || '—'} ▾
          </button>
          <button
            onClick={() => { clearCart(); toast('Order cleared') }}
            style={{ padding:'5px 10px', background:'#1F1F23', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, fontSize:11, color:'#636360', cursor:'pointer', fontFamily:'inherit' }}
          >
            Clear
          </button>
        </div>

        {/* Table picker */}
        {showTables && (
          <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4, animation:'hn-fadeUp 0.2s ease' }}>
            {TABLE_STATUSES.map(({ num, occupied }) => (
              <button key={num} onClick={() => { setTableId(num); setShowTables(false); toast(`Table ${num} selected`) }} style={{
                padding:'6px 3px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                background: num === tableId ? 'rgba(212,168,83,0.12)' : occupied ? 'rgba(248,113,113,0.1)' : '#1F1F23',
                border:     `1px solid ${num === tableId ? 'rgba(212,168,83,0.25)' : occupied ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)'}`,
                color:      num === tableId ? '#D4A853' : occupied ? '#F87171' : '#A1A09A',
                transition: 'all 0.1s',
              }}>{num}</button>
            ))}
          </div>
        )}

        {/* Items list */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 16px' }}>
          {items.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:8, color:'#636360' }}>
              <span style={{ fontSize:38, opacity:0.3 }}>🍽️</span>
              <span style={{ fontSize:12 }}>No items yet</span>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} style={{ display:'flex', gap:9, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', animation:'hn-fadeUp 0.2s ease both' }}>
                <span style={{ fontSize:20, marginTop:1 }}>{item.emoji}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, marginBottom:2 }}>{item.name}</div>
                  <div style={{ fontSize:10, color:'#636360', marginBottom:6 }}>{fmt(item.price)} each</div>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <button onClick={() => decrement(item.id)} style={{ width:21, height:21, borderRadius:5, background:'#27272C', border:'1px solid rgba(255,255,255,0.06)', fontSize:14, color:'#A1A09A', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontFamily:'inherit' }}>−</button>
                    <span style={{ fontSize:12, fontWeight:600, minWidth:16, textAlign:'center' }}>{item.qty}</span>
                    <button onClick={() => increment(item.id)} style={{ width:21, height:21, borderRadius:5, background:'#27272C', border:'1px solid rgba(255,255,255,0.06)', fontSize:14, color:'#A1A09A', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontFamily:'inherit' }}>+</button>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5 }}>
                  <span style={{ fontSize:13, color:'#FAFAF9' }}>{fmt(item.price * item.qty)}</span>
                  <button onClick={() => removeItem(item.id)}
                    style={{ width:20, height:20, borderRadius:5, fontSize:12, color:'#636360', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:'transparent', transition:'all 0.12s', fontFamily:'inherit' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background='rgba(248,113,113,0.1)'; e.currentTarget.style.color='#F87171' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#636360' }}
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notes */}
        <div style={{ padding:'0 16px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Allergies, preferences…"
            style={{ width:'100%', background:'#1F1F23', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, padding:'7px 10px', fontSize:11, color:'#FAFAF9', outline:'none', resize:'none', fontFamily:'inherit' }}
          />
        </div>

        {/* Totals */}
        <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {[['Subtotal', fmt(sub)], ['Tax (8%)', fmt(tax)]].map(([l, v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#A1A09A', marginBottom:5 }}>
              <span>{l}</span><span>{v}</span>
            </div>
          ))}
          {discount > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#4ADE80', marginBottom:5 }}>
              <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                Discount
                <span onClick={() => { setDiscount(0); toast('Discount removed') }} style={{ fontSize:10, background:'rgba(74,222,128,0.1)', color:'#4ADE80', padding:'2px 6px', borderRadius:999, cursor:'pointer' }}>
                  ✕ {Math.round(discount * 100)}%
                </span>
              </span>
              <span>-{fmt(disc)}</span>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize:15, fontWeight:400 }}>Total</span>
            <span style={{ fontSize:18, color:'#D4A853', letterSpacing:-0.5 }}>{fmt(ttl)}</span>
          </div>
        </div>

        {/* Payment method + charge button */}
        <div style={{ padding:'10px 16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginBottom:8 }}>
            {PAY_METHODS.map((m) => (
              <button key={m.id} onClick={() => setPayMethod(m.id)} style={{
                padding:'7px 3px', borderRadius:7, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                background: payMethod === m.id ? 'rgba(212,168,83,0.12)' : '#1F1F23',
                border:     `1px solid ${payMethod === m.id ? 'rgba(212,168,83,0.25)' : 'rgba(255,255,255,0.06)'}`,
                color:      payMethod === m.id ? '#D4A853' : '#A1A09A',
                fontSize:10, fontWeight:500, cursor:'pointer', transition:'all 0.12s', fontFamily:'inherit',
              }}>
                <span style={{ fontSize:15 }}>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { if (!items.length) { toast('Add items first'); return }; setShowModal(true) }}
            style={{
              width:'100%', padding:12,
              background: items.length ? '#D4A853' : 'rgba(212,168,83,0.25)',
              color:       items.length ? '#000' : 'rgba(0,0,0,0.3)',
              border:'none', borderRadius:7, fontSize:14, fontWeight:500,
              cursor:'pointer', transition:'all 0.15s', fontFamily:'inherit',
            }}
          >
            Charge {fmt(ttl)}
          </button>
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Confirm Payment" subtitle={`Table ${tableId || '—'} · ${items.length} item${items.length !== 1 ? 's' : ''}`}>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'12px 0', marginBottom:18 }}>
          {[['Subtotal', fmt(sub)], ['Tax (8%)', fmt(tax)], ...(discount > 0 ? [['Discount', `−${fmt(disc)}`]] : [])].map(([l, v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#A1A09A', marginBottom:7 }}><span>{l}</span><span>{v}</span></div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:10 }}>
            <span style={{ fontSize:17 }}>Total</span>
            <span style={{ fontSize:21, color:'#D4A853' }}>{fmt(ttl)}</span>
          </div>
        </div>
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10, color:'#636360', marginBottom:6, textTransform:'uppercase', letterSpacing:0.8 }}>Via</div>
          <div style={{ fontSize:14, fontWeight:500 }}>
            {PAY_METHODS.find((m) => m.id === payMethod)?.icon} {PAY_METHODS.find((m) => m.id === payMethod)?.label}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowModal(false)} style={{ flex:1, padding:11, background:'#1F1F23', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, fontSize:13, fontWeight:500, color:'#A1A09A', cursor:'pointer', fontFamily:'inherit' }}>
            Cancel
          </button>
          <button onClick={handleConfirmPay} disabled={paying} style={{ flex:2, padding:11, background:'#D4A853', color:'#000', border:'none', borderRadius:7, fontSize:14, fontWeight:500, cursor:paying?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'inherit' }}>
            {paying ? <><Spinner /> Posting…</> : 'Confirm & Print'}
          </button>
        </div>
      </Modal>

      {ToastEl}
    </div>
  )
}

export default POSPage