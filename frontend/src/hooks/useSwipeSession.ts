import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ApiError,
  createSession,
  fetchSessionState,
  recordRating
} from '../api/sessions'
import type { SessionState } from '../types/session'
import type { SwipeEngagement } from './useSwipeDeck'

export const SESSION_STORAGE_KEY = 'dish-list.session-id'

const EMPTY_STATE: SessionState = {
  rating_count: 0,
  like_count: 0,
  liked_recipe_ids: [],
  eligible: false
}

let pendingSession: Promise<{ id: string, state: SessionState }> | null = null

export function resetSwipeSessionCache (): void {
  pendingSession = null
}

async function ensureSession (): Promise<{ id: string, state: SessionState }> {
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (stored != null) {
    try {
      const state = await fetchSessionState(stored)
      return { id: stored, state }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY)
        pendingSession = null
        return await ensureSession()
      }
      throw error
    }
  }

  pendingSession ??= createSession()
    .then(created => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, created.id)
      return { id: created.id, state: created.state }
    })
    .catch(error => {
      pendingSession = null
      throw error
    })

  return await pendingSession
}

export function useSwipeSession (): {
  sessionId: string | null
  eligible: boolean
  recordEngagement: (engagement: SwipeEngagement) => void
} {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [state, setState] = useState<SessionState>(EMPTY_STATE)
  const queueRef = useRef<SwipeEngagement[]>([])

  const applyState = useCallback((next: SessionState): void => {
    setState(current => next.rating_count < current.rating_count ? current : next)
  }, [])

  useEffect(() => {
    let active = true

    ensureSession()
      .then(session => {
        if (!active) return
        setSessionId(session.id)
        applyState(session.state)
      })
      .catch(() => {
        // Swiping still works. The plan stays locked until a session exists.
      })

    return () => {
      active = false
    }
  }, [applyState])

  const send = useCallback((id: string, engagement: SwipeEngagement): void => {
    void recordRating(id, engagement)
      .then(result => {
        applyState(result.session)
      })
      .catch(() => {
        // The deck already advanced. Eligibility stays at the last confirmed state.
      })
  }, [applyState])

  useEffect(() => {
    if (sessionId == null || queueRef.current.length === 0) return

    const queued = queueRef.current
    queueRef.current = []
    for (const engagement of queued) {
      send(sessionId, engagement)
    }
  }, [sessionId, send])

  const recordEngagement = useCallback((engagement: SwipeEngagement): void => {
    if (sessionId == null) {
      queueRef.current.push(engagement)
      return
    }
    send(sessionId, engagement)
  }, [sessionId, send])

  return {
    sessionId,
    eligible: state.eligible,
    recordEngagement
  }
}
