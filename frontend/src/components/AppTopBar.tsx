import type { ReactElement, ReactNode } from 'react'

export function AppTopBar ({ action }: { action: ReactNode }): ReactElement {
  return (
    <header className='app-topbar'>
      <p className='app-brand'>dish-list</p>
      {action}
    </header>
  )
}
