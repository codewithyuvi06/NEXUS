/** Small typed API client shared by frontend features. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'
export const api = {
  baseUrl: API_BASE_URL,
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = localStorage.getItem('nexus_token')
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers }
    })
    const payload = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) throw new Error(payload.error || `API request failed (${response.status})`)
    return payload as T
  }
}
