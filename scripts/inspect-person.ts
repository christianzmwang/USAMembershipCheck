/*
  Script: inspect-person.ts
  Purpose: Fetch and log a single Pike13 person JSON to inspect custom fields.

  Inputs (env):
    - PIKE13_API_KEY

  Usage:
    pnpm tsx scripts/inspect-person.ts --person 13450416
*/

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { getPersonById } from '../src/lib/pike13'

type AnyRecord = Record<string, any>
const PIKE13_BASE = "https://bayareafencing.pike13.com/api/v2/desk"

async function fetchPeoplePage(apiKey: string, page: number, perPage = 100): Promise<AnyRecord[]> {
  const url = `${PIKE13_BASE}/people?per_page=${perPage}&page=${page}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Pike13 people fetch failed: ${res.status} ${res.statusText} ${text}`)
  }
  const data = (await res.json()) as AnyRecord
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.people)) return data.people
  return []
}

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
  const personId = Number(arg('--person', '13450416'))
  // Try page scan to locate full person object as returned in listing
  let found: AnyRecord | null = null
  for (let page = 1; page <= 200; page++) {
    const people = await fetchPeoplePage(apiKey, page, 100)
    if (!people.length) break
    for (const p of people) {
      const pid = Number(p?.id ?? p?.person_id ?? 0)
      if (pid === personId) {
        found = p
        break
      }
    }
    if (found) break
  }

  if (!found) {
    const p = await getPersonById(apiKey, personId)
    console.log(JSON.stringify({
      from: 'getPersonById',
      keys: p ? Object.keys(p) : [],
      raw: p,
    }, null, 2))
    return
  }

  console.log(JSON.stringify({
    id: found?.id ?? found?.person_id,
    first_name: found?.first_name,
    last_name: found?.last_name,
    email: found?.email ?? found?.primary_email,
    custom_fields: found?.custom_fields,
    custom_field_values: found?.custom_field_values,
    profile_custom_fields: found?.profile?.custom_fields,
    keys: Object.keys(found),
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
