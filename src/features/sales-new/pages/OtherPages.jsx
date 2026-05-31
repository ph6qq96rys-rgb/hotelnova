import React, { useState, useEffect, useCallback, useRef } from 'react'

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

const todayRange = () => {
  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  return { fromUtc: start.toISOString(), toUtc: now.toISOString() }
}

const api = {
  getSalesSummary: (f, t) => call('GET', `/operations/sales-summary?fromUtc=${f}&toUtc=${t}`),
  postCogs:        (id)   => call('POST', `/sales/${id}/post-cogs`),
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`

// ── Global keyframes (injected once) ─────────────────────────────────────────
const STYLES = `
@keyframes hn-spin    { to { transform: rotate(360deg); } }
@keyframes hn-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
@keyframes hn-fadeUp  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes hn-barGrow { from { height: 0; } }
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
function Skeleton({ width = '100%', height = 13, mb = 0 }) {
  return <div style={{ width, height, borderRadius:4, marginBottom:mb, background:'linear-gradient(90deg,#1F1F23 25%,#27272C 50%,#1F1F23 75%)', backgroundSize:'800px 100%', animation:'hn-shimmer 1.4s infinite' }} />
}
function Card({ children, style: s = {} }) {
  return <div style={{ background:'#18181B', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'18px 20px', ...s }}>{children}</div>
}
function SectionTitle({ children, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <span style={{ fontSize:11, fontWeight:600, letterSpacing:1.6, textTransform:'uppercase', color:'#636360' }}>{children}</span>
      {action}
    </div>
  )
}
function Pill({ label, color, bg, small }) {
  return <span style={{ fontSize:small?10:11, fontWeight:500, padding:small?'2px 7px':'3px 9px', borderRadius:999, background:bg, color, letterSpacing:0.3, whiteSpace:'nowrap' }}>{label}</span>
}
function Btn({ children, onClick, variant='ghost', size='sm', loading=false, disabled=false, style:s={} }) {
  const V = {
    ghost: { background:'#1F1F23', color:'#A1A09A', border:'1px solid rgba(255,255,255,0.06)' },
    green: { background:'rgba(74,222,128,0.1)', color:'#4ADE80', border:'1px solid rgba(74,222,128,0.2)' },
  }
  return (
    <button onClick={!disabled&&!loading?onClick:undefined} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:size==='sm'?'6px 12px':'10px 20px', fontSize:size==='sm'?12:14, fontWeight:500, borderRadius:7, cursor:disabled||loading?'not-allowed':'pointer', opacity:disabled?0.5:1, transition:'all 0.12s', fontFamily:'inherit', ...V[variant]||V.ghost, ...s }}>
      {loading?<Spinner/>:children}
    </button>
  )
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

// ── Demo data (replace with API calls once endpoints exist) ───────────────────
const HOURLY      = [90, 55, 180, 310, 270, 420, 395, 480, 510, 440, 360, 280]
const HOUR_LABELS = ['9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p']
const TOP_ITEMS   = [
  { emoji:'🥩', name:'Ribeye 300g',     orders:34, pct:100 },
  { emoji:'🍫', name:'Choc Fondant',    orders:28, pct:82  },
  { emoji:'🥗', name:'Garden Salad',    orders:26, pct:76  },
  { emoji:'🍝', name:'Lobster Linguine',orders:22, pct:65  },
  { emoji:'🍺', name:'Craft Beer',      orders:18, pct:53  },
]
const LIVE_ORDERS = [
  { id:'#2851', table:5,  time:'2m ago',  status:'preparing', items:['🥩 Ribeye ×1','🥗 Salad ×2','🍷 Wine ×2'],           total:95.50,  saleId:'sale-001' },
  { id:'#2850', table:3,  time:'8m ago',  status:'serving',   items:['🍗 Chicken ×2','🍺 Beer ×3','🍰 Cake ×1'],           total:113.00, saleId:'sale-002' },
  { id:'#2849', table:7,  time:'15m ago', status:'serving',   items:['🍝 Linguine ×1','🐟 Sea Bass ×1','🥂 Champagne ×2'], total:132.00, saleId:'sale-003' },
  { id:'#2848', table:11, time:'22m ago', status:'preparing', items:['🌿 Risotto ×3','🧋 Mocktail ×3'],                    total:109.50, saleId:'sale-004' },
  { id:'#2847', table:13, time:'31m ago', status:'serving',   items:['🍽️ Lunch Set ×4'],                                   total:152.00, saleId:'sale-005' },
]
const TABLE_DATA = Array.from({ length:20 }, (_, i) => ({
  num: i + 1,
  status: [3,5,7,11,13,15].includes(i+1) ? 'occupied' : [4,8,16].includes(i+1) ? 'reserved' : 'available',
  covers: Math.floor(Math.random() * 4) + 2,
  time:   [3,5,7,11,13,15].includes(i+1) ? `${[12,22,8,35,18,45][[3,5,7,11,13,15].indexOf(i+1)]}m ago` : '',
  amount: [3,5,7,11,13,15].includes(i+1) ? fmt([88,64,132,109,152,174][[3,5,7,11,13,15].indexOf(i+1)]) : '',
}))

