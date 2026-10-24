import {
  get,
  set,
  type FieldErrors,
  type FieldValues,
  type Resolver,
} from "react-hook-form"
import type { z } from "zod"

/**
 * react-hook-form resolver for a zod schema. Written here instead of using
 * `@hookform/resolvers`, whose optional peer dependencies conflict with
 * zod 4 under npm's resolver. Keeps the first issue per field; issues
 * without a path go to `errors.root`.
 */
export function zodResolver<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>
): Resolver<Input, unknown, Output> {
  return async (values) => {
    const result = await schema.safeParseAsync(values)
    if (result.success) return { values: result.data, errors: {} }

    const errors: FieldErrors<Input> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.map(String).join(".") || "root"
      if (get(errors, path)) continue
      set(errors, path, { type: issue.code, message: issue.message })
    }
    return { values: {}, errors }
  }
}
