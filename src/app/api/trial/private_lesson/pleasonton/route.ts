import {z} from "zod";


import {NextRequest} from "next/server";
import {PIKE13} from "@/lib/pike13";
import {requestSchema} from "@/app/api/trial/private_lesson/types";
import {format} from "date-fns-tz";

const get_name = (full: string) => {
  const [first, ...last] = full.split(" ")
  return {first, last: last.join(" ")}
}
// /api/v2/desk/people/:person_id/notes

const createNote = async (part: string, note: string) => {
  const res = await fetch(`https://bayareafencing.pike13.com/api/v2/desk/${part}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.PIKE13_API_KEY}`
    },
    body: JSON.stringify({
      "note": {
        note,
        public: false,
        pinned: false,
        send_notifications: false
      }
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`Error Call /api/v2/desk/${part}, code ${res.status}, error:${text}`)
  }
  return true
}


const callPike13 = async (data: z.infer<typeof requestSchema>) => {
  const {parent_name, child_name} = data;
  const res = await fetch("https://bayareafencing.pike13.com/api/v2/desk/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.PIKE13_API_KEY}`
    },

    body: JSON.stringify({
      "booking": {
        "idempotency_token": `${data.start_at}-${data.email}`,
        "complete_booking": true,
        "leases": [
          {
            "service_id": PIKE13.TRIAL_PRIVATE_SERVICE_ID,
            "staff_member_id": PIKE13.COACH_SANDRO_ID,
            "location_id": PIKE13.PLEASANTON_LOCATION_ID,
            "start_at": data.start_at,
            "person": {
              "first_name": get_name(parent_name).first,
              "last_name": get_name(parent_name).last,
              "email": data.email,
              "phone": data.phone
            }
          }
        ]
      }
    }),
  })

  const results = await res.json()
  if (!res.ok) {
    const err = "error" in results ? results.error as string : ""
    if (err.includes("longer available")) {
      return new Response(`${data.start_at} is no longer available, try other one`, {
        status: 409,
      })
    }
    console.error("ERROR! api /api/trial/private_lesson", results)
    return new Response(`register fail, please try again`, {
      status: 403,
    })
  }


  const note = {
    "parent_name": parent_name,
    "child_name": child_name,
    "child_age": data.child_age,
    "phone": data.phone,
    "email": data.email,
    "schema": "0.0.1",
  }

  const lease = results["bookings"][0]["leases"][0]

  await createNote(`/people/${lease.person.id}/notes`, JSON.stringify(note))
  await createNote(`/event_occurrences/${lease.event_occurrence_id}/notes`, JSON.stringify(note))



  return new Response(JSON.stringify({"success": true,
    "date":format(new Date(data.start_at), 'MMM dd'),
    "time": format(new Date(data.start_at), 'HH:mm'),
    "location": "5870 Stoneridge Dr Suite 6, Pleasanton",
  }))
}


export async function POST(request: NextRequest) {
  const data = await request.json()
  const result = requestSchema.safeParse(data);
  if (!result.success) {
    return new Response(`Request data schema error: ${result.error}`, {
      status: 400,
    })
  }

  try {
    return callPike13(result.data)
  } catch (e) {
    return new Response(`Internal server error.`, {
      status: 500,
    })
  }

}