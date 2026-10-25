/** A page's `searchParams` (a promise in Next 16). */
export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>

/** One query value; the first when a key repeats. */
export async function param(
  searchParams: SearchParams,
  name: string
): Promise<string | null> {
  const value = (await searchParams)[name]
  return (Array.isArray(value) ? value[0] : value) ?? null
}
