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

const api = {
  getSession:   ()           => call('GET',  '/pos-sessions/current'),
  xReport:      (id)         => call('GET',  `/pos-sessions/${id}/x-report`),
  zReport:      (id)         => call('POST', `/pos-sessions/${id}/z-report`),
  closeSession: (id, body)   => call('POST', `/pos-sessions/${id}/close`, body),
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtDT = (iso) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Tiny UI atoms ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 13, height: 13,
      border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#D4A853',
      borderRadius: '50%', animation: 'hn-spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

function Pill({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '3px 9px',
      borderRadius: 999, background: bg, color, letterSpacing: 0.3, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function FieldRow({ label, value, accent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontSize: 12, color: '#636360' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: accent ? '#D4A853' : '#FAFAF9' }}>{value}</span>
    </div>
  )
}

function Btn({ children, onClick, variant = 'ghost', size = 'sm', loading = false, disabled = false, style: s = {} }) {
  const variants = {
    ghost:  { background: '#1F1F23', color: '#A1A09A', border: '1px solid rgba(255,255,255,0.06)' },
    gold:   { background: '#D4A853', color: '#000',    border: 'none' },
    danger: { background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' },
  }
  return (
    <button
      onClick={!disabled && !loading ? onClick : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: size === 'sm' ? '6px 12px' : '10px 20px',
        fontSize: size === 'sm' ? 12 : 14, fontWeight: 500,
        borderRadius: 7, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.12s',
        fontFamily: 'inherit',
        ...variants[variant],
        ...s,
      }}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

function Card({ children, style: s = {} }) {
  return (
    <div style={{
      background: '#18181B', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: '18px 20px', ...s,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: '#636360' }}>
        {children}
      </span>
      {action}
    </div>
  )
}

function Skeleton({ width = '100%', height = 13, mb = 0 }) {
  return (
    <div style={{
      width, height, borderRadius: 4, marginBottom: mb,
      background: 'linear-gradient(90deg,#1F1F23 25%,#27272C 50%,#1F1F23 75%)',
      backgroundSize: '800px 100%', animation: 'hn-shimmer 1.4s infinite',
    }} />
  )
}

function Modal({ open, onClose, title, subtitle, children }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#18181B', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 28, width: 380, maxWidth: '95vw',
        boxShadow: '0 32px 64px rgba(0,0,0,0.7)', animation: 'hn-scaleIn 0.22s ease',
      }}>
        {title && <div style={{ fontSize: 20, fontWeight: 500, marginBottom: subtitle ? 4 : 20, letterSpacing: -0.3 }}>{title}</div>}
        {subtitle && <div style={{ fontSize: 13, color: '#A1A09A', marginBottom: 20 }}>{subtitle}</div>}
        {children}
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [state, setState] = useState({ msg: '', show: false })
  const timer = useRef(null)
  const toast = useCallback((msg) => {
    setState({ msg, show: true })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState((s) => ({ ...s, show: false })), 2400)
  }, [])
  const ToastEl = state.show ? (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#27272C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
      padding: '10px 18px', fontSize: 13, color: '#FAFAF9',
      display: 'flex', alignItems: 'center', gap: 8, zIndex: 9999, whiteSpace: 'nowrap',
      animation: 'hn-toastIn 0.25s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', flexShrink: 0 }} />
      {state.msg}
    </div>
  ) : null
  return { toast, ToastEl }
}

// ── Global keyframes (injected once) ─────────────────────────────────────────
const STYLES = `
@keyframes hn-spin     { to { transform: rotate(360deg); } }
@keyframes hn-shimmer  { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
@keyframes hn-scaleIn  { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes hn-toastIn  { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
`
if (!document.getElementById('hn-styles')) {
  const el = document.createElement('style')
  el.id = 'hn-styles'
  el.textContent = STYLES
  document.head.appendChild(el)
}

