
export const PIKE13 = {
  "TRIAL_PRIVATE_SERVICE_ID": "331346",
  "COACH_SANDRO_ID": "11852848",
  "PLEASANTON_LOCATION_ID": "41604",
}

// Server-side helpers to access Pike13 Desk API
// NOTE: Only import these from server components or API routes.

type AnyRecord = Record<string, any>

const PIKE13_BASE = "https://bayareafencing.pike13.com/api/v2/desk"

/**
 * Find a custom field value on a person object by display name.
 * Tries a few known shapes seen in Pike13 responses.
 */
export function getCustomFieldValue(person: AnyRecord, fieldName: string): string | null {
  if (!person || !fieldName) return null

  // Shape 1: person.custom_fields: [{ name, value }]
  const cf1 = person.custom_fields as AnyRecord[] | undefined
  if (Array.isArray(cf1)) {
    const hit = cf1.find((f) =>
      typeof f?.name === "string" && f.name.trim().toLowerCase() === fieldName.trim().toLowerCase()
    )
    if (hit && typeof hit.value !== "undefined" && hit.value !== null) return String(hit.value)
  }

  // Shape 2: person.custom_field_values: [{ name, value }] or [{ custom_field: { name }, value }]
  const cf2 = person.custom_field_values as AnyRecord[] | undefined
  if (Array.isArray(cf2)) {
    for (const f of cf2) {
      const n = typeof f?.name === "string" ? f.name : f?.custom_field?.name
      if (typeof n === "string" && n.trim().toLowerCase() === fieldName.trim().toLowerCase()) {
        if (typeof f.value !== "undefined" && f.value !== null) return String(f.value)
      }
    }
  }

  // Shape 3: person.profile?.custom_fields
  const cf3 = person.profile?.custom_fields as AnyRecord[] | undefined
  if (Array.isArray(cf3)) {
    const hit = cf3.find((f) =>
      typeof f?.name === "string" && f.name.trim().toLowerCase() === fieldName.trim().toLowerCase()
    )
    if (hit && typeof hit.value !== "undefined" && hit.value !== null) return String(hit.value)
  }

  return null
}

export type USAProfile = {
  person_id: number
  usa_member_id: string | null
  first_name?: string
  last_name?: string
  email?: string | null
}

/**
 * Fetch a page of people from Pike13 Desk API.
 */
async function fetchPeoplePage(apiKey: string, page: number, perPage = 100): Promise<AnyRecord[]> {
  const url = `${PIKE13_BASE}/people?per_page=${perPage}&page=${page}`
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    // Avoid caching in Next
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Pike13 people fetch failed: ${res.status} ${res.statusText} ${text}`)
  }

  const data = (await res.json()) as AnyRecord
  // Try common shapes: { people: [...] } or directly an array
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.people)) return data.people
  // Fallback
  return []
}

export async function getPeopleUSAMembersPage(
  apiKey: string,
  page: number,
  perPage = 100,
  fieldName?: string,
): Promise<USAProfile[]> {
  const people = await fetchPeoplePage(apiKey, page, perPage)
  const chosenName = fieldName || "USA Fencing Member ID"
  // Light progress log on server
  console.log(`[pike13] fetched page ${page} size ${people.length}`)

  const results: USAProfile[] = []
  for (const p of people) {
    const usaId = getCustomFieldValue(p, chosenName)
    results.push({
      person_id: Number(p?.id ?? p?.person_id ?? 0),
      usa_member_id: usaId,
      first_name: p?.first_name,
      last_name: p?.last_name,
      email: p?.email ?? p?.primary_email ?? null,
    })
  }
  return results
}

/** Fetch a single person record by id */
export async function getPersonById(apiKey: string, personId: number): Promise<AnyRecord | null> {
  const url = `${PIKE13_BASE}/people/${personId}`
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
    throw new Error(`Pike13 get person failed: ${res.status} ${res.statusText} ${text}`)
  }
  const data = (await res.json()) as AnyRecord
  // Try common shapes
  if (data?.person) return data.person
  if (Array.isArray(data?.people)) {
    if (data.people.length === 1) return data.people[0]
    // Sometimes API returns a wrapper with one person; otherwise return raw for debugging
  }
  return data || null
}

/** Update a person's custom field by numeric custom_field_id */
export async function updatePersonCustomFieldById(
  apiKey: string,
  personId: number,
  customFieldId: number,
  value: string | number | boolean | null,
): Promise<AnyRecord> {
  const url = `${PIKE13_BASE}/people/${personId}`
  // Primary attempt: use custom_fields shape with custom_field_id
  const body1 = {
    person: {
      custom_fields: [
        { custom_field_id: customFieldId, value },
      ],
    },
  }
  let res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body1),
  })
  if (res.ok) return (await res.json()) as AnyRecord

  // Secondary attempt: legacy custom_field_values shape
  const body2 = {
    person: {
      custom_field_values: [
        { custom_field_id: customFieldId, value },
      ],
    },
  }
  res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body2),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Pike13 update person failed: ${res.status} ${res.statusText} ${text}`)
  }
  return (await res.json()) as AnyRecord
}

