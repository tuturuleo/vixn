import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'
import { Spinner } from './components/layout/Spinner'
import { flushPendingSave } from './stores/activeWorkout'
import './styles/index.css'

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushPendingSave()
})
window.addEventListener('pagehide', () => void flushPendingSave())

// Vite's BASE_URL is '/vixn/'; the router wants it without the trailing slash.
const basepath = import.meta.env.BASE_URL.replace(/\/$/, '')

const router = createRouter({
  routeTree,
  basepath,
  defaultPreload: 'intent',
  defaultPendingComponent: Spinner,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
