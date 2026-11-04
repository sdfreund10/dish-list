export type RatingAction = 'like' | 'pass'

export interface ClientRating {
  recipeId: number
  action: RatingAction
}

export interface ClientSession {
  id: string
  ratings: ClientRating[]
}

export const SESSION_STORAGE_KEY = 'dish-list.session'

export function ensureClientSession (): ClientSession {
  const existing = readClientSession()
  if (existing != null) return existing

  const created: ClientSession = {
    id: crypto.randomUUID(),
    ratings: []
  }
  writeClientSession(created)
  return created
}

export function readClientSession (): ClientSession | null {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (raw == null) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isClientSession(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function appendClientRating (rating: ClientRating): ClientSession {
  const session = ensureClientSession()
  if (session.ratings.some(existing => existing.recipeId === rating.recipeId)) {
    return session
  }

  const next: ClientSession = {
    ...session,
    ratings: [...session.ratings, rating]
  }
  writeClientSession(next)
  return next
}

export function ratedRecipeIds (session: ClientSession = ensureClientSession()): number[] {
  return session.ratings.map(rating => rating.recipeId)
}

function writeClientSession (session: ClientSession): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

function isClientSession (value: unknown): value is ClientSession {
  if (value == null || typeof value !== 'object') return false
  const session = value as Partial<ClientSession>
  return (
    typeof session.id === 'string' &&
    session.id.length > 0 &&
    Array.isArray(session.ratings) &&
    session.ratings.every(isClientRating)
  )
}

function isClientRating (value: unknown): value is ClientRating {
  if (value == null || typeof value !== 'object') return false
  const rating = value as Partial<ClientRating>
  return (
    typeof rating.recipeId === 'number' &&
    (rating.action === 'like' || rating.action === 'pass')
  )
}
