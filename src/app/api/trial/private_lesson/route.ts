import {z} from "zod";


import {NextRequest} from "next/server";
import {PIKE13} from "@/lib/pike13";

interface TrialRequest {
  email: string,
  kid_first_name: string,
  kid_last_name: string,
  phone: string,
  start_at: string,
}

const RequestSchema = z.object({
  email: z.string(),
  kid_first_name: z.string(),
  kid_last_name: z.string(),
  phone: z.string(),
  start_at: z.string(),
});

const callPike13 = async (data: TrialRequest) => {
  const res = await fetch("https://bayareafencing.pike13.com/api/v2/desk/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.PIKE13_API_KEY}`
    },

    body: JSON.stringify({
      "booking": {
        "idempotency_token": "A_STRING_UNIQUE_TO_THIS_BOOKING_2",
        "complete_booking": true,
        "leases": [
          {
            "service_id": PIKE13.TRIAL_PRIVATE_SERVICE_ID,
            "staff_member_id": PIKE13.COACH_SANDRO_ID,
            "location_id": PIKE13.PLEASANTON_LOCATION_ID,
            "start_at": data.start_at,
            "person": {
              "first_name": data.kid_first_name,
              "last_name": data.kid_last_name,
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
    console.error("ERROR! api /api/trial/private_lesson",results)
    return new Response(`register fail, please try again`, {
      status: 403,
    })
  }
  return new Response(JSON.stringify({"success": true, results}))
}


export async function POST(request: NextRequest) {
  const data = await request.json()
  const result = RequestSchema.safeParse(data);
  if (!result.success) {
    return new Response(`Request data schema error: ${result.error}`, {
      status: 400,
    })
  }

  return callPike13(result.data)

}