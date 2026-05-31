import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { posSessionApi } from '@/api'

export const SESSION_KEY = ['pos-session', 'current']

export function useCurrentSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: posSessionApi.getCurrent,
    // Poll every 30s to detect if another terminal closed the session
    refetchInterval: 30_000,
    retry: 1,
  })
}

export function useOpenSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: posSessionApi.open,
    onSuccess: (session) => {
      qc.setQueryData(SESSION_KEY, session)
    },
  })
}

export function useCloseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, payload }) =>
      posSessionApi.close(sessionId, payload),
    onSuccess: () => {
      qc.setQueryData(SESSION_KEY, null)
    },
  })
}

export function useXReport(sessionId) {
  return useQuery({
    queryKey: ['x-report', sessionId],
    queryFn: () => posSessionApi.xReport(sessionId),
    enabled: !!sessionId,
    staleTime: 0, // Always fresh — it's a live snapshot
  })
}

export function useZReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: posSessionApi.zReport,
    onSuccess: (data, sessionId) => {
      qc.setQueryData(['x-report', sessionId], data)
    },
  })
}
