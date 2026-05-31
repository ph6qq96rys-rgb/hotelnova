import axios from 'axios'

const COMPANY_ID = import.meta.env.VITE_COMPANY_ID
const BRANCH_ID = import.meta.env.VITE_BRANCH_ID

if (!COMPANY_ID || !BRANCH_ID) {
  console.warn('[HotelNova] VITE_COMPANY_ID or VITE_BRANCH_ID not set in .env.local')
}

export const client = axios.create({
  baseURL: `/api/companies/${COMPANY_ID}/branches/${BRANCH_ID}`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hn_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global error normalisation
client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.Error ||
      err.message ||
      'Unknown error'
    return Promise.reject(new Error(message))
  }
)
