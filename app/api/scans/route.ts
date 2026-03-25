import { NextRequest, NextResponse } from 'next/server'
import { runScanForCompetitor, runScanForAll, runResearchForCompetitor } from '@/lib/scan'
import { researchCompetitor } from '@/lib/research'
import { getCompetitor } from '@/lib/competitors'
import { getCriteria } from '@/lib/criteria'
import { createScan, updateScanStatus } from '@/lib/scan/db'
import { saveDataPoints, saveInsights } from '@/lib/ai'
import { generateInsights } from '@/lib/ai/insights'
import { createClient } from '@/lib/supabase/server'
import type { ResearchProgress } from '@/lib/research'

/**
 * POST /api/scans
 *
 * Triggers a scan for one or all competitors.
 *
 * Body (JSON):
 *   { competitorId: string }   → scan one competitor
 *   {}                         → scan all competitors
 *
 * Query params:
 *   ?dryRun=true               → run without DB writes
 *   ?force=true                → re-process even unchanged pages
 *
 * Note: Vercel Hobby has a 10s function timeout. For production use
 * the CLI (`npm run scan`) or upgrade to Pro (60s) / use background jobs.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the request comes from an authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { competitorId } = body as { competitorId?: string }

    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'
    const force = req.nextUrl.searchParams.get('force') === 'true'
    const mode = req.nextUrl.searchParams.get('mode') ?? 'crawl' // 'crawl' | 'research' | 'both'
    const options = { dryRun, force }

    if (competitorId) {
      if (mode === 'research') {
        // Stream SSE progress events so the UI can show turn-by-turn feedback
        return streamResearch(competitorId, options)
      }
      if (mode === 'both') {
        const crawlSummary = await runScanForCompetitor(competitorId, options)
        const researchSummary = await runResearchForCompetitor(competitorId, options)
        return NextResponse.json({ ok: true, crawl: crawlSummary, research: researchSummary })
      }
      // default: 'crawl'
      const summary = await runScanForCompetitor(competitorId, options)
      return NextResponse.json({ ok: true, summary })
    }

    const summaries = await runScanForAll(options)
    return NextResponse.json({ ok: true, summaries })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/scans]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * Runs the research agent and streams Server-Sent Events so the client
 * can display turn-by-turn progress instead of a blank spinner.
 *
 * Event types:
 *   data: {"type":"turn","turn":1,"maxTurns":10,"query":"..."}
 *   data: {"type":"done","dataPoints":5,"sourcesVisited":3}
 *   data: {"type":"error","message":"..."}
 *   data: {"type":"result","summary":{...}}  ← final summary, always last
 */
function streamResearch(
  competitorId: string,
  options: { dryRun?: boolean; force?: boolean },
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: ResearchProgress | { type: 'result'; summary: unknown }) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        const competitor = await getCompetitor(competitorId)
        if (!competitor) throw new Error(`Competitor not found: ${competitorId}`)

        const criteria = await getCriteria()
        const scan = await createScan(competitorId)

        const { dataPoints, sourcesVisited } = await researchCompetitor(
          competitor,
          criteria,
          {
            onProgress: (event) => send(event),
          },
        )

        const validPoints = dataPoints.filter((d) => d.criteria_id)

        if (!options.dryRun && validPoints.length > 0) {
          await saveDataPoints(competitor.id, scan.id, validPoints)
          const insights = await generateInsights(competitor.name, validPoints)
          if (insights) await saveInsights(competitor.id, scan.id, insights)
        }

        if (!options.dryRun) await updateScanStatus(scan.id, 'completed')

        send({
          type: 'result',
          summary: {
            scanId: scan.id,
            competitorId,
            status: 'completed',
            pagesFound: sourcesVisited.length,
            dataPointsExtracted: validPoints.length,
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[streamResearch]', message)
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
