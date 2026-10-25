/**
 * "Chrome on Windows" from a user agent, enough to tell sign-ins apart in
 * the session list. Null parts when the agent doesn't say.
 */
export function describeUserAgent(ua: string | null | undefined): {
  browser: string | null
  os: string | null
} {
  if (!ua) return { browser: null, os: null }
  return { browser: browserOf(ua), os: osOf(ua) }
}

function browserOf(ua: string): string | null {
  // Order matters: Edge and Opera also say Chrome, Chrome also says Safari.
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge"
  if (/OPR\/|Opera/.test(ua)) return "Opera"
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet"
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox"
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome"
  if (/Safari\//.test(ua)) return "Safari"
  return null
}

function osOf(ua: string): string | null {
  if (/Windows/.test(ua)) return "Windows"
  if (/Android/.test(ua)) return "Android"
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS"
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS"
  if (/CrOS/.test(ua)) return "ChromeOS"
  if (/Linux/.test(ua)) return "Linux"
  return null
}
