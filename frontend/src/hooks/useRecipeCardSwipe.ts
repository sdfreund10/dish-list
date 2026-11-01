import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'

import { SWIPE_COMMIT_THRESHOLD_PX } from '../components/swipeConstants'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const SWIPE_HINT_VISIBLE_PX = 16
const SWIPE_MAX_ROTATION_DEG = 8

export interface UseRecipeCardSwipeResult {
  showLikeHint: boolean
  showPassHint: boolean
  hintOpacity: number
  swipeSurfaceStyle: CSSProperties
  swipeSurfaceClassName: string
  onSwipePointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onSwipePointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onSwipePointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onSwipePointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
}

function clampRotation (offsetPx: number): number {
  const ratio = offsetPx / SWIPE_COMMIT_THRESHOLD_PX
  const clamped = Math.max(-1, Math.min(1, ratio))
  return clamped * SWIPE_MAX_ROTATION_DEG
}

function setPointerCaptureIfSupported (
  target: HTMLElement,
  pointerId: number
): void {
  if (typeof target.setPointerCapture === 'function') {
    target.setPointerCapture(pointerId)
  }
}

function releasePointerCaptureIfSupported (
  target: HTMLElement,
  pointerId: number
): void {
  if (
    typeof target.hasPointerCapture === 'function' &&
    typeof target.releasePointerCapture === 'function' &&
    target.hasPointerCapture(pointerId)
  ) {
    target.releasePointerCapture(pointerId)
  }
}

export function useRecipeCardSwipe (
  recipeId: number,
  onLike: () => void,
  onPass: () => void
): UseRecipeCardSwipeResult {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startClientXRef = useRef(0)
  const draggingRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    setDragOffsetPx(0)
    setIsDragging(false)
    draggingRef.current = false
    activePointerIdRef.current = null
  }, [recipeId])

  const finishDrag = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    offsetPx: number
  ): void => {
    draggingRef.current = false
    setIsDragging(false)
    activePointerIdRef.current = null

    releasePointerCaptureIfSupported(event.currentTarget, event.pointerId)

    if (Math.abs(offsetPx) >= SWIPE_COMMIT_THRESHOLD_PX) {
      setDragOffsetPx(0)
      if (offsetPx > 0) {
        onLike()
      } else {
        onPass()
      }
      return
    }

    setDragOffsetPx(0)
  }, [onLike, onPass])

  const onSwipePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return

    startClientXRef.current = event.clientX
    draggingRef.current = true
    activePointerIdRef.current = event.pointerId
    setIsDragging(true)
    setDragOffsetPx(0)
    setPointerCaptureIfSupported(event.currentTarget, event.pointerId)
  }, [])

  const onSwipePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    if (!draggingRef.current || activePointerIdRef.current !== event.pointerId) return

    setDragOffsetPx(event.clientX - startClientXRef.current)
  }, [])

  const onSwipePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    if (!draggingRef.current || activePointerIdRef.current !== event.pointerId) return

    finishDrag(event, event.clientX - startClientXRef.current)
  }, [finishDrag])

  const onSwipePointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    if (!draggingRef.current || activePointerIdRef.current !== event.pointerId) return

    finishDrag(event, 0)
  }, [finishDrag])

  const hintOpacity = Math.min(
    1,
    Math.abs(dragOffsetPx) / SWIPE_COMMIT_THRESHOLD_PX
  )
  const showLikeHint = dragOffsetPx >= SWIPE_HINT_VISIBLE_PX
  const showPassHint = dragOffsetPx <= -SWIPE_HINT_VISIBLE_PX

  const rotationDeg = prefersReducedMotion ? 0 : clampRotation(dragOffsetPx)
  const swipeSurfaceStyle: CSSProperties = {
    transform: `translateX(${dragOffsetPx}px) rotate(${rotationDeg}deg)`
  }

  const swipeSurfaceClassName = [
    'recipe-swipe-card__swipe-surface',
    isDragging ? 'recipe-swipe-card__swipe-surface--dragging' : null,
    prefersReducedMotion ? 'recipe-swipe-card__swipe-surface--reduced-motion' : null
  ].filter(Boolean).join(' ')

  return {
    showLikeHint,
    showPassHint,
    hintOpacity,
    swipeSurfaceStyle,
    swipeSurfaceClassName,
    onSwipePointerDown,
    onSwipePointerMove,
    onSwipePointerUp,
    onSwipePointerCancel
  }
}
