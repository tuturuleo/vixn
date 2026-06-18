import { z } from 'zod'
import { METRIC_TYPES } from './metrics'

export const metricTypeSchema = z.enum(METRIC_TYPES)

const epochMs = z.number().int().nonnegative()

// ── Exercise ────────────────────────────────────────────────────────────────
// A reusable library exercise. It owns its metric config (which fields a set
// records) but NOT the number of sets — that is decided per template.
export const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  metrics: z.array(metricTypeSchema).min(1),
  archived: z.boolean(),
  createdAt: epochMs,
  updatedAt: epochMs,
})
export type Exercise = z.infer<typeof exerciseSchema>

// ── Workout template ─────────────────────────────────────────────────────────
export const templateItemSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1),
  order: z.number().int().nonnegative(),
})
export type TemplateItem = z.infer<typeof templateItemSchema>

export const workoutTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  items: z.array(templateItemSchema),
  createdAt: epochMs,
  updatedAt: epochMs,
})
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>

// ── Workout session (recorded results) ───────────────────────────────────────
// Partial: a set only carries the metrics its exercise is configured for, and
// values may be missing while the workout is still in progress.
export const setValuesSchema = z.partialRecord(
  metricTypeSchema,
  z.number().nonnegative(),
)
export type SetValues = z.infer<typeof setValuesSchema>

export const setResultSchema = z.object({
  setIndex: z.number().int().nonnegative(),
  values: setValuesSchema,
})
export type SetResult = z.infer<typeof setResultSchema>

// Snapshots exerciseName + metrics so history survives later edits/deletes.
export const sessionEntrySchema = z.object({
  exerciseId: z.string().min(1),
  exerciseName: z.string().min(1),
  metrics: z.array(metricTypeSchema).min(1),
  order: z.number().int().nonnegative(),
  sets: z.array(setResultSchema),
})
export type SessionEntry = z.infer<typeof sessionEntrySchema>

export const sessionStatusSchema = z.enum(['in_progress', 'completed'])
export type SessionStatus = z.infer<typeof sessionStatusSchema>

export const sessionCursorSchema = z.object({
  entryIndex: z.number().int().nonnegative(),
  setIndex: z.number().int().nonnegative(),
})
export type SessionCursor = z.infer<typeof sessionCursorSchema>

export const workoutSessionSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  templateName: z.string().min(1),
  status: sessionStatusSchema,
  startedAt: epochMs,
  finishedAt: epochMs.nullable(),
  entries: z.array(sessionEntrySchema),
  cursor: sessionCursorSchema,
})
export type WorkoutSession = z.infer<typeof workoutSessionSchema>

export type { MetricType } from './metrics'
