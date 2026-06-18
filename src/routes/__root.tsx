import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import { BottomNav } from '@/components/layout/BottomNav'
import { ReloadPrompt } from '@/components/ReloadPrompt'
import { Button } from '@/components/ui/button'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
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
      <ReloadPrompt />
      <BottomNav />
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-semibold">Страница не найдена</p>
      <Button asChild>
        <Link to="/">На главную</Link>
      </Button>
    </div>
  )
}
