import { client } from './client'

/**
 * OperationsController  —  /operations/…
 *
 * Station Types
 *   GET  /operations/station-types
 *   POST /operations/station-types           body: CreateStationTypeDto
 *
 * Cashier Shifts
 *   GET  /operations/cashier-shifts/open
 *   GET  /operations/cashier-shifts          query: fromUtc?, toUtc?
 *   POST /operations/cashier-shifts/open     body: OpenCashierShiftDto
 *   POST /operations/cashier-shifts/{id}/close  body: CloseCashierShiftDto
 *
 * Safe Drops
 *   GET  /operations/safe-drops              query: shiftId?, fromUtc?, toUtc?
 *   POST /operations/safe-drops              body: CreateSafeDropDto
 *
 * Reports
 *   GET  /operations/sales-summary           query: fromUtc (required), toUtc (required)
 *   POST /operations/end-of-day              body: GenerateEndOfDayReportDto
 */

export const operationsApi = {
  // Station types
  getStationTypes: () =>
    client.get('/operations/station-types'),

  createStationType: (dto) =>
    client.post('/operations/station-types', dto),
  // dto: { name: string, ... }

  // Cashier shifts
  getOpenShift: () =>
    client.get('/operations/cashier-shifts/open'),

  listShifts: (params = {}) => {
    const query = new URLSearchParams()
    if (params.fromUtc) query.set('fromUtc', params.fromUtc)
    if (params.toUtc) query.set('toUtc', params.toUtc)
    return client.get(`/operations/cashier-shifts?${query}`)
  },

  openShift: (dto) =>
    client.post('/operations/cashier-shifts/open', dto),
  // dto: OpenCashierShiftDto (cashierName, openingCash, terminalName, ...)

  closeShift: (shiftId, dto) =>
    client.post(`/operations/cashier-shifts/${shiftId}/close`, dto),
  // dto: CloseCashierShiftDto (closingCash, ...)

  // Safe drops
  listSafeDrops: (params = {}) => {
    const query = new URLSearchParams()
    if (params.shiftId) query.set('shiftId', params.shiftId)
    if (params.fromUtc) query.set('fromUtc', params.fromUtc)
    if (params.toUtc) query.set('toUtc', params.toUtc)
    return client.get(`/operations/safe-drops?${query}`)
  },

  createSafeDrop: (dto) =>
    client.post('/operations/safe-drops', dto),
  // dto: CreateSafeDropDto (amount, notes, shiftId, ...)

  // Reports
  getSalesSummary: (fromUtc, toUtc) =>
    client.get(`/operations/sales-summary?fromUtc=${fromUtc}&toUtc=${toUtc}`),
  // Returns: { grossSales, totalSales, totalTax, totalDiscount, totalCogs, grossProfit }

  generateEndOfDay: (dto) =>
    client.post('/operations/end-of-day', dto),
  // dto: GenerateEndOfDayReportDto (reportDate, ...)
}
