import { Loader2 } from 'lucide-react'

export function Spinner() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <Loader2 className="size-7 animate-spin text-muted-foreground" />
    </div>
  )
}