async function updatePersonCustomFieldByNameRaw(
  apiKey: string,
  personId: number,
  displayName: string,
  value: string | number | boolean | null,
): Promise<AnyRecord> {
  const url = `${PIKE13_BASE}/people/${personId}`
  const body = {
    person: {
      custom_field_values: [
        { name: displayName, value },
      ],
    },
  }
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Pike13 update (by name) failed: ${res.status} ${res.statusText} ${text}`)
  }
  return (await res.json()) as AnyRecord
}

/**
 * Convenience: given a person object and a display field name, attempt to find the numeric custom_field_id.
 */
export function findCustomFieldId(person: AnyRecord, displayName: string): number | null {
  if (!person || !displayName) return null
  const lower = displayName.trim().toLowerCase()

  // Look in person.custom_fields: [{ id, custom_field_id, name, value }]
  const cf1 = person.custom_fields as AnyRecord[] | undefined
  if (Array.isArray(cf1)) {
    for (const f of cf1) {
      const n = typeof f?.name === "string" ? f.name : undefined
      if (typeof n === "string" && n.trim().toLowerCase() === lower) {
        const id = typeof f?.custom_field_id === "number" ? f.custom_field_id : f?.id
        if (typeof id === "number") return id
      }
    }
  }

  // Look in person.custom_field_values: [{ name?, value, custom_field: { id, name }}]
  const cf2 = person.custom_field_values as AnyRecord[] | undefined
  if (Array.isArray(cf2)) {
    for (const f of cf2) {
      const n = typeof f?.name === "string" ? f.name : f?.custom_field?.name
      if (typeof n === "string" && n.trim().toLowerCase() === lower) {
        const id = f?.custom_field?.id
        if (typeof id === "number") return id
      }
    }
  }

  // Some payloads may have person.profile.custom_fields with id
  const cf3 = person.profile?.custom_fields as AnyRecord[] | undefined
  if (Array.isArray(cf3)) {
    for (const f of cf3) {
      const n = typeof f?.name === "string" ? f.name : undefined
      if (typeof n === "string" && n.trim().toLowerCase() === lower) {
        const id = f?.id
        if (typeof id === "number") return id
      }
    }
  }

  // Not found
  return null
}

function getCustomFieldEntry(person: AnyRecord, displayName: string): { personFieldId?: number; customFieldId?: number } {
  const out: { personFieldId?: number; customFieldId?: number } = {}
  if (!person || !displayName) return out
  const lower = displayName.trim().toLowerCase()
  const cf1 = person.custom_fields as AnyRecord[] | undefined
  if (Array.isArray(cf1)) {
    for (const f of cf1) {
      const n = typeof f?.name === "string" ? f.name : undefined
      if (typeof n === "string" && n.trim().toLowerCase() === lower) {
        if (typeof f?.id === "number") out.personFieldId = f.id
        if (typeof f?.custom_field_id === "number") out.customFieldId = f.custom_field_id
        break
      }
    }
  }
  if (!out.customFieldId) {
    const cf2 = person.custom_field_values as AnyRecord[] | undefined
    if (Array.isArray(cf2)) {
      for (const f of cf2) {
        const n = typeof f?.name === "string" ? f.name : f?.custom_field?.name
        if (typeof n === "string" && n.trim().toLowerCase() === lower) {
          const id = f?.custom_field?.id
          if (typeof id === "number") out.customFieldId = id
          break
        }
      }
    }
  }
  return out
}

/** Update a person's custom field by display name. Will fetch the person to resolve field id. */
export async function updatePersonCustomFieldByName(
  apiKey: string,
  personId: number,
  displayName: string,
  value: string | number | boolean | null,
): Promise<AnyRecord> {
  const person = await getPersonById(apiKey, personId)
  if (!person) throw new Error(`Person ${personId} not found`)
  const entry = getCustomFieldEntry(person, displayName)
  const url = `${PIKE13_BASE}/people/${personId}`

  async function verify(): Promise<boolean> {
    // small delay to allow persistence
    await new Promise((r) => setTimeout(r, 500))
    const after = await getPersonById(apiKey, personId)
    const cur = getCustomFieldValue(after as AnyRecord, displayName)
    return String(cur ?? "") === String(value ?? "")
  }

  const attempts: AnyRecord[] = []

  if (entry.personFieldId) {
    attempts.push({ person: { custom_fields: [{ id: entry.personFieldId, value }] } })
  }
  const fieldId = entry.customFieldId || (await resolveCustomFieldIdByName(apiKey, displayName))
  if (fieldId) {
    attempts.push({ person: { custom_fields: [{ custom_field_id: fieldId, value }] } })
    attempts.push({ person: { custom_field_values: [{ custom_field_id: fieldId, value }] } })
  }
  // Name-based last
  attempts.push({ person: { custom_fields: [{ name: displayName, value }] } })
  attempts.push({ person: { custom_field_values: [{ name: displayName, value }] } })

  let lastError: any = null
  for (const body of attempts) {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        lastError = new Error(`Update attempt failed (${JSON.stringify(body)}): ${res.status} ${res.statusText} ${text}`)
        continue
      }
      const ok = await verify()
      if (ok) return (await res.json()) as AnyRecord
    } catch (e) {
      lastError = e
      continue
    }
  }
  if (lastError) throw lastError
  throw new Error(`Update did not take effect for field '${displayName}' on person ${personId}`)
}

/**
 * Resolve a custom field id by scanning people pages until a match is found.
 * Note: This is a heuristic to find the account-level custom field id when a target person doesn't expose it.
 */
export async function resolveCustomFieldIdByName(apiKey: string, displayName: string): Promise<number | null> {
  const perPage = 100
  const MAX_PAGES = 50
  const candidates = Array.from(
    new Set(
      [displayName, "USA Fencing Member ID", "USA Fencing Membership number"]
        .filter(Boolean)
        .map((s) => s.trim().toLowerCase())
    )
  )
  for (let page = 1; page <= MAX_PAGES; page++) {
    const people = await fetchPeoplePage(apiKey, page, perPage)
    if (!people.length) break
    for (const p of people) {
      // Check person.custom_fields (listing shape)
      const cf1 = (p as AnyRecord)?.custom_fields as AnyRecord[] | undefined
      if (Array.isArray(cf1)) {
        for (const f of cf1) {
          const n = typeof f?.name === "string" ? f.name : undefined
          if (typeof n === "string" && candidates.includes(n.trim().toLowerCase())) {
            const id = typeof f?.custom_field_id === "number" ? f.custom_field_id : f?.id
            if (typeof id === "number") return id
          }
        }
      }
      // Look for custom_field_values with embedded custom_field.id
      const cf2 = (p as AnyRecord)?.custom_field_values as AnyRecord[] | undefined
      if (Array.isArray(cf2)) {
        for (const f of cf2) {
          const n = typeof f?.name === "string" ? f.name : f?.custom_field?.name
          if (typeof n === "string" && candidates.includes(n.trim().toLowerCase())) {
            const id = f?.custom_field?.id
            if (typeof id === "number") return id
          }
        }
      }
      // Fallback to profile.custom_fields that might contain id
      const cf3 = (p as AnyRecord)?.profile?.custom_fields as AnyRecord[] | undefined
      if (Array.isArray(cf3)) {
        for (const f of cf3) {
          const n = typeof f?.name === "string" ? f.name : undefined
          if (typeof n === "string" && candidates.includes(n.trim().toLowerCase())) {
            const id = f?.id
            if (typeof id === "number") return id
          }
        }
      }
    }
    if (people.length < perPage) break
  }
  return null
}

/**
 * Fetches all people and returns mapping of person_id to USA member id (custom field).
 * Customize field name via env PIKE13_USA_MEMBER_FIELD_NAME or defaults to 'USA Fencing Member ID'.
 */
export async function getAllPeopleUSAMembers(params: { apiKey: string; fieldName?: string }): Promise<USAProfile[]> {
  const { apiKey } = params
  const fieldName = params.fieldName || "USA Fencing Member ID"

  const results: USAProfile[] = []
  let page = 1
  // Pike13 enforces per_page <= 100
  const perPage = 100

  // Keep fetching until a page returns fewer than perPage items (or empty)
  // Add a generous safety upper bound to prevent infinite loops due to API anomalies
  const MAX_PAGES = 10000
  for (; page <= MAX_PAGES; page++) {
    const people = await fetchPeoplePage(apiKey, page, perPage)
    console.log(`[pike13] paging page=${page} received=${people.length}`)
    if (!people.length) break

    for (const p of people) {
      const usaId = getCustomFieldValue(p, fieldName)
      results.push({
        person_id: Number(p?.id ?? p?.person_id ?? 0),
        usa_member_id: usaId,
        first_name: p?.first_name,
        last_name: p?.last_name,
        email: p?.email ?? p?.primary_email ?? null,
      })
    }

    if (people.length < perPage) break
  }

  return results
}
