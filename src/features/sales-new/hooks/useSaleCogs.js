import { useMutation } from '@tanstack/react-query'
import { saleCogsApi } from '@/api'

export function usePostCogs() {
  return useMutation({
    mutationFn: saleCogsApi.postCogs,
  })
}

export function usePostCogsBulk() {
  return useMutation({
    mutationFn: saleCogsApi.postCogsBulk,
    // Returns: { posted, skipped, failed, errors }
  })
}
