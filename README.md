# vixn

Offline-first workout tracker. Mobile-first PWA you install on your phone:
build workout templates, record results set-by-set, and watch your progress per
exercise — all stored locally, works offline.

## Features

- **Упражнения** — library of exercises; each one declares which metrics a set
  records (weight / reps / duration / distance).
- **Тренировки** — templates assembled from library exercises with a per-item
  set count.
- **Запись тренировки** — step-by-step wizard (exercise → set), autosaved to
  IndexedDB on every change, with resume of an interrupted workout and
  prefill-from-previous-set.
- **Прогресс** — per-exercise line chart with a metric switcher (cross-workout),
  plus full workout history.

## Stack

SPA · React + TypeScript · [TanStack Router](https://tanstack.com/router)
(file-based, clean URLs) · Zod · Zustand · localforage (IndexedDB) ·
Tailwind v4 + shadcn · Recharts · `vite-plugin-pwa` · Vite.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/vixn/
npm run test       # vitest
npm run build      # vite build (+ tsc), emits dist/ with SW, manifest, 404.html
npm run preview    # serve the production build
```

## Architecture

```
src/
  domain/        zod schemas + metric/session/progress logic (pure, tested)
  db/            localforage stores + validated repositories
  stores/        zustand (active workout w/ autosave)
  routes/        TanStack Router file routes
  features/      screen-specific UI (exercises, templates, workout, progress)
  components/    ui (shadcn) + layout primitives
```

Reads go through route `loader`s; writes go through repositories followed by
`router.invalidate()`. Every record is re-validated with Zod on read, so a
corrupt row in IndexedDB can never crash the UI.

## Deployment (GitHub Pages)

The app is configured for a project page at **`/vixn/`** (see `base` in
`vite.config.ts` and `scope`/`start_url` in the manifest).

1. Create a GitHub repository named **`vixn`** and push this code to `main`.
   (Using a different name? Update `BASE` in `vite.config.ts` to `/<repo>/`.)
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs tests,
   builds, and deploys. The app will be at `https://<user>.github.io/vixn/`.

Clean URLs work on Pages via a generated `404.html` (a copy of `index.html`)
that lets the client router resolve deep links.
