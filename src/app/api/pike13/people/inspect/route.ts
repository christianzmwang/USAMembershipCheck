import { NextResponse } from "next/server"

type AnyRecord = Record<string, any>

const PIKE13_BASE = "https://bayareafencing.pike13.com/api/v2/desk"

async function fetchPeoplePage(apiKey: string, page = 1, perPage = 50): Promise<AnyRecord[]> {
  const url = `${PIKE13_BASE}/people?per_page=${perPage}&page=${page}`
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Pike13 people fetch failed: ${res.status} ${res.statusText} ${text}`)
  }
  const data = (await res.json()) as AnyRecord
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.people)) return data.people
  return []
}

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const apiKey = process.env.PIKE13_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing PIKE13_API_KEY" }, { status: 500 })
    }

    const people = await fetchPeoplePage(apiKey, 1, 100)

    const names = new Set<string>()
    const sample: AnyRecord[] = []

    for (const p of people) {
      // Shape 1
      if (Array.isArray(p?.custom_fields)) {
        for (const f of p.custom_fields) {
          const n = typeof f?.name === "string" ? f.name : undefined
          if (n) names.add(n)
        }
      }
      // Shape 2
      if (Array.isArray(p?.custom_field_values)) {
        for (const f of p.custom_field_values) {
          const n = typeof f?.name === "string" ? f.name : f?.custom_field?.name
          if (typeof n === "string") names.add(n)
        }
      }
      // Shape 3
      if (Array.isArray(p?.profile?.custom_fields)) {
        for (const f of p.profile.custom_fields) {
          const n = typeof f?.name === "string" ? f.name : undefined
          if (n) names.add(n)
        }
      }

      if (sample.length < 5) {
        sample.push({
          id: p?.id ?? p?.person_id,
          first_name: p?.first_name,
          last_name: p?.last_name,
          email: p?.email ?? p?.primary_email,
          custom_fields: p?.custom_fields,
          custom_field_values: p?.custom_field_values,
          profile_custom_fields: p?.profile?.custom_fields,
        })
      }
    }

    return NextResponse.json({
      uniqueCustomFieldNames: Array.from(names).sort(),
      sample,
      count: people.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 })
  }
}
