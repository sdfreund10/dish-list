import {
  useLayoutEffect,
  useRef,
  type RefObject,
  type PointerEvent as ReactPointerEvent
} from 'react'

import { SWIPE_COMMIT_THRESHOLD_PX } from '../components/swipeConstants'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const SWIPE_MIN_FLICK_DISTANCE_PX = 24
const SWIPE_FLICK_VELOCITY = 0.5 // Pixels per millisecond over the last movement.
const SWIPE_MAX_ROTATION_DEG = 8
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

interface Drag {
  pointerId: number
  startX: number
  lastX: number
  lastTime: number
  velocity: number
}

interface UseRecipeCardSwipeResult {
  surfaceRef: RefObject<HTMLDivElement | null>
  likeHintRef: RefObject<HTMLSpanElement | null>
  passHintRef: RefObject<HTMLSpanElement | null>
  onSwipePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onSwipePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onSwipePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onSwipePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
}

function releaseVelocity (drag: Drag, event: ReactPointerEvent<HTMLDivElement>): number {
  const elapsed = event.timeStamp - drag.lastTime
  if (event.clientX !== drag.lastX) {
    return (event.clientX - drag.lastX) / Math.max(1, elapsed)
  }
  // Holding still before release should stop a flick from committing.
  return elapsed < 80 ? drag.velocity : 0
}

function swipeTransform (offset: number): string {
  const ratio = Math.max(-1, Math.min(1, offset / SWIPE_COMMIT_THRESHOLD_PX))
  const rotation = ratio * SWIPE_MAX_ROTATION_DEG
  return `translateX(${offset}px) rotate(${rotation}deg)`
}

// A decorative snapshot lets the old recipe leave while the next is already usable.
function animateExit (surface: HTMLDivElement, offset: number): () => void {
  const snapshot = surface.cloneNode(true) as HTMLDivElement
  snapshot.className = 'recipe-swipe-card__swipe-surface recipe-swipe-card__exit'
  snapshot.setAttribute('aria-hidden', 'true')
  snapshot.inert = true
  snapshot.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
  snapshot.style.height = `${surface.offsetHeight}px`
  surface.parentElement?.append(snapshot)

  const distance = Math.sign(offset) * Math.max(surface.offsetWidth, Math.abs(offset))
  const animation = snapshot.animate([
    { transform: surface.style.transform, opacity: 1 },
    { transform: swipeTransform(distance), opacity: 0 }
  ], { duration: 160, easing: EASE_OUT, fill: 'forwards' })
  const remove = (): void => {
    animation.cancel()
    snapshot.remove()
  }
  animation.onfinish = remove
  return remove
}

export function useRecipeCardSwipe (
  recipeId: number,
  onLike: () => void,
  onPass: () => void
): UseRecipeCardSwipeResult {
  const prefersReducedMotion = usePrefersReducedMotion()
  const surfaceRef = useRef<HTMLDivElement>(null)
  const likeHintRef = useRef<HTMLSpanElement>(null)
  const passHintRef = useRef<HTMLSpanElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const exitCleanupRef = useRef<(() => void) | null>(null)
  const animateNextRecipeRef = useRef(false)

  function resetSurface (): void {
    const surface = surfaceRef.current
    if (surface == null) return
    surface.classList.remove('recipe-swipe-card__swipe-surface--dragging')
    surface.style.transform = ''
    if (likeHintRef.current != null) likeHintRef.current.style.opacity = '0'
    if (passHintRef.current != null) passHintRef.current.style.opacity = '0'
  }

  useLayoutEffect(() => {
    dragRef.current = null
    resetSurface()
    // Reset before paint so a new recipe never inherits the previous drag.
    const surface = surfaceRef.current
    if (surface == null) return
    surface.style.transition = 'none'
    if (!animateNextRecipeRef.current) return
    animateNextRecipeRef.current = false
    const animation = surface.animate?.([
      { opacity: 0 },
      { opacity: 1 }
    ], { duration: 240, easing: EASE_OUT })
    return () => { animation?.cancel() }
  }, [recipeId])

  useLayoutEffect(() => () => { exitCleanupRef.current?.() }, [])

  function updateDrag (event: ReactPointerEvent<HTMLDivElement>): number {
    const drag = dragRef.current
    if (drag == null) return 0
    const elapsed = event.timeStamp - drag.lastTime
    if (elapsed > 0) {
      drag.velocity = (event.clientX - drag.lastX) / elapsed
    }
    drag.lastX = event.clientX
    drag.lastTime = event.timeStamp
    return event.clientX - drag.startX
  }

  function onSwipePointerDown (event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || dragRef.current != null) return
    exitCleanupRef.current?.()
    const surface = event.currentTarget
    const transform = getComputedStyle(surface).transform
    const offset = transform === '' || transform === 'none'
      ? 0
      : new DOMMatrixReadOnly(transform).m41
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX - offset,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0
    }
    // Start from a returning card's current position when a drag interrupts it.
    surface.style.transition = 'none'
    surface.style.transform = transform === 'none' ? '' : transform
    surface.classList.add('recipe-swipe-card__swipe-surface--dragging')
    surface.setPointerCapture?.(event.pointerId)
  }

  function onSwipePointerMove (event: ReactPointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) return
    const offset = updateDrag(event)
    event.currentTarget.style.transform = prefersReducedMotion
      ? `translateX(${offset}px)`
      : swipeTransform(offset)
    const opacity = Math.min(1, Math.abs(offset) / SWIPE_COMMIT_THRESHOLD_PX)
    if (likeHintRef.current != null) {
      likeHintRef.current.style.opacity = offset > 0 ? String(opacity) : '0'
    }
    if (passHintRef.current != null) {
      passHintRef.current.style.opacity = offset < 0 ? String(opacity) : '0'
    }
  }

  function releaseDrag (event: ReactPointerEvent<HTMLDivElement>): void {
    dragRef.current = null
    const surface = event.currentTarget
    if (surface.hasPointerCapture?.(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId)
    }
    surface.style.transition = prefersReducedMotion ? 'none' : ''
    resetSurface()
  }

  function onSwipePointerUp (event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (drag?.pointerId !== event.pointerId) return
    const offset = event.clientX - drag.startX
    const velocity = releaseVelocity(drag, event)
    const isFlick = Math.abs(offset) >= SWIPE_MIN_FLICK_DISTANCE_PX &&
      Math.abs(velocity) >= SWIPE_FLICK_VELOCITY && Math.sign(velocity) === Math.sign(offset)
    const committed = Math.abs(offset) >= SWIPE_COMMIT_THRESHOLD_PX || isFlick
    const surface = event.currentTarget
    if (committed && !prefersReducedMotion && typeof surface.animate === 'function') {
      exitCleanupRef.current?.()
      surface.style.transform = swipeTransform(offset)
      exitCleanupRef.current = animateExit(surface, offset)
    }
    releaseDrag(event)
    if (committed) {
      animateNextRecipeRef.current = true
      if (offset > 0) onLike()
      else onPass()
    }
  }

  function onSwipePointerCancel (event: ReactPointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId === event.pointerId) releaseDrag(event)
  }

  return {
    surfaceRef,
    likeHintRef,
    passHintRef,
    onSwipePointerDown,
    onSwipePointerMove,
    onSwipePointerUp,
    onSwipePointerCancel
  }
}
