import { importAll, type Backup } from '@/db/backup'
import { flushPendingSave, useActiveWorkout } from './activeWorkout'

export async function importBackup(backup: Backup) {
  // Local edits must reach storage before merge decides which version wins.
  // Only replace the in-memory workout after a successful import.
  await flushPendingSave()
  const result = await importAll(backup)
  await useActiveWorkout.getState().loadActive()
  return result
}
