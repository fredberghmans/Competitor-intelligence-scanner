import { getCompetitor } from '@/lib/competitors'
import { getCriteria } from '@/lib/criteria'
import { crawlCompetitor } from '@/lib/crawler'
import { splitIntoChunks, estimateTokens } from '@/lib/diff'
import { diffPages, storeChangeEvent, getPreviousPage, formatChunksForAI } from '@/lib/diff'
import { runPipeline, saveDataPoints, saveInsights } from '@/lib/ai'
import { generateInsights } from '@/lib/ai/insights'
import type { DiffChunk, DiffResult } from '@/lib/diff'
import { researchCompetitor } from '@/lib/research'
import { createScan, updateScanStatus, insertPage, getAllCompetitorIds } from './db'
import type { ScanSummary, ScanError, RunScanOptions } from './types'

export type { ScanSummary, RunScanOptions } from './types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs a full scan for a single competitor.
 *
 * FLOW PER COMPETITOR
 * ────────────────────
 * 1. Create scan record (status → running)
 * 2. Crawl all domains → CrawledPage[]
 * 3. For each page:
 *    a. Fetch previous snapshot from DB (if any)
 *    b. Diff: hash check → paragraph diff → changed_chunks
 *    c. Insert current page into DB
 *    d. If changed: store change_event + run AI pipeline
 * 4. Mark scan completed (or failed)
 *
 * PARTIAL FAILURE STRATEGY
 * ─────────────────────────
 * Errors on individual pages are collected in `errors[]` and logged, but
 * do NOT abort the scan. The scan continues and is marked 'completed'
 * even with partial failures — callers inspect `errors` to assess quality.
 * Only a failure at scan creation or completion triggers status 'failed'.
 */
