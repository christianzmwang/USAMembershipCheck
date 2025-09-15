/*
  Orchestrates a full refresh: fetch Pike13 USA members then run verification.
  Writes progress to out/refresh-status.json and logs to out/refresh.log

  Usage: node scripts/refresh-usa.js
*/

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }

function writeStatus(obj) {
  try {
    const outDir = path.join(process.cwd(), 'out')
    ensureDir(outDir)
    fs.writeFileSync(path.join(outDir, 'refresh-status.json'), JSON.stringify(obj, null, 2))
  } catch {}
}

function readJsonSafe(p) {
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8')
      return JSON.parse(raw)
    }
  } catch {}
  return null
}

function nowIso() { return new Date().toISOString() }

function launch(cmd, args, logStream, env = process.env) {
  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (logStream) {
    child.stdout.on('data', (d) => logStream.write(d))
    child.stderr.on('data', (d) => logStream.write(d))
  }
  return child
}

function which(cmd) {
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', ''] : ['']
  const paths = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':')
  for (const p of paths) {
    for (const ext of exts) {
      const full = path.join(p, cmd + ext)
      try { if (fs.existsSync(full)) return full } catch {}
    }
  }
  return null
}

async function main() {
  const outDir = path.join(process.cwd(), 'out')
  ensureDir(outDir)
  const statusPath = path.join(outDir, 'refresh-status.json')
  const logPath = path.join(outDir, 'refresh.log')
  const logStream = fs.createWriteStream(logPath, { flags: 'a' })
  const s3Bucket = process.env.S3_BUCKET || ''
  const s3Prefix = process.env.S3_PREFIX || ''
  let s3Client = null
  async function ensureS3() {
    if (!s3Bucket) return null
    if (s3Client) return s3Client
    try {
      const { S3Client } = require('@aws-sdk/client-s3')
      s3Client = new S3Client({
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2',
        credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        } : undefined,
      })
      return s3Client
    } catch (e) {
      logStream.write(`[${nowIso()}] Failed to init S3 client: ${e?.message || e}\n`)
      return null
    }
  }
  async function uploadFileToS3(localPath, keyName) {
    const cli = await ensureS3()
    if (!cli) return
    try {
      const { PutObjectCommand } = require('@aws-sdk/client-s3')
      const Body = fs.readFileSync(localPath)
      const Key = `${s3Prefix}${keyName}`
      await cli.send(new PutObjectCommand({ Bucket: s3Bucket, Key, Body, ContentType: keyName.endsWith('.json') ? 'application/json' : 'text/plain' }))
      logStream.write(`[${nowIso()}] Uploaded ${keyName} to s3://${s3Bucket}/${Key}\n`)
    } catch (e) {
      logStream.write(`[${nowIso()}] S3 upload failed for ${keyName}: ${e?.message || e}\n`)
    }
  }

  const existing = readJsonSafe(statusPath)
  if (existing && existing.running) {
    logStream.write(`[${nowIso()}] Refresh already running (startedAt=${existing.startedAt})\n`)
    process.exit(0)
  }

  // Resolve preferred runners
  const pnpmBin = which('pnpm')
  const npmBin = which('npm')
  const tsxBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsx')
  const fetchScript = path.join(process.cwd(), 'scripts', 'fetch-usa-members.ts')
  const verifyScript = path.join(process.cwd(), 'scripts', 'verify-usa-members.ts')

  writeStatus({ running: true, phase: 'starting', startedAt: nowIso(), pid: process.pid })
  logStream.write(`[${nowIso()}] Starting refresh - PID ${process.pid}\n`)

  // Step 1: fetch
  writeStatus({ running: true, phase: 'fetch', startedAt: existing?.startedAt || nowIso(), fetchStartedAt: nowIso(), pid: process.pid })
  logStream.write(`[${nowIso()}] Fetching USA members...\n`)
  await new Promise((resolve, reject) => {
    let p
    if (pnpmBin) p = launch(pnpmBin, ['run', 'fetch:usa'], logStream)
    else if (npmBin) p = launch(npmBin, ['run', 'fetch:usa', '--silent'], logStream)
    else p = launch(tsxBin, [fetchScript], logStream)
    p.on('error', reject)
    p.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`fetch exited with ${code}`))
    })
  })

  const fetchJson = readJsonSafe(path.join(outDir, 'usa-members.json'))
  if (fetchJson && s3Bucket) {
    try { await uploadFileToS3(path.join(outDir, 'usa-members.json'), 'usa-members.json') } catch {}
  }

  // Step 2: verify
  writeStatus({ running: true, phase: 'verify', startedAt: existing?.startedAt || nowIso(), fetchFinishedAt: nowIso(), verifyStartedAt: nowIso(), pid: process.pid, lastFetchRunAt: fetchJson?.summary?.runAt || null })
  logStream.write(`[${nowIso()}] Verifying USA members...\n`)
  await new Promise((resolve, reject) => {
    let p
    if (pnpmBin) p = launch(pnpmBin, ['run', 'verify:usa'], logStream)
    else if (npmBin) p = launch(npmBin, ['run', 'verify:usa', '--silent'], logStream)
    else p = launch(tsxBin, [verifyScript], logStream)
    p.on('error', reject)
    p.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`verify exited with ${code}`))
    })
  })

  const verifyJson = readJsonSafe(path.join(outDir, 'usa-status.json'))
  if (verifyJson && s3Bucket) {
    try {
      await uploadFileToS3(path.join(outDir, 'usa-status.json'), 'usa-status.json')
      const csvPath = path.join(outDir, 'usa-status.csv')
      if (fs.existsSync(csvPath)) await uploadFileToS3(csvPath, 'usa-status.csv')
      const logLocal = path.join(outDir, 'refresh.log')
      if (fs.existsSync(logLocal)) await uploadFileToS3(logLocal, 'refresh.log')
    } catch {}
  }

  writeStatus({ running: false, phase: 'done', startedAt: existing?.startedAt || nowIso(), finishedAt: nowIso(), lastFetchRunAt: fetchJson?.summary?.runAt || null, lastVerifyRunAt: verifyJson?.runAt || null, pid: process.pid })
  logStream.write(`[${nowIso()}] Refresh completed successfully.\n`)
  logStream.end()
}

main().catch((e) => {
  try {
    const outDir = path.join(process.cwd(), 'out')
    ensureDir(outDir)
    const statusPath = path.join(outDir, 'refresh-status.json')
    const existing = readJsonSafe(statusPath)
    writeStatus({ ...existing, running: false, phase: 'error', finishedAt: nowIso(), error: String(e && e.message ? e.message : e) })
    const logPath = path.join(outDir, 'refresh.log')
    fs.appendFileSync(logPath, `[${nowIso()}] Refresh failed: ${e && e.message ? e.message : e}\n`)
  } catch {}
  process.exit(1)
})
