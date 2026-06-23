import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `You are Sage, an EHS chemical safety specialist. A worker has uploaded a manufacturer's Safety Data Sheet (SDS) PDF. Your job is to extract ALL 16 GHS-standard sections into a structured format.

CRITICAL INSTRUCTIONS:
1. Extract data EXACTLY as printed on the SDS. Do not paraphrase or summarize safety-critical fields (first aid measures, exposure limits, PPE requirements). Copy them verbatim where possible.
2. For each field you extract, assign a confidence score from 0.0 to 1.0:
   - 1.0: Clearly printed, unambiguous, standard location in the SDS
   - 0.8-0.9: Readable but in a non-standard location or format
   - 0.5-0.7: Partially legible, inferred from context, or found in an unexpected section
   - Below 0.5: Guessed or not found (use empty string and flag for human review)
3. CAS numbers must match the format XXXXX-XX-X (digits with two dashes). If you cannot confidently read the CAS number, leave it empty — a wrong CAS number is worse than none.
4. GHS classification: Map the pictograms and hazard codes to the standard pictogram IDs (GHS01 through GHS09).
5. If the PDF is not an SDS (e.g., a random document, a TDS, a product brochure), set productName to "" and return empty arrays.
6. For the sections array, include all 16 standard GHS sections. If a section is not present in the SDS, include it with an empty content string.

COMMON SDS FORMATS: Manufacturers use varying layouts. The 16-section GHS structure is standard but presentation differs. Section headers may be numbered ("SECTION 8") or named ("Exposure Controls"). Some SDSs combine sections. Always try to locate the data even if the format is non-standard.`

const ParsedSdsSchema = z.object({
  productName: z.string(),
  manufacturer: z.string(),
  emergencyPhone: z.string(),
  casNumbers: z.array(z.string()),
  signalWord: z.enum(['Danger', 'Warning', 'None']),
  pictograms: z.array(z.enum([
    'GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05',
    'GHS06', 'GHS07', 'GHS08', 'GHS09',
  ])),
  hazardStatements: z.array(z.string()),
  precautionaryStatements: z.array(z.string()),
  firstAid: z.object({
    inhalation: z.string(),
    skin: z.string(),
    eyes: z.string(),
    ingestion: z.string(),
  }),
  ppeRequired: z.array(z.string()),
  fireExtinguishing: z.string(),
  spillProcedure: z.string(),
  storageHandling: z.string(),
  sections: z.array(z.object({
    number: z.number(),
    title: z.string(),
    content: z.string(),
  })),
  confidence: z.object({
    identification: z.number(),
    hazardClassification: z.number(),
    composition: z.number(),
    firstAid: z.number(),
    fireFighting: z.number(),
    spillResponse: z.number(),
    handlingStorage: z.number(),
    exposureControls: z.number(),
    physicalProperties: z.number(),
    stability: z.number(),
    toxicological: z.number(),
    transport: z.number(),
    overall: z.number(),
  }),
})

export type ParsedSds = z.infer<typeof ParsedSdsSchema>

export const maxDuration = 120

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`sds-parse:${session?.user?.email || 'unknown'}`, 3, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json({ error: 'AI assistant not configured' }, { status: 503 })
  }

  let body: { documentBase64?: string; fileName?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const documentBase64 = (body.documentBase64 ?? '').trim()
  if (!documentBase64) {
    return Response.json({ error: 'No PDF provided' }, { status: 400 })
  }
  if (documentBase64.length > 5_600_000) {
    return Response.json({ error: 'PDF too large — keep it under 4MB' }, { status: 413 })
  }

  const fileName = (body.fileName ?? 'uploaded SDS').slice(0, 200)

  const content: Anthropic.MessageParam['content'] = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: documentBase64 },
    },
    {
      type: 'text',
      text: `Extract all 16 GHS sections from this Safety Data Sheet ("${fileName}"). Include confidence scores for each section.`,
    },
  ]

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      output_config: { format: zodOutputFormat(ParsedSdsSchema) },
    })

    const result = message.parsed_output
    if (!result || !result.productName) {
      return Response.json(
        { error: 'Could not identify this as an SDS. Make sure the uploaded PDF is a manufacturer Safety Data Sheet.' },
        { status: 422 }
      )
    }

    const lowConfidenceSections = Object.entries(result.confidence)
      .filter(([k, v]) => k !== 'overall' && (v as number) < 0.7)
      .map(([k]) => k)

    return Response.json({
      ...result,
      _reviewRequired: lowConfidenceSections.length > 0,
      _lowConfidenceSections: lowConfidenceSections,
    })
  } catch (err) {
    console.error('[sage] sds-parse failed:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Sage is temporarily unavailable' }, { status: 502 })
  }
}
