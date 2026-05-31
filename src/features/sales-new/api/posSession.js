import { client } from './client'

/**
 * PosSessionController
 * GET  /pos-sessions/current
 * POST /pos-sessions/open          body: { cashierName, openingFloat, terminal? }
 * POST /pos-sessions/{id}/close    body: { closingFloat }
 * GET  /pos-sessions/{id}/x-report
 * POST /pos-sessions/{id}/z-report
 */

export const posSessionApi = {
  getCurrent: () =>
    client.get('/pos-sessions/current'),

  open: (payload) =>
    client.post('/pos-sessions/open', payload),
  // payload: { cashierName: string, openingFloat: number, terminal?: string }

  close: (sessionId, payload) =>
    client.post(`/pos-sessions/${sessionId}/close`, payload),
  // payload: { closingFloat: number }

  xReport: (sessionId) =>
    client.get(`/pos-sessions/${sessionId}/x-report`),

  zReport: (sessionId) =>
    client.post(`/pos-sessions/${sessionId}/z-report`),
}
