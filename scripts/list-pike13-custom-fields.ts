/*
  Script: list-pike13-custom-fields.ts
  Purpose: Scan the first N pages of people to list discovered custom field display names and IDs.

  Inputs (env):
    - PIKE13_API_KEY

  Usage:
    pnpm tsx scripts/list-pike13-custom-fields.ts [--pages 5]
*/

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { getAllPeopleUSAMembers } from '../src/lib/pike13'

// We will re-implement a light pager here to also surface IDs
import { resolveCustomFieldIdByName } from '../src/lib/pike13'

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
  const names = [
    'USA Fencing Member ID',
    'USA Fencing Membership number',
    'USA Member ID',
    'USFA Number',
  ]

  for (const n of names) {
    const id = await resolveCustomFieldIdByName(apiKey, n)
    console.log(`${n}: ${id ?? 'not found'}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
