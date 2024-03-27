import {useTimeSpots} from "@/components/calendar/useTimeSpots";
import {Button} from "@/components/ui/button";
import {ConfigStatusAtom, DrawerDialogDemo} from "@/components/calendar/confirm";
import {useSetAtom} from "jotai";
import { formatRelative } from "date-fns";

const time_str=(t: Date)=>{
  return t.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit',  hourCycle: 'h23'})
}

export const TimeSpots = ({date}: {date?: Date}) => {
  const setStatus = useSetAtom(ConfigStatusAtom)

  const {loading, data} = useTimeSpots(date)
  if (!date) {
    return <div>Please select a date</div>
  }
  const weekday = date.toLocaleDateString('en-US', {weekday: 'short'})
  const [month, day] = date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}).split(" ")
  return (
    <div className="flex-col flex h-full relative gap-4">
      <DrawerDialogDemo/>
      <div className="flex justify-between">
        <div className="flex gap-2">
          <div className="font-bold">{weekday},</div>
          <div>
            <span className="font-bold">{month}</span> <span>{day}</span>
          </div>
        </div>
      </div>

      {loading && <div>Loading...</div>}
      {!loading && data.length === 0 && <div>No spots available</div>}
      {!loading && data.length > 0 &&
          <div className="smart-scroll flex flex-col gap-2">
            {
              data.map((spot: any) => {
                const t = new Date(spot.start_at)
                return (
                  <Button key={spot.start_at} variant="outline" onClick={()=>setStatus({
                    start_at: spot.start_at,
                    end_at: spot.end_at
                  })}>
                    {time_str(t)}
                  </Button>
                )
              })
            }
            <div className="h-4"/>
          </div>
      }


    </div>

  )
}