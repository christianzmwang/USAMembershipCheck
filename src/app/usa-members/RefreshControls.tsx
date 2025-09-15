"use client"

import React from "react"

type RefreshStatus = {
  running: boolean
  phase?: "starting" | "fetch" | "verify" | "done" | "error"
  startedAt?: string
  finishedAt?: string
  lastFetchRunAt?: string | null
  lastVerifyRunAt?: string | null
  pid?: number
  error?: string
}

function fmtDate(s?: string | null) {
  if (!s) return "—"
  try {
    const d = new Date(s)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const date = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: tz,
    }).format(d)
    return `${date} (${tz})`
  } catch {
    return s
  }
}

export default function RefreshControls() {
  const [status, setStatus] = React.useState<RefreshStatus | null>(null)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/usa/refresh", { cache: "no-store" })
      const j = await r.json()
      setStatus(j?.status || null)
    } catch {}
  }, [])

  React.useEffect(() => { load() }, [load])

  // Poll when running
  React.useEffect(() => {
    if (!status?.running) return
    const id = setInterval(load, 2000)
    return () => clearInterval(id)
  }, [status?.running, load])

  const trigger = async () => {
    setLoading(true)
    try {
      await fetch("/api/usa/refresh", { method: "POST" })
      await load()
    } finally {
      setLoading(false)
    }
  }

  const lastUpdated = status?.lastVerifyRunAt || status?.finishedAt || status?.startedAt || null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-md bg-white">
      <button
        onClick={trigger}
        disabled={loading || status?.running}
        className={`px-4 py-2 rounded-md text-white ${status?.running ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        title={status?.running ? `In progress: ${status?.phase || ''}` : 'Fetch + Verify in background'}
      >
        {status?.running ? `Refreshing… (${status?.phase || 'working'})` : (loading ? 'Starting…' : 'Refresh now')}
      </button>
      <div className="text-sm text-gray-700">
        <div>
          Last updated: <span className="font-medium">{fmtDate(lastUpdated)}</span>
        </div>
        {status?.running && (
          <div className="text-xs text-gray-500">In progress (phase: {status.phase}) — started at {fmtDate(status.startedAt)}</div>
        )}
        {status?.error && (
          <div className="text-xs text-red-600">Error: {status.error}</div>
        )}
      </div>
    </div>
  )
}
