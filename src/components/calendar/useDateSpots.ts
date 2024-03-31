import {useEffect, useState} from "react";
import {object} from "prop-types";
import {PIKE13} from "@/lib/pike13";


export const useDateSpots = (date: Date) => {
//   GET /api/v2/front/appointments/:service_id/available_slots
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [cnt, setCnt] = useState(0)


  useEffect(() => {
    setLoading(true)
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    const urlParams = new URLSearchParams({
      from: startOfMonth.toISOString(),
      to: endOfMonth.toISOString(),
      location_id: PIKE13.PLEASANTON_LOCATION_ID,
      staff_member_ids: PIKE13.COACH_SANDRO_ID,
      client_id: 'Rzpi1cwTXjyteuxJblCA8QDZXKBBvPH1H4BmrG15'
    })
    setCnt((prev)=> {
      fetch(`https://bayareafencing.pike13.com/api/v2/front/appointments/${PIKE13.TRIAL_PRIVATE_SERVICE_ID}/available_slots/summary?${urlParams.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (prev  === cnt) {
            setData(data)
            setLoading(false)
          }
        })
        .catch(err => {
          console.error(err)
          setLoading(false)
        })
      return prev + 1
    })



  }, [date]);

  return {
    loading,
    data
  }
}