import { createContext, useContext, type ReactElement, type ReactNode } from 'react'

import { useSwipeDeck, type UseSwipeDeckResult } from '../hooks/useSwipeDeck'
import { useSwipeSession } from '../hooks/useSwipeSession'

interface SwipeSessionValue {
  sessionId: string | null
  eligible: boolean
  recordEngagement: ReturnType<typeof useSwipeSession>['recordEngagement']
}

interface SwipeExperienceValue {
  session: SwipeSessionValue
  deck: UseSwipeDeckResult
}

const SwipeExperienceContext = createContext<SwipeExperienceValue | null>(null)

export function SwipeExperience ({ children }: { children: ReactNode }): ReactElement {
  const session = useSwipeSession()
  const deck = useSwipeDeck()

  return (
    <SwipeExperienceContext.Provider value={{ session, deck }}>
      {children}
    </SwipeExperienceContext.Provider>
  )
}

export function useSwipeExperience (): SwipeExperienceValue {
  const value = useContext(SwipeExperienceContext)
  if (value == null) {
    throw new Error('useSwipeExperience must be used within SwipeExperience')
  }
  return value
}
