import { Link } from '@tanstack/react-router'
import { Dumbbell, ListChecks, Activity, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/', label: 'Старт', icon: Dumbbell },
  { to: '/templates', label: 'Тренировки', icon: ListChecks },
  { to: '/exercises', label: 'Упражнения', icon: Activity },
  { to: '/progress', label: 'Прогресс', icon: LineChart },
] as const

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === '/' }}
              className="flex flex-col items-center gap-1 py-2 text-muted-foreground"
              activeProps={{ className: 'text-primary' }}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn('size-6', isActive && 'fill-primary/15')}
                    strokeWidth={isActive ? 2.4 : 1.8}
                  />
                  <span className="text-[11px] font-medium">{label}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
