const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

export const apiBaseUrl =
  typeof configuredBaseUrl === 'string' && configuredBaseUrl.length > 0
    ? configuredBaseUrl.replace(/\/$/, '')
    : 'http://localhost:8000'
