import type { ReactElement } from 'react'

import type { SwipeEngagement } from '../hooks/useSwipeDeck'

export interface SwipeSessionProgressCounts {
  rated: number
  liked: number
}

export interface SwipeSessionProgressProps {
  engagements: SwipeEngagement[]
}

export function countSwipeSessionProgress (
  engagements: SwipeEngagement[]
): SwipeSessionProgressCounts {
  return {
    rated: engagements.length,
    liked: engagements.filter((engagement) => engagement.action === 'like').length
  }
}

export function SwipeSessionProgress ({
  engagements
}: SwipeSessionProgressProps): ReactElement {
  const { rated, liked } = countSwipeSessionProgress(engagements)

  return (
    <div
      className='swipe-session-progress'
      role='group'
      aria-label='Swipe session counts'
    >
      <p className='swipe-session-progress__stat'>
        <span className='swipe-session-progress__label'>Rated</span>
        <span className='swipe-session-progress__value'>{rated}</span>
      </p>
      <p className='swipe-session-progress__stat'>
        <span className='swipe-session-progress__label'>Liked</span>
        <span className='swipe-session-progress__value'>{liked}</span>
      </p>
    </div>
  )
}
