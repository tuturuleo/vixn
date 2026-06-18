import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Check, Trash2, CalendarDays, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sessionsRepo } from '@/db/repositories'
import { formatDateTime, formatDuration } from '@/lib/datetime'
import { formatMetricValue } from '@/domain/metrics'

export const Route = createFileRoute('/workout/$sessionId')({
  loader: async ({ params }) => {
    const session = await sessionsRepo.get(params.sessionId)
    if (!session) throw redirect({ to: '/progress' })
    return session
  },
  component: SessionSummaryPage,
})

function SessionSummaryPage() {
  const session = Route.useLoaderData()
  const navigate = useNavigate()
  const finished = session.finishedAt ?? session.startedAt

  return (
    <div className="flex min-h-[80dvh] flex-col">
      <div className="mb-2 flex flex-col items-center gap-2 pt-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="size-7" strokeWidth={2.5} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          {session.templateName}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-4" />
            {formatDateTime(finished)}
          </span>
          {session.finishedAt && (
            <span className="flex items-center gap-1">
              <Clock className="size-4" />
              {formatDuration(session.finishedAt - session.startedAt)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        {session.entries.map((entry, i) => (
          <div
            key={`${entry.exerciseId}-${i}`}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="font-medium">{entry.exerciseName}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {entry.sets.map((set) => {
                const empty = Object.keys(set.values).length === 0
                return (
                  <li
                    key={set.setIndex}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      Подход {set.setIndex + 1}
                    </span>
                    <span className="tabular-nums">
                      {empty ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        entry.metrics
                          .filter((m) => set.values[m] != null)
                          .map((m) => formatMetricValue(m, set.values[m]!))
                          .join(' · ')
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Button size="lg" onClick={() => navigate({ to: '/' })}>
          Готово
        </Button>
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={async () => {
            await sessionsRepo.remove(session.id)
            navigate({ to: '/progress' })
          }}
        >
          <Trash2 className="size-4" />
          Удалить запись
        </Button>
      </div>
    </div>
  )
}
