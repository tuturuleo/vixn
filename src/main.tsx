import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'
import './styles/index.css'

// Vite's BASE_URL is '/vixn/'; the router wants it without the trailing slash.
const basepath = import.meta.env.BASE_URL.replace(/\/$/, '')

const router = createRouter({
  routeTree,
  basepath,
  defaultPreload: 'intent',
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