export async function runScanForCompetitor(
  competitorId: string,
  options: RunScanOptions = {},
): Promise<ScanSummary> {
  const startTime = Date.now()
  const errors: ScanError[] = []

  // ── Load competitor and criteria ─────────────────────────────────────────
  const competitor = await getCompetitor(competitorId)
  if (!competitor) throw new Error(`Competitor not found: ${competitorId}`)

  const criteria = await getCriteria()

  log(`▶ Starting scan for ${competitor.name}`)

  // ── Create scan record ───────────────────────────────────────────────────
  const scan = await createScan(competitorId)
  log(`  Scan ID: ${scan.id}`)

  let pagesFound = 0
  let pagesChanged = 0
  let newPages = 0
  let dataPointsExtracted = 0
  let insightsGenerated = false

  try {
    // ── Crawl ──────────────────────────────────────────────────────────────
    log(`  Crawling ${competitor.domains.length} domain(s)…`)
    const { pages, errors: crawlErrors } = await crawlCompetitor(competitor, {
      competitorId: competitor.id,
      scanId: scan.id,
    })

    crawlErrors.forEach((e) =>
      errors.push({ url: e.url, stage: 'crawl', message: e.reason }),
    )

    pagesFound = pages.length
    log(`  Found ${pagesFound} page(s), ${crawlErrors.length} skipped`)

    // ── Process each page ──────────────────────────────────────────────────
    for (const page of pages) {
      try {
        log(`  Processing ${page.url}`)

        // Look up previous snapshot BEFORE inserting the current one
        const previous = options.dryRun
          ? null
          : await getPreviousPage(competitorId, page.url, scan.id)

        // Build diff result
        const diffResult: DiffResult = previous
          ? diffPages(previous, page)
          : buildNewPageDiff(page.cleaned_text)

        const isNew = !previous
        const label = isNew ? '[new page]' : diffResult.change_detected ? '[changed]' : '[unchanged]'
        log(`    ${label} ${page.url}`)

        // Persist the current page snapshot
        if (!options.dryRun) {
          const pageId = await insertPage(page)

          // Store change event for new or changed pages
          if (diffResult.change_detected) {
            await storeChangeEvent(pageId, scan.id, diffResult, isNew ? 'new_page' : 'content_changed')
          }
        }

        if (!diffResult.change_detected && !options.force) continue

        if (isNew) newPages++
        else pagesChanged++

        if (diffResult.changed_chunks.length === 0) continue

        // ── AI pipeline ─────────────────────────────────────────────────
        log(`    → AI pipeline: ${diffResult.changed_chunks.length} chunk(s), ~${diffResult.stats.estimated_tokens} tokens`)

        const result = await runPipeline(
          {
            competitor,
            pageUrl: page.url,
            changedChunks: diffResult.changed_chunks,
            criteria,
            scanId: scan.id,
          },
          !options.dryRun,
        )

        dataPointsExtracted += result.dataPoints.length
        if (result.insights) insightsGenerated = true

        if (!result.skipped) {
          log(`    → Extracted ${result.dataPoints.length} data point(s), insights: ${result.insights ? 'yes' : 'none'}`)
        } else {
          log(`    → Skipped (no relevant content after classification)`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push({ url: page.url, stage: 'diff', message })
        log(`    ✗ Error on ${page.url}: ${message}`)
      }
    }

    if (!options.dryRun) await updateScanStatus(scan.id, 'completed')

    const durationMs = Date.now() - startTime
    logSummary({ competitorName: competitor.name, pagesFound, pagesChanged, newPages, dataPointsExtracted, insightsGenerated, errors, durationMs })

    return {
      scanId: scan.id,
      competitorId,
      competitorName: competitor.name,
      status: 'completed',
      pagesFound,
      pagesChanged,
      newPages,
      dataPointsExtracted,
      insightsGenerated,
      errors,
      durationMs,
    }
  } catch (err) {
    if (!options.dryRun) {
      await updateScanStatus(scan.id, 'failed').catch(() => {})
    }
    throw err
  }
}

/**
 * Runs scans for ALL competitors in the database, sequentially.
 *
 * WHY SEQUENTIAL AND NOT PARALLEL
 * ─────────────────────────────────
 * Each scan makes multiple HTTP requests to external sites. Parallelising
 * across competitors would multiply outbound connections and risk triggering
 * rate limits on both the target sites and the Anthropic API.
 *
 * HOW TO BATCH AT SCALE
 * ──────────────────────
 * Option A — Chunked parallel (10–20 competitors):
 *   Use a concurrency limiter (e.g. p-limit) with N=3–5 concurrent scans.
 *   Each scan is still sequential internally per domain.
 *
 * Option B — Queue-based (100+ competitors):
 *   Push competitor IDs into a job queue (BullMQ, Supabase pg_cron, or
 *   a simple Supabase-backed queue table). Workers pull and process jobs
 *   independently, enabling horizontal scaling.
 *
 * Option C — Cron per competitor:
 *   Schedule individual scans with different offsets to spread load over
 *   a time window (e.g. scan competitor A at 02:00, B at 02:15, etc.).
 */
export async function runScanForAll(options: RunScanOptions = {}): Promise<ScanSummary[]> {
  const competitorIds = await getAllCompetitorIds()
  log(`Running scans for ${competitorIds.length} competitor(s)`)

  const results: ScanSummary[] = []

  for (const id of competitorIds) {
    try {
      const summary = await runScanForCompetitor(id, options)
      results.push(summary)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(`✗ Scan failed for competitor ${id}: ${message}`)
      results.push({
        scanId: 'unknown',
        competitorId: id,
        competitorName: id,
        status: 'failed',
        pagesFound: 0,
        pagesChanged: 0,
        newPages: 0,
        dataPointsExtracted: 0,
        insightsGenerated: false,
        errors: [{ stage: 'db', message }],
        durationMs: 0,
      })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Research Agent
// ---------------------------------------------------------------------------

/**
 * Runs the AI research agent for a single competitor.
 *
 * Instead of crawling pages, Claude uses the web_search tool to autonomously
 * find and extract data for each criterion — similar to how ChatGPT/Gemini
 * would research a company. More expensive but thorough, especially for
 * JS-heavy SPAs and PDF factsheets that the crawler can't reach.
 *
 * Triggered via POST /api/scans?mode=research
 */
export async function runResearchForCompetitor(
  competitorId: string,
  options: RunScanOptions = {},
): Promise<ScanSummary> {
  const startTime = Date.now()

  const competitor = await getCompetitor(competitorId)
  if (!competitor) throw new Error(`Competitor not found: ${competitorId}`)

  const criteria = await getCriteria()

  log(`▶ Starting research agent for ${competitor.name}`)

  const scan = await createScan(competitorId)
  log(`  Scan ID: ${scan.id}`)

  try {
    const { dataPoints, sourcesVisited, turnsUsed } = await researchCompetitor(competitor, criteria)

    log(`  Agent done — ${dataPoints.length} data point(s), ${turnsUsed} turn(s), ${sourcesVisited.length} source(s)`)

    const validPoints = dataPoints.filter((d) => d.criteria_id)
    const errors: ScanError[] = dataPoints
      .filter((d) => !d.criteria_id)
      .map((d) => ({ stage: 'ai' as const, message: `Unresolved criteria: ${d.criteria_name}` }))

    if (!options.dryRun && validPoints.length > 0) {
      await saveDataPoints(competitor.id, scan.id, validPoints)

      const insights = await generateInsights(competitor.name, validPoints)
      if (insights) await saveInsights(competitor.id, scan.id, insights)
    }

    if (!options.dryRun) await updateScanStatus(scan.id, 'completed')

    const durationMs = Date.now() - startTime
    return {
      scanId: scan.id,
      competitorId,
      competitorName: competitor.name,
      status: 'completed',
      pagesFound: sourcesVisited.length,
      pagesChanged: 0,
      newPages: 0,
      dataPointsExtracted: validPoints.length,
      insightsGenerated: false,
      errors,
      durationMs,
    }
  } catch (err) {
    if (!options.dryRun) await updateScanStatus(scan.id, 'failed').catch(() => {})
    throw err
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a synthetic DiffResult for a brand-new page (no previous snapshot).
 * All paragraphs are treated as 'added' chunks.
 */
function buildNewPageDiff(cleanedText: string): DiffResult {
  const chunks: DiffChunk[] = splitIntoChunks(cleanedText).map((content) => ({
    type: 'added',
    content,
  }))

  return {
    change_detected: true,
    change_summary: 'New page discovered',
    changed_chunks: chunks,
    stats: {
      added_paragraphs: chunks.length,
      removed_paragraphs: 0,
      total_chunks: chunks.length,
      estimated_tokens: estimateTokens(cleanedText),
    },
  }
}

function log(msg: string) {
  const ts = new Date().toISOString().substring(11, 19) // HH:MM:SS
  console.log(`[scan ${ts}] ${msg}`)
}

function logSummary(s: {
  competitorName: string
  pagesFound: number
  pagesChanged: number
  newPages: number
  dataPointsExtracted: number
  insightsGenerated: boolean
  errors: ScanError[]
  durationMs: number
}) {
  const line = '─'.repeat(48)
  console.log(`\n${line}`)
  console.log(`  Scan complete: ${s.competitorName}`)
  console.log(line)
  console.log(`  Pages found:         ${s.pagesFound}`)
  console.log(`  New pages:           ${s.newPages}`)
  console.log(`  Changed pages:       ${s.pagesChanged}`)
  console.log(`  Data points saved:   ${s.dataPointsExtracted}`)
  console.log(`  Insights generated:  ${s.insightsGenerated ? 'yes' : 'no'}`)
  console.log(`  Errors:              ${s.errors.length}`)
  console.log(`  Duration:            ${(s.durationMs / 1000).toFixed(1)}s`)
  if (s.errors.length > 0) {
    console.log(`\n  Errors:`)
    s.errors.forEach((e) => console.log(`    [${e.stage}] ${e.url ?? ''} — ${e.message}`))
  }
  console.log(line + '\n')
}
