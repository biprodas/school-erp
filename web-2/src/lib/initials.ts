/** "Rafiq Ahmed" → "RA"; an email or phone → its first character. */
export function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean)
  const letters =
    words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [name[0] ?? "?"]
  return letters.join("").toUpperCase()
}
