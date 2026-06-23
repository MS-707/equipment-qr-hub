import { z } from 'zod'
import type { SdsRecord } from '@/lib/sds-types'

const GhsPictogramCodeSchema = z.enum([
  'GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05',
  'GHS06', 'GHS07', 'GHS08', 'GHS09',
])

const SignalWordSchema = z.enum(['Danger', 'Warning', 'None'])

const SyncStatusSchema = z.enum(['pending', 'synced', 'failed', 'offline'])

const FirstAidByRouteSchema = z.object({
  inhalation: z.string(),
  skin: z.string(),
  eyes: z.string(),
  ingestion: z.string(),
}).passthrough()

const SdsSectionSchema = z.object({
  number: z.number(),
  title: z.string(),
  content: z.string(),
}).passthrough()

export const SdsRecordSchema = z.object({
  id: z.string(),
  productName: z.string(),
  manufacturer: z.string(),
  casNumbers: z.array(z.string()),
  signalWord: SignalWordSchema,
  pictograms: z.array(GhsPictogramCodeSchema),
  hazardStatements: z.array(z.string()),
  precautionaryStatements: z.array(z.string()),
  firstAid: FirstAidByRouteSchema,
  ppeRequired: z.array(z.string()),
  fireExtinguishing: z.string(),
  spillProcedure: z.string(),
  storageHandling: z.string(),
  emergencyPhone: z.string(),
  sections: z.array(SdsSectionSchema),
  isFavorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  syncStatus: SyncStatusSchema,
  _searchIndex: z.string(),
}).passthrough()

export function safeParseSdsRecords(raw: string): SdsRecord[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid: SdsRecord[] = []
    for (let i = 0; i < parsed.length; i++) {
      const result = SdsRecordSchema.safeParse(parsed[i])
      if (result.success) {
        valid.push(result.data as SdsRecord)
      } else {
        console.warn(
          `[sds-records] Dropped invalid record at index ${i}` +
          (parsed[i]?.id ? ` (id=${parsed[i].id})` : '') +
          ':',
          result.error.issues[0]?.message,
        )
      }
    }
    return valid
  } catch {
    return []
  }
}
