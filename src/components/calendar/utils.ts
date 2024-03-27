import { formatInTimeZone } from "date-fns-tz";

export const toLocalString = (date: Date) => {
  return formatInTimeZone(date, 'America/Los_Angeles', 'yyyy-MM-dd HH:mm:ssXXX')
}