import { createFileRoute, Link } from '@tanstack/react-router'
import { Play, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sessionsRepo } from '@/db/repositories'

export const Route = createFileRoute('/')({
  loader: () => sessionsRepo.getActive(),
  component: HomePage,
})

function HomePage() {
  const active = Route.useLoaderData()

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 text-center">
      <div>
        <p className="text-5xl font-black tracking-tight text-primary">vixn</p>
        <p className="mt-1 text-sm text-muted-foreground">
          трекер тренировок · offline-first
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {active && (
          <Link
            to="/workout/active"
            className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-left active:scale-[0.99]"
          >
            <History className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">Продолжить тренировку</p>
              <p className="truncate text-xs text-muted-foreground">
                {active.templateName}
              </p>
            </div>
            <Play className="size-5 text-primary" />
          </Link>
        )}

        <Button asChild size="xl">
          <Link to="/workout/start">
            <Play className="size-5" />
            Начать тренировку
          </Link>
        </Button>
      </div>
    </div>
  )
}