// ── SessionPage ───────────────────────────────────────────────────────────────
export function SessionPage() {
  const { toast, ToastEl } = useToast()

  const [session,      setSession]      = useState(null)
  const [xReport,      setXReport]      = useState(null)
  const [loadingInit,  setLoadingInit]  = useState(true)
  const [loadingX,     setLoadingX]     = useState(false)
  const [loadingZ,     setLoadingZ]     = useState(false)
  const [loadingClose, setLoadingClose] = useState(false)
  const [closingFloat, setClosingFloat] = useState('')
  const [showModal,    setShowModal]    = useState(false)

  useEffect(() => {
    api.getSession()
      .then((s) => { if (s?.status === 'Open') setSession(s) })
      .catch(() => {})
      .finally(() => setLoadingInit(false))
  }, [])

  const handleXReport = async () => {
    if (!session?.id) return
    setLoadingX(true)
    try {
      const r = await api.xReport(session.id)
      setXReport(r)
      toast('X-Report loaded')
    } catch (err) {
      toast(err.message || 'Failed to load X-Report')
    } finally {
      setLoadingX(false)
    }
  }

  const handleZReport = async () => {
    if (!session?.id) return
    setLoadingZ(true)
    try {
      const r = await api.zReport(session.id)
      setXReport(r)
      toast('Z-Report generated')
    } catch (err) {
      toast(err.message || 'Failed to generate Z-Report')
    } finally {
      setLoadingZ(false)
    }
  }

  const handleClose = async () => {
    if (!session?.id) return
    setLoadingClose(true)
    try {
      await api.closeSession(session.id, { closingFloat: parseFloat(closingFloat) || 0 })
      toast('Session closed')
      setSession(null)
      setShowModal(false)
    } catch (err) {
      toast(err.message || 'Failed to close session')
    } finally {
      setLoadingClose(false)
    }
  }

  const base = { fontFamily: 'inherit', background: '#09090B', color: '#FAFAF9', minHeight: '100%' }

  if (loadingInit) {
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 10, color: '#636360' }}>
        <Spinner /> Loading session…
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#636360', fontSize: 14 }}>
        No open session for this branch
      </div>
    )
  }

  return (
    <div style={{ ...base, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: -0.3 }}>POS Session</div>
          <div style={{ fontSize: 11, color: '#636360', marginTop: 1 }}>X / Z Reports · Session lifecycle</div>
        </div>
        <div style={{ flex: 1 }} />
        <Pill label={session.status || 'Open'} color="#4ADE80" bg="rgba(74,222,128,0.1)" />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Session info */}
          <Card>
            <SectionTitle>Current Session</SectionTitle>
            <FieldRow label="Session ID"    value={`${session.id?.slice(0, 8)}…`} />
            <FieldRow label="Terminal"      value={session.terminal || 'POS-1'} />
            <FieldRow label="Cashier"       value={session.cashierName || '—'} />
            <FieldRow label="Opened"        value={fmtDT(session.openedAtUtc)} />
            <FieldRow label="Opening Float" value={fmt(session.openingFloat)} accent />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Btn variant="ghost" size="sm" loading={loadingX} onClick={handleXReport}>
                📊 X-Report
              </Btn>
              <Btn
                variant="ghost" size="sm" loading={loadingZ} onClick={handleZReport}
                style={{ color: xReport?.isZReported ? '#636360' : undefined }}
              >
                {xReport?.isZReported ? '✓ Z-Reported' : '📋 Z-Report'}
              </Btn>
              <Btn variant="danger" size="sm" onClick={() => setShowModal(true)}>
                Close Session
              </Btn>
            </div>
          </Card>

          {/* X-Report snapshot */}
          <Card>
            <SectionTitle>X-Report Snapshot</SectionTitle>
            {loadingX ? (
              <><Skeleton mb={8} /><Skeleton mb={8} width="70%" /><Skeleton width="80%" /></>
            ) : xReport ? (
              <>
                <FieldRow label="Gross Sales"    value={fmt(xReport.grossSales)}    accent />
                <FieldRow label="Total COGS"     value={fmt(xReport.totalCogs)} />
                <FieldRow label="Gross Profit"   value={fmt(xReport.grossProfit)} />
                <FieldRow label="Total Discount" value={fmt(xReport.totalDiscount)} />
                <FieldRow label="Total Tax"      value={fmt(xReport.totalTax)} />
                <FieldRow label="Total Orders"   value={String(xReport.totalSales)} />
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: '#636360', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Payment Breakdown
                  </div>
                  {(xReport.paymentBreakdown || []).map((p) => (
                    <div key={p.method} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: 12, color: '#A1A09A' }}>
                        {p.method} <span style={{ color: '#636360' }}>×{p.count}</span>
                      </span>
                      <span style={{ fontSize: 13 }}>{fmt(p.total)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#636360', textAlign: 'center', padding: '24px 0' }}>
                Click X-Report to load live snapshot
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Close modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Close Session" subtitle="This ends the current POS shift for this terminal">
        <label style={{ fontSize: 11, color: '#636360', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Closing Float ($)
        </label>
        <input
          type="number"
          value={closingFloat}
          onChange={(e) => setClosingFloat(e.target.value)}
          placeholder="Cash in drawer"
          style={{
            width: '100%', background: '#1F1F23', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 7, padding: '9px 12px', color: '#FAFAF9', fontSize: 13,
            outline: 'none', marginBottom: 20, fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 11 }}>Cancel</Btn>
          <Btn variant="danger" loading={loadingClose} onClick={handleClose} style={{ flex: 2, padding: 11 }}>Confirm Close</Btn>
        </div>
      </Modal>

      {ToastEl}
    </div>
  )
}

export default SessionPage