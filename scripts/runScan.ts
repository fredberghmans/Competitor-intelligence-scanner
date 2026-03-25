/**
 * Scan runner CLI
 *
 * Usage:
 *   npx tsx scripts/runScan.ts                    # scan all competitors
 *   npx tsx scripts/runScan.ts <competitor-id>    # scan one competitor
 *   npx tsx scripts/runScan.ts <id> --dry-run     # run without DB writes
 *   npx tsx scripts/runScan.ts --all --force      # re-process all, ignore unchanged
 *
 * Or add to package.json scripts:
 *   "scan": "tsx scripts/runScan.ts"
 *   "scan:dry": "tsx scripts/runScan.ts --dry-run"
 */

// Load .env.local before importing anything that needs env vars
import { config } from 'dotenv'
config({ path: '.env.local' })

import { runScanForCompetitor, runScanForAll } from '@/lib/scan'
import type { RunScanOptions } from '@/lib/scan'

async function main() {
  const args = process.argv.slice(2)

  const options: RunScanOptions = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  }

  if (options.dryRun) console.log('[scan] DRY RUN — no DB writes\n')
  if (options.force) console.log('[scan] FORCE mode — re-processing all pages\n')

  // Filter out flag args to find the optional competitor ID
  const competitorId = args.find((a) => !a.startsWith('--'))

  try {
    if (competitorId) {
      await runScanForCompetitor(competitorId, options)
    } else {
      const results = await runScanForAll(options)

      // Final multi-competitor summary
      const total = results.length
      const succeeded = results.filter((r) => r.status === 'completed').length
      const totalPages = results.reduce((s, r) => s + r.pagesFound, 0)
      const totalDataPoints = results.reduce((s, r) => s + r.dataPointsExtracted, 0)

      console.log(`All scans complete: ${succeeded}/${total} succeeded`)
      console.log(`Total pages processed: ${totalPages}`)
      console.log(`Total data points extracted: ${totalDataPoints}`)
    }

    process.exit(0)
  } catch (err) {
    console.error('\n[scan] Fatal error:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
