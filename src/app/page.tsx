"use client"

import Calender from "@/components/calendar/calender";
import {useState} from "react";
import {TimeSpots} from "@/components/calendar/time-spots";

export default function v() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [date, setDate] = useState<Date | undefined>(new Date())
  return (
    <main className="flex h-full main" >

      <div style={{height: "auto"}}
        className="main-grid bg-default dark:bg-muted grid max-w-full items-start dark:[color-scheme:dark] sm:motion-reduce:transition-none md:flex-row rounded-md  sm:transition-[width] sm:duration-300 h-auto bg-background">
        <div className="p-4	 relative z-10 flex flex-col [grid-area:meta] border-b border--bsubtle" style={{height: "auto"}}>
          <h2 className="text-2xl  leading-relaxed"> Free trial - Private lesson</h2>
          <p className="text-xl font-bold  leading-relaxed">Pleasanton</p>
          <p className="text-sm  leading-relaxed">
            Book a free trial lesson with a private tutor<br/>
            Address: <span className="underline">5870 Stoneridge Dr Suite 6, Pleasanton</span>
          </p>
        </div>
        <div className="calender-wrapper  [grid-area:main] md:border--bsubtle ml-[-1px] h-full flex-shrink px-2 py-3 md:border-r lg:w-[var(--booker-main-width)]">
          <Calender date={date} onDateChange={setDate}/>
        </div>
        <div className="[grid-area:timeslots]  border--bsubtle flex w-full flex-col px-5 py-3 pb-0 h-full  md:w-[var(--booker-timeslots-width)]">
          <TimeSpots date={date}/>
        </div>
      </div>
    </main>

  )
}