import { E2E } from "./env"

interface MailSummary {
  ID: string
  Created: string
}

/**
 * The newest email to `to` whose body matches `pattern`, polling Mailpit
 * (the backend sends mail from a queue). Returns the first capture group.
 */
export async function linkFromMail(
  to: string,
  pattern: RegExp,
  { timeoutMs = 30_000 }: { timeoutMs?: number } = {}
): Promise<string> {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const list = (await (
      await fetch(
        `${E2E.mailpit}/search?query=${encodeURIComponent(`to:${to}`)}`
      )
    ).json()) as { messages?: MailSummary[] }
    for (const summary of list.messages ?? []) {
      const message = (await (
        await fetch(`${E2E.mailpit}/message/${summary.ID}`)
      ).json()) as { HTML?: string; Text?: string }
      const match = pattern.exec(message.HTML ?? message.Text ?? "")
      if (match?.[1]) return match[1].replaceAll("&amp;", "&")
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(
    `No email to ${to} matching ${pattern} within ${timeoutMs} ms`
  )
}
