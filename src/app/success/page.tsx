"use client"

import {Card, CardContent, CardHeader} from "@/components/ui/card";
import {useSearchParams} from "next/dist/client/components/navigation";
import {Suspense} from "react";
import {format} from "date-fns-tz";

function Success() {
  const params = useSearchParams()
  const datetime = params.get("datetime");
  const location= params.get("location");
  if (!datetime ) {
    return <div>Invalid URL</div>;
  }

  const date = new Date(datetime)
  //  "date":format(new Date(data.start_at), 'MMM dd'),
  //     "time": format(new Date(data.start_at), 'HH:mm'),

  return (
    <Card className="mt-6 mx-auto max-w-[20rem] sm:max-w-sm md:max-w-md">
      <CardHeader className="space-y-2">
        <h2 className="text-2xl font-bold">Appointment confirmed</h2>
        <p className="text-sm leading-none text-gray-500">Your appointment has been successfully scheduled.</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <h3 className="text-sm  tracking-wide  text-gray-500">Date</h3>
          <p className="font-bold">{format(new Date(datetime), 'MMM dd')}</p>
        </div>
        <div className="grid gap-1.5">
          <h3 className="text-sm  tracking-wide  text-gray-500">Time</h3>
          <p className="font-bold">{format(new Date(datetime), 'HH:mm')}</p>
        </div>
        <div className="grid gap-1.5">
          <h3 className="text-sm  tracking-wide text-gray-500">Location</h3>
          <p className="font-bold">{location}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuccessPage() {
  return (
    // You could have a loading skeleton as the `fallback` too
    <Suspense>
      <Success />
    </Suspense>
  )
}