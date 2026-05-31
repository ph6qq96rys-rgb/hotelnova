export const fmt = (n) => `$${Number(n || 0).toFixed(2)}`

export const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '—'

export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

export const todayRange = () => {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return { fromUtc: start.toISOString(), toUtc: now.toISOString() }
}
