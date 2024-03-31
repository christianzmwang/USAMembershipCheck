import * as React from "react"
import {useForm} from "react-hook-form"
import {zodResolver} from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import {cn} from "@/lib/utils"
import {useMediaQuery} from "@/hooks/use-media-query"
import {Button} from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {Input} from "@/components/ui/input"
import {atom, useAtom} from "jotai";
import {format} from "date-fns-tz";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {z} from "zod";

import useFormPersist from 'react-hook-form-persist'
import {formSchema} from "@/app/api/trial/private_lesson/types";

export interface ConfirmStatus {
  start_at: string
  end_at: string
}

export const ConfigStatusAtom = atom<ConfirmStatus | null>(null)

export const Description = ({status}: { status: ConfirmStatus | null }) => {
  if (!status) {
    return null
  }
  return <div className="flex gap-4 py-4 sm:py-6 border-b border--bsubtle">
    <div className="bg-gray-200 px-4 py-1 rounded font-bold">
      {format(new Date(status.start_at), 'MMM dd, HH:mm', {timeZone: 'America/Los_Angeles'})}
    </div>
    <div className="bg-gray-200 px-4 py-1 rounded">
      20 minutes
    </div>
  </div>

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
          <ProfileForm setStatus={setStatus}/>

        </DialogContent>
      </Dialog>
    )
  }


  return (
    <Drawer open={status != null} onClose={() => setStatus(null)}>
      <DrawerContent className="max-h-[50%] h-full" >
        <div className="h-full">
          <DrawerHeader className="text-left pt-0">
            <DrawerTitle>Confirm Your Appointment</DrawerTitle>
            <Description status={status}/>
          </DrawerHeader>
          <div className="overflow-auto" style={{maxHeight: "calc(100% - 115px)"}}>
            <ProfileForm className="px-4" setStatus={setStatus}/>
          </div>
        </div>


      </DrawerContent>
    </Drawer>
  )
}

function ProfileForm({className, setStatus}: React.ComponentProps<"form"> & { setStatus: (v: any) => void }) {
  const [loading, setLoading] = React.useState(false)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  })

  useFormPersist("form-persist", {
    watch: form.watch,
    setValue: form.setValue,
    storage: window.localStorage,
  });
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("onSubmit", data)
    setLoading(true)
  }
  const fields: {
    name: keyof z.infer<typeof formSchema>
    type: string,
    placeholder?: string
  }[] = [
    {name: "email", type: "email"},
    {name: "parent_name", type: "text"},
    {name: "child_name", type: "text"},
    {name: "child_age", type: "number", placeholder: "number only"},
    {name: "phone", type: "tel", placeholder: "e.g. 4086180000"},
  ]


  return (
    <Form {...form} >
      <form className={cn("grid items-start gap-4", className)} onSubmit={form.handleSubmit(data => console.log("!", data))}>
        {
          fields.map(({name, type, placeholder}) => {
            return (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({field}) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="flex justify-between capitalize">
                        {name.replace("_", " ")}

                      <FormMessage/>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={placeholder} {...field} type={type}/>
                    </FormControl>

                  </FormItem>
                )}
              />
            )
          })
        }
        <div className="grid grid-cols-2 gap-4 pb-4">
          <Button disabled={loading} onClick={() => setStatus(null)} variant="outline">Back</Button>
          {
            loading ?
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </Button>
              :
              <Button type="submit">Confirm</Button>
          }
        </div>

      </form>
    </Form>
  )
}