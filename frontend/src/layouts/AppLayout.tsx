import { type ReactElement } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { SwipeExperience } from '../swipe/SwipeExperience'

export function AppLayout (): ReactElement {
  return (
    <SwipeExperience>
      <div className='app-shell'>
        <header className='app-header'>
          <Link className='app-brand' to='/'>dish-list</Link>
        </header>
        <main className='app-main'>
          <Outlet />
        </main>
      </div>
    </SwipeExperience>
  )
}
