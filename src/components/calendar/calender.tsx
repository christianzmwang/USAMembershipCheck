import {Calendar} from "@/components/ui/calendar";
import React, {useCallback, useEffect, useMemo} from "react";
import {useDateSpots} from "@/components/calendar/useDateSpots";
import {useNavigation} from "react-day-picker";
import {Button} from "@/components/ui/button";
import {usePathname, useRouter} from "next/navigation";
import {useSearchParams} from "next/dist/client/components/navigation";


const NoAvailableInMonth = ({show}: { show: boolean }) => {
  const {goToMonth, nextMonth, previousMonth} = useNavigation();
  if (!show) {
    return null
  }

  return <div
    className="flex flex-col gap-2 absolute top-0 right-0 bottom-0 left-0 justify-center items-center  bg-transparent z-30"
    style={{
      background: "rgba(255,255,255,0.8)"
    }}>
    <div>
      No Available in this month
    </div>
    <Button onClick={() => nextMonth && goToMonth(nextMonth)}>Next Month</Button>
  </div>

}

export default function Calender({
  date,
                                   onDateChange
                                 }: {date?:Date,
  onDateChange: (d?: Date) => void }) {
  const [month, setMonth] = React.useState<Date>(new Date())
  const pathname = usePathname()
  const params = useSearchParams()
  const {loading, data} = useDateSpots(month)
  const router = useRouter()

  // useEffect(() => {
  //   const date = params.get("date")
  //   if (date) {
  //     onDateChange(new Date(`${date}T00:00:00.000-07:00`))
  //     setMonth(new Date(`${date}T00:00:00.000-07:00`))
  //   }else {
  //     const today = new Date()
  //     onDateChange(today)
  //     setMonth(today)
  //   }
  // }, []);

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
    // router.replace(`${pathname}?date=${d?.toISOString().split("T")[0]}`)
    onDateChange(d)
  }


  const noAvailableInMonth = useMemo(() => {
    if (!data || loading) {
      return false
    }
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(month.getFullYear(), month.getMonth(), i)
      const key = d.toISOString().split("T")[0]
      if (key in data && data[key] > 0) {
        return false
      }
    }
    return true
  }, [data, month, loading])


  return (
    <div className="relative flex  h-full calender ">
      <Calendar
        mode="single"
        required
        selected={date}
        month={month}
        fromDate={new Date()}
        onSelect={handleDateChange}
        onMonthChange={setMonth}
        showOutsideDays={false}
        disabled={d => !hasSpots(d)}
        fixedWeeks
        style={{
          height: "340px"
        }}
        components={{
          Footer: () => <NoAvailableInMonth show={!loading && noAvailableInMonth}/>
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