import { type ReactElement } from 'react'
import { Outlet, useMatch } from 'react-router-dom'

export function AppLayout (): ReactElement {
  const isHome = useMatch({ path: '/', end: true }) != null
  const isPlan = useMatch({ path: '/plan', end: true }) != null
  const showDefaultHeader = !isHome && !isPlan

  return (
    <div className='app-shell'>
      {showDefaultHeader && (
        <header className='app-header'>
          <p className='app-brand'>dish-list</p>
        </header>
      )}
      <main className='app-main'>
        <Outlet />
      </main>
    </div>
  )
}
