import {z} from "zod";

export const formSchema = z.object({
  email: z.string().email(),
  parent_name: z.string().regex(/^([a-zA-Z]+\s+)\w+$/, "Full name with a space between"),
  child_name: z.string().regex(/^([a-zA-Z]+\s+)\w+$/, "Full name with a space between"),
  child_age: z.coerce.number().int().optional(),
  phone: z.string().optional(),
})
export const requestSchema = formSchema.and(z.object({
  start_at: z.string(),
}))