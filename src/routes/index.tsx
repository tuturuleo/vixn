import { createFileRoute, Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 text-center">
      <div>
        <p className="text-5xl font-black tracking-tight text-primary">vixn</p>
        <p className="mt-1 text-sm text-muted-foreground">
          трекер тренировок · offline-first
        </p>
      </div>
      <Button asChild size="xl" className="w-full max-w-xs">
        <Link to="/workout/start">
          <Play className="size-5" />
          Начать тренировку
        </Link>
      </Button>
    </div>
  )
}
