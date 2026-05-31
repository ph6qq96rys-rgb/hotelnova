import React from 'react'

// ── Status pill ───────────────────────────────────────────────────────────────
const STATUS = {
  serving:   { bg: 'var(--green-a)', color: 'var(--green)', label: 'Serving' },
  preparing: { bg: 'var(--amber-a)', color: 'var(--amber)', label: 'Preparing' },
  paid:      { bg: 'var(--bg-4)',    color: 'var(--text-3)', label: 'Settled' },
  available: { bg: 'var(--green-a)', color: 'var(--green)', label: 'Available' },
  occupied:  { bg: 'var(--red-a)',   color: 'var(--red)',   label: 'Occupied' },
  reserved:  { bg: 'var(--blue-a)',  color: 'var(--blue)',  label: 'Reserved' },
  Open:      { bg: 'var(--green-a)', color: 'var(--green)', label: 'Open' },
  Closed:    { bg: 'var(--bg-4)',    color: 'var(--text-3)', label: 'Closed' },
}

export function Pill({ status, small = false, style = {} }) {
  const m = STATUS[status] || { bg: 'var(--bg-4)', color: 'var(--text-3)', label: status }
  return (
    <span style={{
      fontSize: small ? 10 : 11,
      fontWeight: 500,
      padding: small ? '2px 7px' : '3px 9px',
      borderRadius: 'var(--r-full)',
      background: m.bg,
      color: m.color,
      letterSpacing: 0.3,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {m.label}
    </span>
  )
}

// ── Loading spinner ───────────────────────────────────────────────────────────
export function Spinner({ size = 14 }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: '2px solid var(--bg-5)',
      borderTopColor: 'var(--gold)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 14, mb = 0 }) {
  return (
    <div style={{
      width,
      height,
      borderRadius: 4,
      marginBottom: mb,
      background: 'linear-gradient(90deg, var(--bg-3) 25%, var(--bg-4) 50%, var(--bg-3) 75%)',
      backgroundSize: '800px 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ── Toast notification ────────────────────────────────────────────────────────
export function Toast({ message, show }) {
  if (!show) return null
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-4)',
      border: '1px solid var(--brd-2)',
      borderRadius: 'var(--r)',
      padding: '10px 18px',
      fontSize: 13,
      color: 'var(--text-1)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      zIndex: 9999,
      whiteSpace: 'nowrap',
      animation: 'toastIn 0.25s ease',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
      {message}
    </div>
  )
}

// ── Modal overlay ─────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, subtitle, children, width = 380 }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="anim-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--brd-2)',
          borderRadius: 'var(--r-lg)',
          padding: 28,
          width,
          maxWidth: '95vw',
          boxShadow: '0 32px 64px rgba(0,0,0,0.7)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {title && (
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 500,
            marginBottom: subtitle ? 4 : 20,
            letterSpacing: -0.3,
          }}>
            {title}
          </div>
        )}
        {subtitle && (
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  gold:    { background: 'var(--gold)',    color: '#000',             border: 'none' },
  ghost:   { background: 'var(--bg-3)',    color: 'var(--text-2)',    border: '1px solid var(--brd-1)' },
  danger:  { background: 'var(--red-a)',   color: 'var(--red)',       border: '1px solid var(--red-b)' },
  green:   { background: 'var(--green-a)', color: 'var(--green)',     border: '1px solid var(--green-b)' },
  outline: { background: 'transparent',   color: 'var(--text-2)',    border: '1px solid var(--brd-2)' },
}
const BTN_SIZES = {
  sm: { fontSize: 12, padding: '6px 12px' },
  md: { fontSize: 13, padding: '8px 16px' },
  lg: { fontSize: 14, padding: '11px 20px' },
}

export function Btn({
  children, onClick, variant = 'ghost', size = 'md',
  loading = false, disabled = false, style: s = {}, type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={!disabled && !loading ? onClick : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 'var(--r-sm)',
        fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.12s',
        ...BTN_VARIANTS[variant] || BTN_VARIANTS.ghost,
        ...BTN_SIZES[size] || BTN_SIZES.md,
        ...s,
      }}
    >
      {loading ? <Spinner size={13} /> : children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style: s = {}, className = '' }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--brd-1)',
        borderRadius: 'var(--r)',
        padding: '18px 20px',
        ...s,
      }}
    >
      {children}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────────
export function SectionTitle({ children, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 14,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: 1.6, textTransform: 'uppercase',
        color: 'var(--text-3)',
      }}>
        {children}
      </span>
      {action}
    </div>
  )
}

// ── Field row (label / value) ─────────────────────────────────────────────────
export function FieldRow({ label, value, accent = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--brd-1)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 500,
        color: accent ? 'var(--gold)' : 'var(--text-1)',
        fontFamily: accent ? 'var(--font-display)' : 'inherit',
        letterSpacing: accent ? -0.3 : 0,
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, style: s = {}, ...props }) {
  const inputStyle = {
    width: '100%',
    background: 'var(--bg-3)',
    border: '1px solid var(--brd-1)',
    borderRadius: 'var(--r-sm)',
    padding: '9px 12px',
    color: 'var(--text-1)',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.15s',
    ...s,
  }
  if (!label) return <input style={inputStyle} {...props} />
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        fontSize: 11, color: 'var(--text-3)', display: 'block',
        marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        {label}
      </label>
      <input style={inputStyle} {...props} />
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ my = 12 }) {
  return <div style={{ borderTop: '1px solid var(--brd-1)', margin: `${my}px 0` }} />
}
