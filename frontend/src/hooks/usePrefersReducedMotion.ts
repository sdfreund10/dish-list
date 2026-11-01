import { useEffect, useState } from 'react'

export function usePrefersReducedMotion (): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (): void => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    update()
    mediaQuery.addEventListener('change', update)
    return () => {
      mediaQuery.removeEventListener('change', update)
    }
  }, [])

  return prefersReducedMotion
}
