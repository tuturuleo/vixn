import { createRootRoute, Outlet } from '@tanstack/react-router'
import { BottomNav } from '@/components/layout/BottomNav'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main
        className="flex-1 px-4 pt-4"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
