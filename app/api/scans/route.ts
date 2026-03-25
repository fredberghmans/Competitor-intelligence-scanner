import { NextRequest, NextResponse } from 'next/server'
import { runScanForCompetitor, runScanForAll } from '@/lib/scan'

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
    const body = await req.json().catch(() => ({}))
    const { competitorId } = body as { competitorId?: string }

    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'
    const force = req.nextUrl.searchParams.get('force') === 'true'
    const options = { dryRun, force }

    if (competitorId) {
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
