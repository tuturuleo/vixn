import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Small banner shown when the service worker has cached the app for offline use
 * or when a new version is ready. Sits above the bottom navigation.
 */
export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div
      className="fixed inset-x-0 z-50 mx-auto flex max-w-md items-center gap-3 px-4"
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        <span className="flex-1 text-sm">
          {needRefresh ? 'Доступно обновление' : 'Готово к работе офлайн'}
        </span>
        {needRefresh && (
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            <RefreshCw className="size-4" />
            Обновить
          </Button>
        )}
        <button
          onClick={close}
          aria-label="Закрыть"
          className="text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
