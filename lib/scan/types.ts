export type ScanStage = 'crawl' | 'diff' | 'ai' | 'db'

export type ScanError = {
  url?: string
  stage: ScanStage
  message: string
}

/**
 * Summary returned after a scan completes.
 * Partial failures are captured in `errors` — the scan still completes.
 */
export type ScanSummary = {
  scanId: string
  competitorId: string
  competitorName: string
  status: 'completed' | 'failed'
  pagesFound: number
  pagesChanged: number
  newPages: number
  dataPointsExtracted: number
  insightsGenerated: boolean
  errors: ScanError[]
  durationMs: number
}

export type RunScanOptions = {
  /**
   * Re-run the AI pipeline even if no page changes are detected.
   * Useful when criteria have changed or you want to re-extract from existing content.
   */
  force?: boolean
  /**
   * Skip writing to the database. Useful for testing the pipeline end-to-end.
   */
  dryRun?: boolean
}
