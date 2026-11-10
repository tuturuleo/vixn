import { useRef, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Play, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sessionsRepo } from '@/db/repositories'
import { exportAll, importAll, parseBackup, serializeBackup } from '@/db/backup'

export const Route = createFileRoute('/')({
  loader: () => sessionsRepo.getActive(),
  component: HomePage,
})

function HomePage() {
  const active = Route.useLoaderData()
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    setMessage('')
    try {
      const backup = await exportAll()
      const blob = new Blob([serializeBackup(backup)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      try {
        link.href = url
        link.download = `vixn-backup-${new Date(backup.exportedAt).toISOString().slice(0, 10)}.json`
        document.body.appendChild(link)
        link.click()
      } finally {
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 0)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось экспортировать данные.')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(file: File) {
    setBusy(true)
    setMessage('')
    try {
      const backup = parseBackup(await file.text())
      const result = await importAll(backup)
      await router.invalidate()
      setMessage(`Импортировано: ${result.added}, обновлено: ${result.updated}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось импортировать данные.')
    } finally {
      setBusy(false)
    }
  }

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
      <section aria-labelledby="data-heading" className="w-full max-w-xs text-sm">
        <h2 id="data-heading" className="text-muted-foreground">Данные</h2>
        <div className="mt-2 flex justify-center gap-2">
          <Button variant="ghost" disabled={busy} onClick={handleExport}>
            Экспорт
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => fileInput.current?.click()}>
            Импорт
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Файл резервной копии"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void handleImport(file)
          }}
        />
        <p role="status" className="mt-2 break-words text-muted-foreground">{message}</p>
      </section>
    </div>
  )
}
