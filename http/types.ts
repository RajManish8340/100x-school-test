
import { z } from 'zod'

export const SignupSchema = z.object({
   name: z.string(),
   email: z.email(),
   password: z.string().min(6),
   role: z.enum(['student', 'teacher'])
})
