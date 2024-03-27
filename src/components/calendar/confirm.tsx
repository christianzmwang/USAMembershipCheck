import * as React from "react"

import {cn} from "@/lib/utils"
import {useMediaQuery} from "@/hooks/use-media-query"
import {Button} from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {atom, useAtom, useSetAtom} from "jotai";
import {format} from "date-fns-tz";
import {formatRelative} from "date-fns"


export interface ConfirmStatus {
  start_at: string
  end_at: string
}

export const ConfigStatusAtom = atom<ConfirmStatus | null>(null)

export const Description = ({status}: { status: ConfirmStatus | null }) => {
  if (!status) {
    return null
  }
  return <DialogDescription className="flex gap-4 mt-8">
    <div className="bg-gray-200 px-4 py-1 rounded font-bold">
      {format(new Date(status.start_at), 'MMM dd, HH:mm', {timeZone: 'America/Los_Angeles'})}
    </div>
    <div className="bg-gray-200 px-4 py-1 rounded">
      20 minutes
    </div>
    {/*<div>*/}
    {/*  {formatRelative(new Date(status.start_at), new Date() )}*/}
    {/*</div>*/}
  </DialogDescription>

}

export function DrawerDialogDemo() {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [status, setStatus] = useAtom(ConfigStatusAtom)

  if (isDesktop) {
    return (
      <Dialog open={!!status} onOpenChange={() => setStatus(null)}>

        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Your Appointment</DialogTitle>
          </DialogHeader>
          <ProfileForm showBack/>
          <DrawerFooter className="pt-16">
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={() => setStatus(null)} variant="outline">Back</Button>
              <Button type="submit">Confirm</Button>
            </div>
          </DrawerFooter>
        </DialogContent>
      </Dialog>
    )
  }


  return (
    <Drawer open={status!=null} onClose={()=>setStatus(null)} >
      <DrawerContent className="">
        <DrawerHeader className="text-left">
          <DrawerTitle>Confirm Your Appointment</DrawerTitle>
          <Description status={status}/>
        </DrawerHeader>
        <ProfileForm className="px-4" />
        <DrawerFooter className="pt-16">
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={() => setStatus(null)} variant="outline">Back</Button>
            <Button type="submit">Confirm</Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ProfileForm({className, showBack}: React.ComponentProps<"form"> & { showBack?: boolean }) {
  const setStatus = useSetAtom(ConfigStatusAtom)
  return (
    <form className={cn("grid items-start gap-4", className)}>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input type="email" id="email" defaultValue="" required/>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="username">Kid First Name</Label>
          <Input id="username" defaultValue=""/>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="username">Kid Last Name</Label>
          <Input id="username" defaultValue=""/>
        </div>
      </div>


      <div className="grid gap-2">
        <Label htmlFor="username">Phone number</Label>
        <Input id="username" defaultValue=""/>
      </div>



    </form>
  )
}