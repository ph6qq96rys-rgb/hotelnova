import { client } from './client'

/**
 * SaleCogsController
 * POST /sales/{saleId}/post-cogs
 * POST /sales/post-cogs/bulk       query: fromDate?, toDate?
 */

export const saleCogsApi = {
  postCogs: (saleId) =>
    client.post(`/sales/${saleId}/post-cogs`),

  postCogsBulk: (params = {}) => {
    const query = new URLSearchParams()
    if (params.fromDate) query.set('fromDate', params.fromDate)
    if (params.toDate) query.set('toDate', params.toDate)
    return client.post(`/sales/post-cogs/bulk?${query}`)
  },
  // Returns: { posted, skipped, failed, errors }
}
