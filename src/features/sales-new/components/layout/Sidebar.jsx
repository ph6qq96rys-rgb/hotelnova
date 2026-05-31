import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const NAV = [
  {
    path: '/pos',
    label: 'POS',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    path: '/orders',
    label: 'Orders',
    badge: true,
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    path: '/tables',
    label: 'Floor',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M3 3h18v4H3zM3 21h18v-4H3zM3 8v8M21 8v8M8 8v8M16 8v8" />
      </svg>
    ),
  },
  {
    path: '/session',
    label: 'Session',
    sessionDot: true,
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    path: '/operations',
    label: 'Ops',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
]

export function Sidebar({ session }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div style={{
      width: 64,
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--brd-1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '14px 0',
      gap: 4,
      flexShrink: 0,
    }}>
      {/* Logo mark */}
      <div
        onClick={() => navigate('/pos')}
        style={{
          width: 36, height: 36,
          borderRadius: 9,
          background: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 13,
          color: '#000',
          letterSpacing: -0.3,
          userSelect: 'none',
        }}
      >
        HN
      </div>

      {NAV.map((item) => {
        const active = pathname.startsWith(item.path)
        return (
          <div
            key={item.path}
            title={item.label}
            onClick={() => navigate(item.path)}
            style={{
              width: 42, height: 42,
              borderRadius: 'var(--r-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              background: active ? 'var(--gold-a)' : 'transparent',
              color: active ? 'var(--gold)' : 'var(--text-3)',
              transition: 'all 0.12s',
            }}
          >
            {item.icon}

            {/* Preparing-orders badge */}
            {item.badge && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 8, height: 8,
                borderRadius: '50%',
                background: 'var(--red)',
                border: '2px solid var(--bg-1)',
              }} />
            )}

            {/* Session open dot */}
            {item.sessionDot && session?.status === 'Open' && (
              <span style={{
                position: 'absolute', top: 8, right: 8,
                width: 7, height: 7,
                borderRadius: '50%',
                background: 'var(--green)',
                border: '2px solid var(--bg-1)',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
