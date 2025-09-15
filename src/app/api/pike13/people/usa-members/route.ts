import { NextResponse } from "next/server"
import { getAllPeopleUSAMembers } from "@/lib/pike13"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const apiKey = process.env.PIKE13_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing PIKE13_API_KEY" }, { status: 500 })
    }
    const fieldName = process.env.PIKE13_USA_MEMBER_FIELD_NAME || "USA Fencing Member ID"

    const data = await getAllPeopleUSAMembers({ apiKey, fieldName })
    // Optionally filter out nulls if only those with IDs are desired; keep all for visibility.
    return NextResponse.json({ people: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 })
  }
}
