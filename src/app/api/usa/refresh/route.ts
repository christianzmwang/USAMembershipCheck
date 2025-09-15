import { NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { getLastUpdated } from "@/lib/storage-outputs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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

function statusPath() {
  return path.join(process.cwd(), "out", "refresh-status.json")
}

function readStatus(): RefreshStatus | null {
  try {
    const p = statusPath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8")
      return JSON.parse(raw)
    }
  } catch {}
  return null
}

function writeStatus(s: RefreshStatus) {
  try {
    const p = statusPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(s, null, 2))
  } catch {}
}

function startDetachedRefresh() {
  const nodePath = process.execPath
  const scriptPath = path.join(process.cwd(), "scripts", "refresh-usa.js")
  const outDir = path.join(process.cwd(), "out")
  fs.mkdirSync(outDir, { recursive: true })
  const outLog = fs.openSync(path.join(outDir, "refresh.out.log"), "a")
  const errLog = fs.openSync(path.join(outDir, "refresh.err.log"), "a")
  const child = spawn(nodePath, [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: ["ignore", outLog, errLog],
  })
  child.unref()
  return child.pid
}

export async function GET() {
  let s = readStatus()
  if (!s) {
    const { lastFetchRunAt, lastVerifyRunAt } = await getLastUpdated()
    s = { running: false, lastFetchRunAt, lastVerifyRunAt }
  }
  return NextResponse.json({ status: s })
}

export async function POST() {
  // Optionally require a secret in production for safety
  // const secret = process.env.REFRESH_SECRET
  // if (process.env.NODE_ENV === 'production' && (!secret || (await request.json()).secret !== secret)) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  // If running on Vercel and we have an external worker webhook, trigger that instead of spawning
  const isVercel = !!process.env.VERCEL
  const webhook = process.env.WORKER_REFRESH_WEBHOOK
  if (isVercel && webhook) {
    try {
      const r = await fetch(webhook, { method: 'POST' })
      const ok = r.ok
      const body = await r.text().catch(() => '')
      return NextResponse.json({ ok, forwarded: true, body })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
    }
  }

  let s = readStatus()
  if (s?.running) {
    return NextResponse.json({ ok: true, alreadyRunning: true, status: s })
  }
  writeStatus({ running: true, phase: "starting", startedAt: new Date().toISOString() })
  const pid = startDetachedRefresh()
  s = readStatus()
  return NextResponse.json({ ok: true, pid, status: s })
}