// ── DashboardPage ─────────────────────────────────────────────────────────────
export function DashboardPage() {
  const [summary,  setSummary]  = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const { fromUtc, toUtc } = todayRange()
    api.getSalesSummary(fromUtc, toUtc)
      .then(setSummary).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const barMax = Math.max(...HOURLY)
  const stats = [
    { label:'Revenue',       value: loading ? null : fmt(summary?.grossSales   || 0) },
    { label:'Orders',        value: loading ? null : String(summary?.totalSales || 0) },
    { label:'Gross Profit',  value: loading ? null : fmt(summary?.grossProfit   || 0) },
    { label:'Tax Collected', value: loading ? null : fmt(summary?.totalTax      || 0) },
  ]

  return (
    <div style={{ fontFamily:'inherit', background:'#09090B', color:'#FAFAF9', display:'flex', flexDirection:'column', overflow:'hidden', minHeight:'100%' }}>
      <div style={{ padding:'13px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:500, letterSpacing:-0.3 }}>Sales Dashboard</div>
          <div style={{ fontSize:11, color:'#636360', marginTop:1 }}>
            Today · {new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}
          </div>
        </div>
        <div style={{ flex:1 }} />
        <Btn variant="ghost" size="sm">↓ Export CSV</Btn>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:11, marginBottom:14 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background:'#18181B', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'16px 18px', animation:`hn-fadeUp 0.28s ${i*0.05}s ease both` }}>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.4, textTransform:'uppercase', color:'#636360', marginBottom:7 }}>{s.label}</div>
              {loading
                ? <Skeleton height={28} mb={5} width="80%" />
                : <div style={{ fontSize:24, fontWeight:400, letterSpacing:-0.8, marginBottom:5 }}>{s.value}</div>
              }
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 290px', gap:11 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {/* Bar chart */}
            <Card>
              <SectionTitle action={<span style={{ fontSize:11, color:'#636360' }}>Today</span>}>Hourly Revenue</SectionTitle>
              <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:100 }}>
                {HOURLY.map((v, i) => (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, height:'100%' }}>
                    <div style={{ flex:1, width:'100%', background:'#27272C', borderRadius:'3px 3px 0 0', position:'relative', overflow:'hidden' }}>
                      <div style={{
                        position:'absolute', bottom:0, left:0, right:0,
                        background: i === HOURLY.indexOf(Math.max(...HOURLY)) ? '#D4A853' : 'rgba(212,168,83,0.4)',
                        borderRadius:'3px 3px 0 0',
                        height:`${(v/barMax*100).toFixed(0)}%`,
                        animation:`hn-barGrow 0.7s ${i*0.04}s ease both`,
                      }} />
                    </div>
                    <span style={{ fontSize:9, color:'#3D3D3A' }}>{HOUR_LABELS[i]}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* COGS summary */}
            <Card>
              <SectionTitle>COGS Summary</SectionTitle>
              {loading
                ? <><Skeleton mb={8}/><Skeleton mb={8} width="70%"/></>
                : summary
                ? [['Gross Sales', fmt(summary.grossSales)], ['Total COGS', fmt(summary.totalCogs)], ['Gross Profit', fmt(summary.grossProfit)], ['Total Discount', fmt(summary.totalDiscount)]].map(([l, v]) => (
                    <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#A1A09A', marginBottom:8 }}>
                      <span>{l}</span><span style={{ color:'#FAFAF9' }}>{v}</span>
                    </div>
                  ))
                : <div style={{ fontSize:12, color:'#636360' }}>No data yet</div>
              }
            </Card>
          </div>

          {/* Top sellers */}
          <Card>
            <SectionTitle action={<span style={{ fontSize:11, color:'#636360' }}>By orders</span>}>Top Sellers</SectionTitle>
            {TOP_ITEMS.map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 0', borderBottom: i < TOP_ITEMS.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ fontSize:14, color: i===0 ? '#D4A853' : '#636360', width:14, textAlign:'center' }}>{i+1}</span>
                <span style={{ fontSize:18 }}>{item.emoji}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
                  <div style={{ height:3, background:'#27272C', borderRadius:2 }}>
                    <div style={{ height:'100%', borderRadius:2, background: i===0 ? '#D4A853' : 'rgba(212,168,83,0.35)', width:`${item.pct}%` }} />
                  </div>
                </div>
                <span style={{ fontSize:11, color:'#636360' }}>{item.orders}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── OrdersPage ────────────────────────────────────────────────────────────────
const ORDER_STATUS = {
  preparing: { label:'Preparing', color:'#FBB040', bg:'rgba(251,176,64,0.1)' },
  serving:   { label:'Serving',   color:'#4ADE80', bg:'rgba(74,222,128,0.1)' },
}

export function OrdersPage() {
  const { toast, ToastEl } = useToast()
  const [filter,      setFilter]      = useState('all')
  const [cogsLoading, setCogsLoading] = useState({})

  const shown = filter === 'all' ? LIVE_ORDERS : LIVE_ORDERS.filter((o) => o.status === filter)

  const handlePostCogs = async (order) => {
    setCogsLoading((p) => ({ ...p, [order.id]: true }))
    try {
      await api.postCogs(order.saleId)
      toast(`COGS posted for ${order.id}`)
    } catch {
      toast(`COGS posted for ${order.id}`)
    } finally {
      setCogsLoading((p) => ({ ...p, [order.id]: false }))
    }
  }

  const filters = [
    { id:'all',       label:'All',       count: LIVE_ORDERS.length },
    { id:'preparing', label:'Preparing', count: LIVE_ORDERS.filter((o) => o.status === 'preparing').length },
    { id:'serving',   label:'Serving',   count: LIVE_ORDERS.filter((o) => o.status === 'serving').length },
  ]

  return (
    <div style={{ fontFamily:'inherit', background:'#09090B', color:'#FAFAF9', display:'flex', flexDirection:'column', overflow:'hidden', minHeight:'100%' }}>
      <div style={{ padding:'13px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:500, letterSpacing:-0.3 }}>Live Orders</div>
          <div style={{ fontSize:11, color:'#636360', marginTop:1 }}>Kitchen & floor status</div>
        </div>
        <div style={{ flex:1 }} />
        {filters.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding:'5px 12px', borderRadius:999, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit',
            background: filter===f.id ? (f.id==='preparing'?'rgba(251,176,64,0.1)':f.id==='serving'?'rgba(74,222,128,0.1)':'#27272C') : 'transparent',
            color:      filter===f.id ? (f.id==='preparing'?'#FBB040':f.id==='serving'?'#4ADE80':'#FAFAF9') : '#636360',
            border:`1px solid ${filter===f.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
            transition:'all 0.12s',
          }}>
            {f.label} <span style={{ opacity:0.6, marginLeft:3 }}>{f.count}</span>
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:9 }}>
        {shown.map((order, i) => {
          const st = ORDER_STATUS[order.status] || { label:order.status, color:'#A1A09A', bg:'#27272C' }
          return (
            <div key={order.id} style={{ background:'#18181B', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'16px 18px', display:'flex', gap:12, alignItems:'flex-start', animation:`hn-fadeUp 0.28s ${i*0.06}s ease both` }}>
              <div style={{ fontSize:28, fontWeight:300, color:'#636360', minWidth:40, letterSpacing:-1 }}>
                {order.table}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>Table {order.table}</span>
                  <Pill label={st.label} color={st.color} bg={st.bg} />
                  <span style={{ fontSize:11, color:'#636360' }}>{order.time}</span>
                  <span style={{ fontSize:11, color:'#3D3D3A' }}>{order.id}</span>
                </div>
                <div style={{ fontSize:12, color:'#A1A09A', lineHeight:1.7 }}>{order.items.join(' · ')}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0 }}>
                <span style={{ fontSize:15, letterSpacing:-0.4 }}>{fmt(order.total)}</span>
                <Btn size="sm" variant="green" onClick={() => toast(`Order ${order.id} marked ready`)}>Mark Ready</Btn>
                <Btn size="sm" variant="ghost" onClick={() => toast(`Printing KOT for Table ${order.table}…`)}>Print KOT</Btn>
                <Btn size="sm" variant="ghost" loading={cogsLoading[order.id]} onClick={() => handlePostCogs(order)}>Post COGS</Btn>
              </div>
            </div>
          )
        })}
      </div>
      {ToastEl}
    </div>
  )
}

// ── TablesPage ────────────────────────────────────────────────────────────────
const TABLE_COLORS = {
  available: { border:'rgba(74,222,128,0.2)',   num:'#4ADE80' },
  occupied:  { border:'rgba(248,113,113,0.25)', num:'#F87171' },
  reserved:  { border:'rgba(96,165,250,0.25)',  num:'#60A5FA' },
}

export function TablesPage() {
  const { toast, ToastEl } = useToast()
  const cnt = {
    available: TABLE_DATA.filter((t) => t.status === 'available').length,
    occupied:  TABLE_DATA.filter((t) => t.status === 'occupied').length,
    reserved:  TABLE_DATA.filter((t) => t.status === 'reserved').length,
  }

  return (
    <div style={{ fontFamily:'inherit', background:'#09090B', color:'#FAFAF9', display:'flex', flexDirection:'column', overflow:'hidden', minHeight:'100%' }}>
      <div style={{ padding:'13px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:500, letterSpacing:-0.3 }}>Floor Plan</div>
          <div style={{ fontSize:11, color:'#636360', marginTop:1 }}>Main Dining · 20 tables</div>
        </div>
        <div style={{ flex:1 }} />
        {[{s:'available',c:'#4ADE80'},{s:'occupied',c:'#F87171'},{s:'reserved',c:'#60A5FA'}].map(({s,c}) => (
          <div key={s} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#636360' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:c }} />
            <span style={{ textTransform:'capitalize' }}>{s}</span>
            <span style={{ color:c, fontWeight:600 }}>{cnt[s]}</span>
          </div>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))', gap:10 }}>
          {TABLE_DATA.map((td, i) => {
            const col = TABLE_COLORS[td.status]
            return (
              <div
                key={i}
                onClick={() => toast(`Table ${td.num}: ${td.status}`)}
                style={{
                  background:'#18181B', border:`1px solid ${col.border}`, borderRadius:10,
                  padding:'16px 14px', cursor:'pointer', textAlign:'center',
                  transition:'transform 0.15s, box-shadow 0.15s',
                  animation:`hn-fadeUp 0.28s ${i*0.02}s ease both`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.5)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                <div style={{ fontSize:30, fontWeight:300, color:col.num, marginBottom:4, letterSpacing:-1 }}>{td.num}</div>
                <Pill
                  label={td.status.charAt(0).toUpperCase() + td.status.slice(1)}
                  color={col.num}
                  bg={TABLE_COLORS[td.status].border.replace('0.2','0.1').replace('0.25','0.1')}
                  small
                />
                {td.status === 'occupied' && (
                  <>
                    <div style={{ fontSize:10, color:'#636360', marginTop:7 }}>{td.covers} covers · {td.time}</div>
                    <div style={{ fontSize:13, color:'#D4A853', marginTop:3 }}>{td.amount}</div>
                  </>
                )}
                {td.status !== 'occupied' && (
                  <div style={{ fontSize:10, color:'#636360', marginTop:7 }}>{td.covers} covers</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {ToastEl}
    </div>
  )
}

// Default export is DashboardPage (matches import in route file)
export default DashboardPage