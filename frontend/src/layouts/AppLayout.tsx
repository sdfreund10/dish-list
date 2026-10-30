import { type ReactElement } from 'react'
import { Outlet } from 'react-router-dom'

export function AppLayout (): ReactElement {
  return (
    <div className='app-shell'>
      <header className='app-header'>
        <p className='app-brand'>dish-list</p>
      </header>
      <main className='app-main'>
        <Outlet />
      </main>
    </div>
  )
}
