"use client"

import React from "react"
import DonutChart from "./DonutChart"
import type { USAProfile } from "@/lib/pike13"

type VerifyRow = {
  person_id: number
  usa_member_id: string
  sanitized_id?: string
  was_sanitized?: boolean
  id_length_ok?: boolean
  first_name?: string
  last_name?: string
  email?: string | null
  found: boolean
  match_method?: 'id' | 'name+club'
  fallback_used?: boolean
  club_matched?: boolean
  matched_club?: string
  resolved_member_id?: string
  rowText?: string
  profileUrl?: string
  error?: string
}

export default function USAStatsClient({
  infoText,
  totals,
  people,
  verifyResults,
}: {
  infoText: React.ReactNode
  totals: { verified: number; rightly: number; wrong: number; invalid: number }
  people: USAProfile[]
  verifyResults: VerifyRow[]
}) {
  const [category, setCategory] = React.useState<null | 'verified' | 'rightly' | 'wrong' | 'invalid'>(null)

  // Measure left column height and sync chart height on lg+ screens
  const leftRef = React.useRef<HTMLDivElement | null>(null)
  const [sectionHeight, setSectionHeight] = React.useState<number | null>(null)
  const [useFixedHeight, setUseFixedHeight] = React.useState<boolean>(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 1024px)') // lg breakpoint
    const update = () => setUseFixedHeight(mql.matches)
    update()
    mql.addEventListener ? mql.addEventListener('change', update) : mql.addListener(update)
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', update) : mql.removeListener(update)
    }
  }, [])

  React.useEffect(() => {
    if (!useFixedHeight) {
      setSectionHeight(null)
      return
    }
    const el = leftRef.current
    if (!el || typeof window === 'undefined') return
    const ro = new ResizeObserver(() => setSectionHeight(el.offsetHeight))
    ro.observe(el)
    setSectionHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [useFixedHeight])

  const colors: Record<string, string> = {
    verified: '#16a34a', // green-600
    rightly: '#2563eb',  // blue-600
    wrong: '#dc2626',    // red-600
    invalid: '#f59e0b',  // amber-500
  }
  const tiles = [
    { key: 'verified' as const, label: 'Verified', value: totals.verified, color: colors.verified },
    { key: 'rightly' as const, label: 'Pike13 USA ID matches Verified USA ID', value: totals.rightly, color: colors.rightly },
    { key: 'wrong' as const, label: 'Verified USA ID but incorrect Pike13 USA ID', value: totals.wrong, color: colors.wrong },
    { key: 'invalid' as const, label: 'Invalid numbers', value: totals.invalid, color: colors.invalid },
  ]

  return (
    <div className="space-y-3">
      {/* Top: side-by-side info + tiles on left, chart on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div ref={leftRef} className="space-y-4">
          <div className="text-sm text-gray-700">{infoText}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tiles.map((d) => (
              <button
                key={d.key}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                  category === d.key ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setCategory(category === d.key ? null : d.key)}
              >
                <span className="text-sm font-medium" style={{ color: d.color }}>{d.label}</span>
                <span className="text-lg font-bold">{d.value}</span>
              </button>
            ))}
          </div>
        </div>

        <DonutChart totals={totals} category={category} onCategoryChange={setCategory} fixedHeight={useFixedHeight ? sectionHeight ?? undefined : undefined} />
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        Tip: Click the chart or a stat card to toggle a filter. Filter affects the table below.
      </div>

      <FilteredPeopleTable people={people} verifyResults={verifyResults} category={category} />
    </div>
  )
}

function FilteredPeopleTable({ people, verifyResults, category, pageSize = 50 }: {
  people: USAProfile[]
  verifyResults: VerifyRow[]
  category?: 'verified' | 'rightly' | 'wrong' | 'invalid' | null
  pageSize?: number
}) {
  const [page, setPage] = React.useState<number>(1)
  const byPersonId = React.useMemo(() => {
    const m = new Map<number, VerifyRow>()
    for (const r of verifyResults) m.set(Number(r.person_id), r)
    return m
  }, [verifyResults])

  const filtered = React.useMemo(() => {
    const out: USAProfile[] = []
    for (const p of people) {
      const rec = byPersonId.get(Number(p.person_id))
      const hasId = !!p.usa_member_id
      const isVerified = !!rec?.found
      const isRight = isVerified && rec?.match_method === 'id'
      const isWrong = isVerified && rec?.match_method === 'name+club' && rec?.resolved_member_id && rec?.resolved_member_id !== rec?.sanitized_id
      const isInvalid = hasId && rec ? (rec.id_length_ok === false || (!rec.found && rec.match_method !== 'id')) : false

      if (!category) {
        out.push(p)
      } else if (category === 'verified' && isVerified) {
        out.push(p)
      } else if (category === 'rightly' && isRight) {
        out.push(p)
      } else if (category === 'wrong' && isWrong) {
        out.push(p)
      } else if (category === 'invalid' && isInvalid) {
        out.push(p)
      }
    }
    return out
  }, [people, byPersonId, category])

  React.useEffect(() => { setPage(1) }, [category])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, total)
  const pagePeople = filtered.slice(start, end)

  return (
    <div className="mt-4">
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Person ID</th>
              <th className="px-3 py-2 text-left font-medium">First</th>
              <th className="px-3 py-2 text-left font-medium">Last</th>
              <th className="px-3 py-2 text-left font-medium">Pike13 USA ID</th>
              <th className="px-3 py-2 text-left font-medium">Verified USA ID</th>
              <th className="px-3 py-2 text-left font-medium">Verified</th>
            </tr>
          </thead>
          <tbody>
            {pagePeople.map((p) => {
              const rec = byPersonId.get(Number(p.person_id))
              const hasId = !!p.usa_member_id
              const idInvalid = hasId && rec ? (rec.id_length_ok === false || (!rec.found && rec.match_method !== 'id')) : false
              const verifiedId = rec?.found ? (rec?.resolved_member_id || rec?.sanitized_id || '') : ''
              return (
                <tr key={p.person_id} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2">{p.person_id}</td>
                  <td className="px-3 py-2">{p.first_name || ""}</td>
                  <td className="px-3 py-2">{p.last_name || ""}</td>
                  <td className="px-3 py-2">{p.usa_member_id || "—"}</td>
                  <td className="px-3 py-2">{verifiedId || "—"}</td>
                  <td className="px-3 py-2">{rec ? (rec.found ? 'Yes' : 'No') : (hasId ? 'Pending' : '—')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <button
          className={`px-3 py-2 rounded-md border ${page > 1 ? 'hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}
          onClick={() => page > 1 && setPage(page - 1)}
          disabled={page <= 1}
        >
          ← Previous
        </button>
        <button className="px-3 py-2 rounded-md border bg-white" disabled>
          Page {page} of {totalPages} • Showing {total ? start + 1 : 0}–{end} of {total}
        </button>
        <button
          className={`px-3 py-2 rounded-md border ${page < totalPages ? 'hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}
          onClick={() => page < totalPages && setPage(page + 1)}
          disabled={page >= totalPages}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
