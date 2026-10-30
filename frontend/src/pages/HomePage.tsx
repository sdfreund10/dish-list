import { useEffect, useState, type ReactElement } from 'react'

import { apiBaseUrl } from '../config'

type HealthStatus = 'loading' | 'ok' | 'error'

export function HomePage (): ReactElement {
  const [status, setStatus] = useState<HealthStatus>('loading')

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth (): Promise<void> {
      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal
        })

        if (!response.ok) {
          setStatus('error')
          return
        }

        const body = (await response.json()) as { status?: string }
        setStatus(body.status === 'ok' ? 'ok' : 'error')
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setStatus('error')
      }
    }

    void checkHealth()

    return () => {
      controller.abort()
    }
  }, [])

  return (
    <section className='home'>
      <h1>Swipe Engagement</h1>
      <p>Anonymous recipe-swiping experiment.</p>
      <p className={`api-status api-status-${status}`}>
        API: {status === 'loading' ? 'checking…' : status}
      </p>
    </section>
  )
}
