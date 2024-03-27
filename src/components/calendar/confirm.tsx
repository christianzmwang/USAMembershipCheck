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
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {atom, useAtom} from "jotai";
import {format} from "date-fns-tz";


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

function ProfileForm({className}: React.ComponentProps<"form"> & { showBack?: boolean }) {
  return (
    <form className={cn("grid items-start gap-4", className)}>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input type="email" id="email" defaultValue="" required/>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dependent_name">Dependent Name</Label>
        <Input id="dependent_name" defaultValue=""/>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="kid_name">Kid Name</Label>
        <Input id="kid_name" defaultValue="" pattern="\w*\s\w*" required/>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="age">Kid Age</Label>
        <Input type="number" id="age" defaultValue=""/>
      </div>


      <div className="grid gap-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" type="tel" defaultValue=""/>
      </div>


    </form>
  )
}