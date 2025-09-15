"use client"

import React from "react"
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

export default function ChartAndFilter({
  totals,
  people,
  verifyResults,
  headerText,
}: {
  totals: { verified: number; rightly: number; wrong: number; invalid: number }
  people: USAProfile[]
  verifyResults: VerifyRow[]
  headerText?: React.ReactNode
}) {
  const [category, setCategory] = React.useState<null | 'verified' | 'rightly' | 'wrong' | 'invalid'>(null)
  // Measure left content height and lock the whole section to that height on md+ screens
  const leftRef = React.useRef<HTMLDivElement | null>(null)
  const [sectionHeight, setSectionHeight] = React.useState<number | null>(null)
  const [useFixedHeight, setUseFixedHeight] = React.useState<boolean>(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 1024px)') // Changed to lg breakpoint
    const updateMedia = () => setUseFixedHeight(mql.matches)
    updateMedia()
    mql.addEventListener ? mql.addEventListener('change', updateMedia) : mql.addListener(updateMedia)
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', updateMedia) : mql.removeListener(updateMedia)
    }
  }, [])

  React.useEffect(() => {
    if (!useFixedHeight) {
      setSectionHeight(null)
      return
    }
    const el = leftRef.current
    if (!el || typeof window === 'undefined') return
    const ro = new ResizeObserver(() => {
      // Use offsetHeight to include borders/padding
      setSectionHeight(el.offsetHeight)
    })
    ro.observe(el)
    // Initialize
    setSectionHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [useFixedHeight])

  const colors: Record<string, string> = {
    verified: '#16a34a', // green-600
    rightly: '#2563eb',  // blue-600
    wrong: '#dc2626',    // red-600
    invalid: '#f59e0b',  // amber-500
  }
  // Prepare labels for tiles/legend
  const tiles = [
    { key: 'verified' as const, label: 'Verified', value: totals.verified, color: colors.verified },
    { key: 'invalid' as const, label: 'Invalid numbers', value: totals.invalid, color: colors.invalid },
    { key: 'rightly' as const, label: 'Pike13 USA ID matches Verified USA ID', value: totals.rightly, color: colors.rightly },
    { key: 'wrong' as const, label: 'Verified USA ID but incorrect Pike13 USA ID', value: totals.wrong, color: colors.wrong },
  ]

  // Donut config (avoid clipping by adding a margin to the canvas)
  const radius = 60
  const stroke = 24
  const margin = 8
  const center = radius + stroke / 2 + margin
  const size = center * 2
  const circumference = 2 * Math.PI * radius

  // Outer ring shows Verified vs Invalid (disjoint) using a shared denominator to avoid double counting
  const outerVerified = Math.max(0, totals.verified)
  const outerInvalid = Math.max(0, totals.invalid)
  const outerTotal = Math.max(1, outerVerified + outerInvalid)
  function outerArcLen(v: number) { return (v / outerTotal) * circumference }
  let outerCum = 0
  const outerData = [
    { key: 'verified' as const, label: 'Verified', value: outerVerified, color: colors.verified },
    { key: 'invalid' as const, label: 'Invalid numbers', value: outerInvalid, color: colors.invalid },
  ].map(d => {
    const dasharray = `${outerArcLen(d.value)} ${circumference}`
    const dashoffset = - (outerCum / outerTotal) * circumference
    outerCum += d.value
    return { ...d, dasharray, dashoffset }
  })

  // Inner ring overlays the split of Verified: Rightly vs Wrong, scaled to the Verified outer segment length
  // This ensures inner segments never exceed the Verified outer arc and align with it.
  const innerDenom = Math.max(1, totals.verified)
  // Length of the Verified portion on the outer ring
  const outerVerifiedSegment = outerData.find(d => d.key === 'verified')
  const outerVerifiedLen = outerVerifiedSegment ? (outerVerified / outerTotal) * circumference : 0
  // Starting offset of the Verified outer segment (align inner ring to this)
  const outerVerifiedOffset = outerVerifiedSegment?.dashoffset ?? 0
  let innerCum = 0
  const innerStroke = Math.max(8, Math.floor(stroke * 0.6))
  const showInner = totals.verified > 0 && (totals.rightly > 0 || totals.wrong > 0)
  const innerData = [
    { key: 'rightly' as const, label: 'Rightly registered', value: Math.max(0, totals.rightly), color: colors.rightly },
    { key: 'wrong' as const, label: 'Wrong ID but verified', value: Math.max(0, totals.wrong), color: colors.wrong },
  ].map(d => {
    const segLen = (d.value / innerDenom) * outerVerifiedLen
    const dasharray = `${segLen} ${circumference}`
    const dashoffset = outerVerifiedOffset - (innerCum / innerDenom) * outerVerifiedLen
    innerCum += d.value
    return { ...d, dasharray, dashoffset }
  })

  return (
    <div>
      {/* Single section with text, buttons, and chart all together */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
        style={useFixedHeight && sectionHeight ? { minHeight: sectionHeight } : undefined}
      >
        {/* Left column: header text + tiles */}
        <div ref={leftRef} className="space-y-4">
          {headerText ? (
            <div className="text-sm text-gray-700">{headerText}</div>
          ) : null}
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

        {/* Right column: chart sized to match left content height */}
        <div 
          className="flex flex-col items-center justify-center p-4" 
          style={useFixedHeight && sectionHeight ? { height: sectionHeight } : { minHeight: '320px' }}
        >
          <div 
            className="flex items-center justify-center"
            style={{ 
              width: '100%',
              height: 'calc(100% - 2rem)', // Reserve space for label below
              minHeight: '200px'
            }}
          >
            <svg
              className="w-full h-full max-w-full max-h-full"
              viewBox={`0 0 ${size} ${size}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Background track */}
              <circle cx={center} cy={center} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
              {/* Outer ring: Verified vs Invalid */}
              {outerData.map((s) => (
                <circle
                  key={`outer-${s.key}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={s.dasharray}
                  strokeDashoffset={s.dashoffset}
                  strokeLinecap="butt"
                  style={{ cursor: 'pointer', opacity: category && category !== s.key ? 0.4 : 1 }}
                  onClick={() => setCategory(category === s.key ? null : s.key)}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              ))}
              {/* Inner ring: split of Verified into Rightly/Wrong (overlays, avoids double counting) */}
              {showInner && innerData.map((s) => (
                <circle
                  key={`inner-${s.key}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={innerStroke}
                  strokeDasharray={s.dasharray}
                  strokeDashoffset={s.dashoffset}
                  strokeLinecap="butt"
                  style={{ cursor: 'pointer', opacity: category && category !== s.key ? 0.45 : 0.9 }}
                  onClick={() => setCategory(category === s.key ? null : s.key)}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              ))}
            </svg>
          </div>
          {/* Chart label below the chart */}
          <div className="text-sm text-gray-600 font-medium text-center mt-2">
            {category
              ? tiles.find(d => d.key === category)?.label
              : 'Verified vs Invalid'}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
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

  // Reset to first page when filter changes
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
      {/* Pagination Controls */}
      <div className="flex items-center justify-between gap-2 mt-2">
        {/* Prev */}
        <button
          className={`px-3 py-2 rounded-md border ${page > 1 ? 'hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}
          onClick={() => page > 1 && setPage(page - 1)}
          disabled={page <= 1}
        >
          ← Previous
        </button>

        {/* Center status button showing pages */}
        <button className="px-3 py-2 rounded-md border bg-white" disabled>
          Page {page} of {totalPages} • Showing {total ? start + 1 : 0}–{end} of {total}
        </button>

        {/* Next */}
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
