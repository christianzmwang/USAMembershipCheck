/*
  Script: fetch-usa-members.ts
  Purpose: Fetch all Pike13 people and extract USA member IDs, then save to JSON for offline verification.

  Inputs (env):
    - PIKE13_API_KEY
    - PIKE13_USA_MEMBER_FIELD_NAME (optional)

  Usage:
    pnpm fetch:usa [--out out/usa-members.json]
*/

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { getAllPeopleUSAMembers } from '../src/lib/pike13'

(() => {
  const cwd = process.cwd()
  const candidates = [path.join(cwd, '.env.local'), path.join(cwd, '.env')]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) dotenv.config({ path: p, override: false })
    } catch {}
  }
})()

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function arg(name: string, def?: string) {
  const idx = process.argv.findIndex((a) => a === name || a.startsWith(name + '='))
  if (idx === -1) return def
  const v = process.argv[idx]
  if (v.includes('=')) return v.split('=')[1]
  return process.argv[idx + 1] ?? def
}

async function main() {
  const apiKey = requireEnv('PIKE13_API_KEY')
  const fieldName = process.env.PIKE13_USA_MEMBER_FIELD_NAME || 'USA Fencing Member ID'
  const outPath = arg('--out', 'out/usa-members.json')!
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  console.log(`[fetch] Fetching Pike13 USA member data (field="${fieldName}")...`)
  const data = await getAllPeopleUSAMembers({ apiKey, fieldName })

  const withIds = data.filter(d => !!d.usa_member_id)
  const summary = {
    runAt: new Date().toISOString(),
    count: data.length,
    withIds: withIds.length,
    fieldName,
  }

  fs.writeFileSync(outPath, JSON.stringify({ summary, people: data }, null, 2))
  console.log(`[fetch] Saved ${data.length} people to ${outPath} (${withIds.length} with USA IDs)`) 
}

main().catch((e) => { console.error(e); process.exit(1) })
