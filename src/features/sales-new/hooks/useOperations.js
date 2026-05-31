import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { operationsApi } from '@/api'

// ── Station Types ─────────────────────────────────────────────────────────────
export function useStationTypes() {
  return useQuery({
    queryKey: ['station-types'],
    queryFn: operationsApi.getStationTypes,
  })
}

export function useCreateStationType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: operationsApi.createStationType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['station-types'] }),
  })
}

// ── Cashier Shifts ────────────────────────────────────────────────────────────
export function useOpenShift() {
  return useQuery({
    queryKey: ['cashier-shift', 'open'],
    queryFn: operationsApi.getOpenShift,
    retry: 1,
  })
}

export function useListShifts(params) {
  return useQuery({
    queryKey: ['cashier-shifts', params],
    queryFn: () => operationsApi.listShifts(params),
  })
}

export function useOpenShiftMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: operationsApi.openShift,
    onSuccess: (data) => {
      qc.setQueryData(['cashier-shift', 'open'], data)
      qc.invalidateQueries({ queryKey: ['cashier-shifts'] })
    },
  })
}

export function useCloseShiftMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shiftId, dto }) => operationsApi.closeShift(shiftId, dto),
    onSuccess: () => {
      qc.setQueryData(['cashier-shift', 'open'], null)
      qc.invalidateQueries({ queryKey: ['cashier-shifts'] })
    },
  })
}

// ── Safe Drops ────────────────────────────────────────────────────────────────
export function useSafeDrops(params) {
  return useQuery({
    queryKey: ['safe-drops', params],
    queryFn: () => operationsApi.listSafeDrops(params),
  })
}

export function useCreateSafeDrop() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: operationsApi.createSafeDrop,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['safe-drops'] }),
  })
}

// ── Reports ───────────────────────────────────────────────────────────────────
export function useSalesSummary(fromUtc, toUtc) {
  return useQuery({
    queryKey: ['sales-summary', fromUtc, toUtc],
    queryFn: () => operationsApi.getSalesSummary(fromUtc, toUtc),
    enabled: !!(fromUtc && toUtc),
    refetchInterval: 60_000,
  })
}

export function useGenerateEndOfDay() {
  return useMutation({
    mutationFn: operationsApi.generateEndOfDay,
  })
}
