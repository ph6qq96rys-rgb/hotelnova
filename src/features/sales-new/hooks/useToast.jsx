import React, { createContext, useContext, useCallback, useRef, useState } from 'react'
import { Toast } from '@/components/ui'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [state, setState] = useState({ message: '', show: false })
  const timer = useRef(null)

  const toast = useCallback((message) => {
    setState({ message, show: true })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState((s) => ({ ...s, show: false })), 2400)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Toast message={state.message} show={state.show} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
