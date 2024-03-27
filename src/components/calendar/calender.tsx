import {Calendar} from "@/components/ui/calendar";
import React from "react";
import {useDateSpots} from "@/components/calendar/useDateSpots";

export default function Calender({
                                   onDateChange
                                 }: { onDateChange: (d?: Date) => void }) {
  const [date, setDate] = React.useState<Date | undefined>()
  const [month, setMonth] = React.useState<Date>(new Date())
  const {loading, data} = useDateSpots(month)


  const hasSpots = (date: Date) => {
    if (loading) {
      return false
    }
    if (!data) {
      return false
    }
    const key = date.toISOString().split("T")[0]
    if (key in data) {
      return data[key] > 0
    }
    return false
  }

  const handleDateChange = (d?: Date) => {
    setDate(d)
    onDateChange(d)
  }

  return (
    <div className="relative flex  h-full calender ">
      <Calendar
        mode="single"
        required
        selected={date}
        fromDate={new Date()}
        onSelect={handleDateChange}
        onMonthChange={setMonth}
        showOutsideDays={false}
        disabled={d => !hasSpots(d)}
        fixedWeeks
        style={{
          height: "340px"
        }}
      />

      {loading &&
          <div className="absolute top-0 right-0 bottom-0 left-0 flex justify-center items-center  bg-transparent z-30"
               style={{
                 background: "rgba(255,255,255,0.8)"
               }}>
              Loading
          </div>}

    </div>

  )
}