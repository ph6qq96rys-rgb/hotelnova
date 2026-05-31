import React, { useState } from 'react'
import { Btn, Input, Spinner } from '@/components/ui'
import { useOpenSession } from '@/hooks/usePosSession'
import { useOpenShiftMutation } from '@/hooks/useOperations'
import { useToast } from '@/hooks/useToast'

export function SessionGate({ onSessionOpened }) {
  const toast = useToast()
  const [form, setForm] = useState({
    cashierName: '',
    terminal: 'POS-1',
    openingFloat: '500',
  })
  const [error, setError] = useState('')

  const openSession = useOpenSession()
  const openShift   = useOpenShiftMutation()

  const handleOpen = async () => {
    if (!form.cashierName.trim()) {
      setError('Cashier name is required.')
      return
    }
    setError('')
    try {
      const session = await openSession.mutateAsync({
        cashierName: form.cashierName,
        openingFloat: parseFloat(form.openingFloat) || 0,
        terminal: form.terminal,
      })

      // Open the cashier shift in parallel (best-effort)
      openShift.mutate({
        cashierName: form.cashierName,
        openingCash: parseFloat(form.openingFloat) || 0,
        terminalName: form.terminal,
      })

      toast(`Welcome, ${session.cashierName}!`)
      onSessionOpened(session)
    } catch (err) {
      setError(err.message || 'Failed to open session.')
    }
  }

  const loading = openSession.isPending

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: 'var(--bg-0)',
    }}>
      <div className="anim-scale-in" style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--brd-2)',
        borderRadius: 'var(--r-lg)',
        padding: 36,
        width: 380,
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28, fontWeight: 400,
            letterSpacing: -0.8, marginBottom: 6,
          }}>
            HotelNova POS
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Open a session to begin
          </div>
        </div>

        <Input
          label="Cashier Name"
          value={form.cashierName}
          onChange={(e) => setForm((f) => ({ ...f, cashierName: e.target.value }))}
          placeholder="e.g. Alex Wong"
          style={{ marginBottom: 0 }}
        />
        <div style={{ marginBottom: 14 }} />

        <Input
          label="Terminal"
          value={form.terminal}
          onChange={(e) => setForm((f) => ({ ...f, terminal: e.target.value }))}
          placeholder="POS-1"
          style={{ marginBottom: 0 }}
        />
        <div style={{ marginBottom: 14 }} />

        <Input
          label="Opening Float ($)"
          type="number"
          value={form.openingFloat}
          onChange={(e) => setForm((f) => ({ ...f, openingFloat: e.target.value }))}
          placeholder="500.00"
          style={{ marginBottom: error ? 0 : 20 }}
        />

        {error && (
          <div style={{ fontSize: 12, color: 'var(--red)', margin: '8px 0 14px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleOpen}
          disabled={loading}
          style={{
            width: '100%', padding: 13,
            background: 'var(--gold)', color: '#000',
            border: 'none', borderRadius: 'var(--r-sm)',
            fontFamily: 'var(--font-display)',
            fontSize: 15, fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? <><Spinner /> Opening…</> : 'Open Session'}
        </button>
      </div>
    </div>
  )
}
