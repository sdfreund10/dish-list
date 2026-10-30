import { type ReactElement } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'

export default function App (): ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path='/' element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
