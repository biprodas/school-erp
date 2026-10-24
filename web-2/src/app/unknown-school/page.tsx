import { notFound } from "next/navigation"

// `src/proxy.ts` rewrites hosts that aren't a school we serve (unknown or
// reserved slugs, inactive custom domains) here. `notFound()` makes it a 404
// and `app/not-found.tsx` shows the "school not found" message.
export default function UnknownSchoolPage() {
  notFound()
}
