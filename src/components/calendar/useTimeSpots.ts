import {useEffect, useState} from "react";
import {object} from "prop-types";
import {toLocalString} from "@/components/calendar/utils";


export const useTimeSpots = (date?: Date) => {
//   GET /api/v2/front/appointments/:service_id/available_slots
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>([])


  useEffect(() => {
    if (!date) {
      return
    }
    setLoading(true)
    const urlParams = new URLSearchParams({
      date: toLocalString(date),
      location_id: '41604',
      staff_member_ids: '11852848',
      client_id: 'Rzpi1cwTXjyteuxJblCA8QDZXKBBvPH1H4BmrG15'
    })

    fetch(`https://bayareafencing.pike13.com/api/v2/front/appointments/323230/available_slots?${urlParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        setData(data.available_slots)
        console.log(data.available_slots)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })

  }, [date]);

  return {
    loading,
    data
  }
}