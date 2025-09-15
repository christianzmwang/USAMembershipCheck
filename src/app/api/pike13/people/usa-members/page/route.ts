import { NextResponse } from "next/server"
import { getPeopleUSAMembersPage } from "@/lib/pike13"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const apiKey = process.env.PIKE13_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing PIKE13_API_KEY" }, { status: 500 })
    }
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get("page") || 1))
    const perPage = Math.min(200, Math.max(1, Number(url.searchParams.get("perPage") || 100)))
  // Use hardcoded default rather than env var
  const fieldName = "USA Fencing Membership number"

    const data = await getPeopleUSAMembersPage(apiKey, page, perPage, fieldName)
    return NextResponse.json({ people: data, page, perPage })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 })
  }
}
