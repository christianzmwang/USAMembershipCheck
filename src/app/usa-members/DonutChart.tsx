"use client"

import React from "react"

type Totals = { verified: number; rightly: number; wrong: number; invalid: number }

export default function DonutChart({
  totals,
  category,
  onCategoryChange,
  fixedHeight,
}: {
  totals: Totals
  category: null | 'verified' | 'rightly' | 'wrong' | 'invalid'
  onCategoryChange: (c: null | 'verified' | 'rightly' | 'wrong' | 'invalid') => void
  fixedHeight?: number | null
}) {
  const colors: Record<string, string> = {
    verified: '#16a34a', // green-600
    rightly: '#2563eb',  // blue-600
    wrong: '#dc2626',    // red-600
    invalid: '#f59e0b',  // amber-500
  }

  const radius = 60
  const stroke = 24
  const margin = 8
  const center = radius + stroke / 2 + margin
  const size = center * 2
  const circumference = 2 * Math.PI * radius

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

  // Inner ring overlays the Verified split (Rightly/Wrong) and is scaled to the
  // Verified segment of the outer ring to ensure it never exceeds it.
  const innerDenom = Math.max(1, totals.verified)
  // Compute the length and starting offset of the Verified segment on the outer ring
  const outerVerifiedLen = (outerVerified / outerTotal) * circumference
  const outerVerifiedOffset = -0 // initialize fallback
  const verifiedSegment = outerData.find(d => d.key === 'verified')
  const innerBaseOffset = verifiedSegment?.dashoffset ?? outerVerifiedOffset

  let innerCum = 0
  const innerStroke = Math.max(8, Math.floor(stroke * 0.6))
  const showInner = totals.verified > 0 && (totals.rightly > 0 || totals.wrong > 0)
  const innerData = [
    { key: 'rightly' as const, label: 'Rightly registered', value: Math.max(0, totals.rightly), color: colors.rightly },
    { key: 'wrong' as const, label: 'Wrong ID but verified', value: Math.max(0, totals.wrong), color: colors.wrong },
  ].map(d => {
    const segLen = (d.value / innerDenom) * outerVerifiedLen
    const dasharray = `${segLen} ${circumference}`
    const dashoffset = innerBaseOffset - (innerCum / innerDenom) * outerVerifiedLen
    innerCum += d.value
    return { ...d, dasharray, dashoffset }
  })

  const containerStyle = fixedHeight && fixedHeight > 0
    ? { height: fixedHeight }
    : { minHeight: '320px' as const }

  return (
    <div className="flex flex-col items-center justify-center" style={containerStyle}>
      <div className="flex items-center justify-center" style={{ width: '100%', height: 'calc(100% - 2rem)', minHeight: fixedHeight ? undefined : '200px' }}>
        <svg className="w-full h-full max-w-full max-h-full" viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
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
              onClick={() => onCategoryChange(category === s.key ? null : s.key)}
              transform={`rotate(-90 ${center} ${center})`}
            />
          ))}
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
              onClick={() => onCategoryChange(category === s.key ? null : s.key)}
              transform={`rotate(-90 ${center} ${center})`}
            />
          ))}
        </svg>
      </div>
      <div className="text-sm text-gray-600 font-medium text-center mt-2">
        {category
          ? (
            category === 'verified' ? 'Verified' :
            category === 'rightly' ? 'Rightly registered' :
            category === 'wrong' ? 'Wrong ID but verified' :
            'Invalid numbers'
          )
          : 'Verified vs Invalid'}
      </div>
    </div>
  )
}
