import { redirect } from "next/navigation"

export default function Page() {
  // Make homepage redirect to USA Members dashboard
  redirect('/usa-members')
}