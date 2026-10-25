import {
  get,
  set,
  type FieldErrors,
  type FieldValues,
  type Resolver,
} from "react-hook-form"
import { safeParseAsync, type $ZodType } from "zod/v4/core"

/**
 * react-hook-form resolver for a zod schema. Written here instead of using
 * `@hookform/resolvers`, whose optional peer dependencies conflict with
 * zod 4 under npm's resolver. Keeps the first issue per field; issues
 * without a path go to `errors.root`. Takes any zod 4 schema (the forms
 * use `zod/mini`), through zod's shared core.
 */
export function zodResolver<Input extends FieldValues, Output>(
  schema: $ZodType<Output, Input>
): Resolver<Input, unknown, Output> {
  return async (values) => {
    const result = await safeParseAsync(schema, values)
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
