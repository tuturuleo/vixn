export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms)
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(ms)
}

/** Human duration like "45 мин" or "1 ч 05 мин". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  if (totalMin < 60) return `${totalMin} мин`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h} ч ${String(m).padStart(2, '0')} мин`
}
