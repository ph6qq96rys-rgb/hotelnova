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
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return { fromUtc: start.toISOString(), toUtc: now.toISOString() }
}

const api = {
  // Station types
  getStationTypes:   ()         => call('GET',  '/operations/station-types'),
  createStationType: (dto)      => call('POST', '/operations/station-types', dto),
  // Cashier shifts
  getOpenShift:      ()         => call('GET',  '/operations/cashier-shifts/open'),
  listShifts:        ()         => call('GET',  '/operations/cashier-shifts'),
  closeShift:        (id, dto)  => call('POST', `/operations/cashier-shifts/${id}/close`, dto),
  // Safe drops
  listSafeDrops:     (shiftId)  => {
    const q = shiftId ? `?shiftId=${shiftId}` : ''
    return call('GET', `/operations/safe-drops${q}`)
  },
  createSafeDrop:    (dto)      => call('POST', '/operations/safe-drops', dto),
  // Reports
  getSalesSummary:   (f, t)     => call('GET',  `/operations/sales-summary?fromUtc=${f}&toUtc=${t}`),
  generateEndOfDay:  (dto)      => call('POST', '/operations/end-of-day', dto),
  // COGS
  postCogsBulk:      (f, t)     => {
    const q = new URLSearchParams()
    if (f) q.set('fromDate', f)
    if (t) q.set('toDate', t)
    return call('POST', `/sales/post-cogs/bulk?${q}`)
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt   = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtDT = (iso) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtT  = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'

// ── Global keyframes (injected once) ─────────────────────────────────────────
const STYLES = `
@keyframes hn-spin    { to { transform: rotate(360deg); } }
@keyframes hn-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
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
function FieldRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize:12, color:'#636360' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:500, color:'#FAFAF9' }}>{value}</span>
    </div>
  )
}
function Btn({ children, onClick, variant='ghost', size='sm', loading=false, disabled=false, style:s={} }) {
  const V = {
    ghost:  { background:'#1F1F23', color:'#A1A09A', border:'1px solid rgba(255,255,255,0.06)' },
    gold:   { background:'#D4A853', color:'#000',    border:'none' },
    danger: { background:'rgba(248,113,113,0.1)', color:'#F87171', border:'1px solid rgba(248,113,113,0.2)' },
    green:  { background:'rgba(74,222,128,0.1)',  color:'#4ADE80', border:'1px solid rgba(74,222,128,0.2)' },
  }
  return (
    <button onClick={!disabled&&!loading?onClick:undefined} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:size==='sm'?'6px 12px':'10px 20px', fontSize:size==='sm'?12:14, fontWeight:500, borderRadius:7, cursor:disabled||loading?'not-allowed':'pointer', opacity:disabled?0.5:1, transition:'all 0.12s', fontFamily:'inherit', ...V[variant], ...s }}>
      {loading?<Spinner/>:children}
    </button>
  )
}
function Pill({ label, color, bg }) {
  return <span style={{ fontSize:11, fontWeight:500, padding:'3px 9px', borderRadius:999, background:bg, color, letterSpacing:0.3, whiteSpace:'nowrap' }}>{label}</span>
}
function Input({ label, style: s = {}, ...props }) {
  const iStyle = { width:'100%', background:'#1F1F23', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, padding:'9px 12px', color:'#FAFAF9', fontSize:13, outline:'none', marginBottom:14, fontFamily:'inherit', ...s }
  if (!label) return <input style={iStyle} {...props} />
  return (
    <div>
      <label style={{ fontSize:11, color:'#636360', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:0.8 }}>{label}</label>
      <input style={iStyle} {...props} />
    </div>
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

// ── Tab components ─────────────────────────────────────────────────────────────

function ShiftTab({ toast }) {
  const [shift,   setShift]   = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    Promise.all([
      api.getOpenShift().catch(() => null),
      api.listShifts().catch(() => []),
    ]).then(([sh, hist]) => {
      setShift(sh)
      setHistory(Array.isArray(hist) ? hist : [])
    }).finally(() => setLoading(false))
  }, [])

  const handleClose = async () => {
    if (!shift?.id) return
    setClosing(true)
    try {
      await api.closeShift(shift.id, { closingCash: 0 })
      setShift(null)
      toast('Shift closed')
    } catch (err) {
      toast(err.message || 'Failed to close shift')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
      <Card>
        <SectionTitle>Open Shift</SectionTitle>
        {loading ? <><Skeleton mb={8}/><Skeleton mb={8} width="60%"/></> :
         shift ? <>
          <FieldRow label="Cashier"      value={shift.cashierName || '—'} />
          <FieldRow label="Opened"       value={fmtDT(shift.openedAtUtc)} />
          <FieldRow label="Opening Cash" value={fmt(shift.openingCash || 0)} />
          <FieldRow label="Status"       value={<Pill label="Open" color="#4ADE80" bg="rgba(74,222,128,0.1)" />} />
          <div style={{ marginTop:12 }}>
            <Btn variant="danger" size="sm" loading={closing} onClick={handleClose}>Close Shift</Btn>
          </div>
         </> :
         <div style={{ fontSize:13, color:'#636360', textAlign:'center', padding:24 }}>No open shift</div>
        }
      </Card>
      <Card>
        <SectionTitle>Shift History</SectionTitle>
        {history.length === 0 && !loading
          ? <div style={{ fontSize:12, color:'#636360', textAlign:'center', padding:20 }}>No past shifts</div>
          : history.slice(0, 8).map((s, i) => (
              <div key={i} style={{ padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:500 }}>{s.cashierName || '—'}</div>
                  <div style={{ fontSize:11, color:'#636360' }}>{fmtT(s.openedAtUtc)}</div>
                </div>
                <Pill label={s.closedAt ? 'Closed' : 'Open'} color={s.closedAt ? '#636360' : '#4ADE80'} bg={s.closedAt ? '#27272C' : 'rgba(74,222,128,0.1)'} />
              </div>
            ))
        }
      </Card>
    </div>
  )
}

function SafeDropsTab({ toast }) {
  const [shift,  setShift]  = useState(null)
  const [drops,  setDrops]  = useState([])
  const [amount, setAmount] = useState('')
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getOpenShift().catch(() => null).then((sh) => {
      setShift(sh)
      return api.listSafeDrops(sh?.id).catch(() => [])
    }).then((d) => setDrops(Array.isArray(d) ? d : []))
  }, [])

  const handleCreate = async () => {
    if (!amount) { toast('Enter an amount'); return }
    setSaving(true)
    try {
      const r = await api.createSafeDrop({ amount: parseFloat(amount), notes: note, shiftId: shift?.id })
      setDrops((p) => [r, ...p])
      toast(`Safe drop ${fmt(amount)} recorded`)
      setAmount(''); setNote('')
    } catch (err) {
      toast(err.message || 'Failed to record drop')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
      <Card>
        <SectionTitle>New Safe Drop</SectionTitle>
        <Input label="Amount ($)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        <Input label="Notes"      value={note}   onChange={(e) => setNote(e.target.value)}   placeholder="Optional note" />
        <Btn variant="gold" loading={saving} onClick={handleCreate} style={{ width:'100%', padding:10 }}>Record Drop</Btn>
      </Card>
      <Card>
        <SectionTitle>Recent Safe Drops</SectionTitle>
        {drops.length === 0
          ? <div style={{ fontSize:12, color:'#636360', textAlign:'center', padding:20 }}>No drops recorded</div>
          : drops.slice(0, 8).map((d, i) => (
              <div key={i} style={{ padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:14, color:'#D4A853' }}>{fmt(d.amount)}</div>
                  <div style={{ fontSize:11, color:'#636360' }}>{d.notes || 'No note'} · {fmtT(d.createdAt)}</div>
                </div>
              </div>
            ))
        }
      </Card>
    </div>
  )
}

function CogsTab({ toast }) {
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)

  const handleBulk = async () => {
    setLoading(true)
    try {
      const { fromUtc, toUtc } = todayRange()
      const r = await api.postCogsBulk(fromUtc, toUtc)
      setResult(r)
      toast(`COGS posted: ${r.posted} sales`)
    } catch (err) {
      toast(err.message || 'Bulk COGS failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ maxWidth:520 }}>
      <SectionTitle>COGS Management</SectionTitle>
      <p style={{ fontSize:13, color:'#A1A09A', marginBottom:20, lineHeight:1.7 }}>
        Post cost-of-goods-sold for all unposted completed sales. Uses FIFO lot consumption per recipe line. Idempotent — safe to re-run.
      </p>
      <Btn variant="gold" loading={loading} onClick={handleBulk} style={{ marginBottom:20 }}>
        Post Bulk COGS for Today
      </Btn>
      {result && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:14 }}>
          <div style={{ fontSize:10, color:'#636360', marginBottom:10, textTransform:'uppercase', letterSpacing:1 }}>Result</div>
          {[['Posted', result.posted, '#4ADE80'], ['Skipped', result.skipped, '#FBB040'], ['Failed', result.failed, '#F87171']].map(([l, v, c]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize:12, color:'#A1A09A' }}>{l}</span>
              <span style={{ fontSize:15, color:c }}>{v}</span>
            </div>
          ))}
          {(result.errors || []).length > 0 && (
            <div style={{ marginTop:10 }}>
              {result.errors.map((e, i) => <div key={i} style={{ fontSize:11, color:'#636360', padding:'3px 0' }}>{e}</div>)}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function EodTab({ toast }) {
  const [loading,  setLoading]  = useState(false)
  const [summary,  setSummary]  = useState(null)
  const [loadingS, setLoadingS] = useState(true)

  useEffect(() => {
    const { fromUtc, toUtc } = todayRange()
    api.getSalesSummary(fromUtc, toUtc)
      .then(setSummary).catch(() => {})
      .finally(() => setLoadingS(false))
  }, [])

  const handleGenerate = async () => {
    setLoading(true)
    try {
      await api.generateEndOfDay({ reportDate: new Date().toISOString().slice(0, 10) })
      toast('End-of-day report generated')
    } catch (err) {
      toast(err.message || 'Failed to generate EOD report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ maxWidth:520 }}>
      <SectionTitle>End-of-Day Report</SectionTitle>
      <p style={{ fontSize:13, color:'#A1A09A', marginBottom:20, lineHeight:1.7 }}>
        Consolidates all sales, payments, COGS, and safe drops for today into a single report record.
      </p>
      <div style={{ background:'#1F1F23', border:'1px solid rgba(255,255,255,0.06)', borderRadius:7, padding:'14px 16px', marginBottom:20 }}>
        {loadingS ? <><Skeleton mb={8}/><Skeleton width="70%"/></> :
         summary
          ? [['Gross Sales', fmt(summary.grossSales)], ['Gross Profit', fmt(summary.grossProfit)], ['Total Tax', fmt(summary.totalTax)], ['Orders', String(summary.totalSales)]].map(([l, v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:7 }}>
                <span style={{ color:'#636360' }}>{l}</span><span>{v}</span>
              </div>
            ))
          : <div style={{ fontSize:12, color:'#636360' }}>No data yet</div>
        }
      </div>
      <Btn variant="gold" loading={loading} onClick={handleGenerate}>Generate End-of-Day Report</Btn>
    </Card>
  )
}

function StationsTab({ toast }) {
  const [stations, setStations] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [name,     setName]     = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    api.getStationTypes().then((d) => setStations(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const r = await api.createStationType({ name })
      setStations((p) => [...p, r])
      setName('')
      toast(`Station "${name}" created`)
    } catch (err) {
      toast(err.message || 'Failed to create station')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
      <Card>
        <SectionTitle>Add Station Type</SectionTitle>
        <Input label="Station Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bar, Grill, Pastry" />
        <Btn variant="gold" loading={saving} onClick={handleCreate} style={{ width:'100%', padding:10 }}>Create Station</Btn>
      </Card>
      <Card>
        <SectionTitle>Station Types</SectionTitle>
        {loading ? <Skeleton /> :
         stations.length === 0
          ? <div style={{ fontSize:12, color:'#636360', textAlign:'center', padding:20 }}>No stations configured</div>
          : stations.map((s, i) => (
              <div key={i} style={{ padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#D4A853', flexShrink:0 }} />
                <span style={{ fontSize:13, fontWeight:500 }}>{s.name || s}</span>
              </div>
            ))
        }
      </Card>
    </div>
  )
}

// ── OperationsPage ────────────────────────────────────────────────────────────
const TABS = [
  { id:'shift',    label:'Cashier Shift' },
  { id:'drops',    label:'Safe Drops' },
  { id:'cogs',     label:'COGS' },
  { id:'eod',      label:'End of Day' },
  { id:'stations', label:'Stations' },
]

export function OperationsPage() {
  const { toast, ToastEl } = useToast()
  const [tab, setTab] = useState('shift')

  return (
    <div style={{ fontFamily:'inherit', background:'#09090B', color:'#FAFAF9', display:'flex', flexDirection:'column', overflow:'hidden', minHeight:'100%' }}>
      <div style={{ padding:'13px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <div style={{ fontSize:17, fontWeight:500, letterSpacing:-0.3, marginBottom:10 }}>Operations</div>
        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'5px 12px', borderRadius:999, fontSize:12, fontWeight:500, cursor:'pointer', background:tab===t.id?'rgba(212,168,83,0.12)':'transparent', color:tab===t.id?'#D4A853':'#636360', border:`1px solid ${tab===t.id?'rgba(212,168,83,0.25)':'transparent'}`, transition:'all 0.12s', fontFamily:'inherit' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {tab === 'shift'    && <ShiftTab    toast={toast} />}
        {tab === 'drops'    && <SafeDropsTab toast={toast} />}
        {tab === 'cogs'     && <CogsTab     toast={toast} />}
        {tab === 'eod'      && <EodTab      toast={toast} />}
        {tab === 'stations' && <StationsTab toast={toast} />}
      </div>
      {ToastEl}
    </div>
  )
}

export default OperationsPage