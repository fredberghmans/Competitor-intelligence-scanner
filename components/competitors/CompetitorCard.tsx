'use client'

import Link from 'next/link'
import { useTransition, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Globe, MapPin, Play, CheckCircle, AlertCircle, Loader2, Lightbulb, TableProperties, ChevronDown } from 'lucide-react'
import Badge, { competitorTypeBadge, competitorTypeLabel } from '@/components/ui/badge'
import { deleteCompetitorAction } from '@/lib/actions/competitors'
import type { Competitor, Scan } from '@/lib/supabase/types'

type ScanStatus = 'idle' | 'running' | 'done' | 'error'

function ScanStatusBadge({ scan }: { scan: Scan }) {
  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const ts = scan.completed_at ?? scan.started_at ?? scan.created_at

  if (scan.status === 'running' || scan.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
        <Loader2 size={10} className="animate-spin" />
        Scanning…
      </span>
    )
  }
  if (scan.status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
        <CheckCircle size={10} />
        Scanned {relativeTime(ts)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
      <AlertCircle size={10} />
      Failed {relativeTime(ts)}
    </span>
  )
}

export default function CompetitorCard({
  competitor,
  latestScan,
}: {
  competitor: Competitor
  latestScan: Scan | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [scanMessage, setScanMessage] = useState<string>('')
  const [scanMode, setScanMode] = useState<'crawl' | 'research' | 'both'>('crawl')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  function handleDelete() {
    if (!confirm(`Delete "${competitor.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteCompetitorAction(competitor.id)
      router.refresh()
    })
  }

  async function handleRunScan(mode: 'crawl' | 'research' | 'both' = scanMode) {
    setScanStatus('running')
    setScanMessage(mode === 'research' ? 'Starting…' : '')
    setDropdownOpen(false)
    try {
      const res = await fetch(`/api/scans?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorId: competitor.id }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setScanStatus('error')
        setScanMessage(data?.error ?? 'Scan failed')
        return
      }

      // Research mode streams SSE — read progress events in real time
      if (mode === 'research' && res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type === 'turn') {
                const label = event.query ? `"${event.query.slice(0, 40)}${event.query.length > 40 ? '…' : ''}"` : 'searching…'
                setScanMessage(`Turn ${event.turn}/${event.maxTurns} · ${label}`)
              } else if (event.type === 'result') {
                setScanStatus('done')
                const s = event.summary
                setScanMessage(
                  s ? `${s.dataPointsExtracted ?? 0} extracted · ${s.pagesFound ?? 0} sources` : 'Research complete'
                )
                router.refresh()
              } else if (event.type === 'error') {
                setScanStatus('error')
                setScanMessage(event.message ?? 'Research failed')
              }
            } catch {
              // malformed event line — skip
            }
          }
        }
        return
      }

      // Crawl mode (or both) — regular JSON response
      const data = await res.json()
      setScanStatus('done')
      const summary = data?.summary ?? data?.crawl
      setScanMessage(
        summary
          ? `${summary.pagesFound ?? 0} pages · ${summary.dataPointsExtracted ?? summary.pagesChanged ?? 0} extracted`
          : 'Scan complete'
      )
      router.refresh()
    } catch {
      setScanStatus('error')
      setScanMessage('Network error')
    }
  }

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4 transition-opacity ${
        isPending ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-base truncate">
            {competitor.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">{competitor.region}</span>
          </div>
        </div>
        <Badge variant={competitorTypeBadge(competitor.type)}>
          {competitorTypeLabel(competitor.type)}
        </Badge>
      </div>

      {/* Domains */}
      {competitor.domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {competitor.domains.map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded-md transition-colors max-w-[180px]"
            >
              <Globe size={10} className="shrink-0" />
              <span className="truncate">{d.label || d.url.replace(/^https?:\/\//, '')}</span>
            </a>
          ))}
        </div>
      )}

      {/* Scan status — inline feedback while running, DB badge otherwise */}
      {scanStatus === 'running' ? (
        <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-indigo-50 text-indigo-600">
          <Loader2 size={12} className="animate-spin shrink-0" />
          <span>Scanning…</span>
        </div>
      ) : scanStatus === 'done' ? (
        <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700">
          <CheckCircle size={12} className="shrink-0" />
          <span>{scanMessage}</span>
        </div>
      ) : scanStatus === 'error' ? (
        <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">
          <AlertCircle size={12} className="shrink-0" />
          <span>{scanMessage}</span>
        </div>
      ) : latestScan ? (
        <div>
          <ScanStatusBadge scan={latestScan} />
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        <Link
          href={`/competitors/${competitor.id}/edit`}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Pencil size={12} />
          Edit
        </Link>
        <Link
          href={`/competitors/${competitor.id}/insights`}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Lightbulb size={12} />
          Insights
        </Link>
        <Link
          href={`/competitors/${competitor.id}/data`}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <TableProperties size={12} />
          Data
        </Link>
        {/* Split scan button with mode dropdown */}
        <div className="relative flex items-center" ref={dropdownRef}>
          <button
            onClick={() => handleRunScan(scanMode)}
            disabled={scanStatus === 'running'}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 rounded-l-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanStatus === 'running' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            {scanStatus === 'running'
              ? 'Scanning…'
              : scanMode === 'research'
              ? 'Research'
              : scanMode === 'both'
              ? 'Crawl + Research'
              : 'Run Scan'}
          </button>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            disabled={scanStatus === 'running'}
            className="flex items-center px-1 py-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-r-lg border-l border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Choose scan mode"
          >
            <ChevronDown size={11} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
              {(
                [
                  { mode: 'crawl', label: 'Crawl', desc: 'Fast, static pages' },
                  { mode: 'research', label: 'Research', desc: 'AI web search' },
                  { mode: 'both', label: 'Crawl + Research', desc: 'Most thorough' },
                ] as const
              ).map(({ mode, label, desc }) => (
                <button
                  key={mode}
                  onClick={() => { setScanMode(mode); setDropdownOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                    scanMode === mode ? 'text-indigo-600 font-medium' : 'text-slate-700'
                  }`}
                >
                  <div>{label}</div>
                  <div className="text-slate-400 font-normal">{desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors ml-auto"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  )
}
