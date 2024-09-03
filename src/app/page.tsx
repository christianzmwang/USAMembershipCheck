"use client"

import Calender from "@/components/calendar/calender";
import {useState, useEffect} from "react";
import {TimeSpots} from "@/components/calendar/time-spots";

// <p className="text-xl font-bold  leading-relaxed">Pleasanton</p>

export default function MainComponent() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [date, setDate] = useState<Date | undefined>(new Date())

  const locations = [
    { id: "pleasanton", name: "Pleasanton", address: "5870 Stoneridge Dr Suite 6, Pleasanton"},
    { id: "los-gatos", name: "Los Gatos", address: "15445 Los Gatos Blvd, Los Gatos"}
  ];

  const [location, setLocation] = useState("Los Gatos");

  const selectedLocation = locations.find(loc => loc.name === location);

  const handleLocationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLocation(event.target.value);
  };

  return (
    <main className="flex h-full main" >

      <div style={{height: "auto"}}
        className="main-grid bg-default dark:bg-muted grid max-w-full items-start dark:[color-scheme:dark] sm:motion-reduce:transition-none md:flex-row rounded-md  sm:transition-[width] sm:duration-300 h-auto bg-background">
        <div className="p-4	 relative z-10 flex flex-col [grid-area:meta] border-b border--bsubtle" style={{height: "auto"}}>
          <h2 className="text-2xl  leading-relaxed"> Free Introductory Class </h2>
          <div className="mt-2">
            <div style={{ height: "auto" }} className="main-grid bg-default dark:bg-muted grid max-w-full items-start dark:[color-scheme:dark] sm:motion-reduce">
              <div className="mb-4">
                <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                  Select Location
                </label>
                <select
                  id="location"
                  name="location"
                  value={location}
                  onChange={handleLocationChange}
                  className="mt-1 bloack w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <p className="text-sm  leading-relaxed">
            Book a free introductory class with us!<br/>
            Address: <span className="underline">{selectedLocation?.address}</span>
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