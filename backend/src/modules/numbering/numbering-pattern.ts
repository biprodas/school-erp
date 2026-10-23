/** Values a numbering pattern can use. */
export interface NumberingContext {
  /** Defaults to now. */
  date?: Date;
  /** Class code for `{CLASS}`, e.g. `06`. */
  classCode?: string;
}

const TOKEN = /\{(YYYY|YY|MM|CLASS|SEQ(?::(\d{1,2}))?)\}/g;

/**
 * Renders a pattern such as `{YY}{CLASS}{SEQ:4}` → `26060042`.
 * Tokens: `{YYYY}`, `{YY}`, `{MM}`, `{CLASS}`, `{SEQ}` / `{SEQ:n}` (zero-padded
 * to n digits). Anything else is copied as is.
 */
export function formatNumber(
  pattern: string,
  seq: number | bigint,
  ctx: NumberingContext = {},
): string {
  const date = ctx.date ?? new Date();
  return pattern.replace(TOKEN, (_, token: string, width?: string) => {
    switch (token) {
      case 'YYYY':
        return String(date.getFullYear());
      case 'YY':
        return String(date.getFullYear() % 100).padStart(2, '0');
      case 'MM':
        return String(date.getMonth() + 1).padStart(2, '0');
      case 'CLASS':
        if (!ctx.classCode) {
          throw new Error('Pattern uses {CLASS} but no class code was given');
        }
        return ctx.classCode;
      default:
        return String(seq).padStart(width ? Number(width) : 0, '0');
    }
  });
}

/** Throws unless the pattern contains exactly one `{SEQ}` token. */
export function assertValidPattern(pattern: string): void {
  const seqs = [...pattern.matchAll(TOKEN)].filter(([, t]) =>
    t.startsWith('SEQ'),
  );
  if (seqs.length !== 1) {
    throw new Error('A numbering pattern needs exactly one {SEQ} token');
  }
}

/**
 * The pattern with `{SEQ}` taken out and the rest rendered, e.g.
 * `{YY}{CLASS}{SEQ:4}` → `2606`. Used as the counter scope, so each prefix
 * (year and class) counts from 1 and numbers never repeat.
 */
export function patternScope(
  pattern: string,
  ctx: NumberingContext = {},
): string {
  return formatNumber(pattern.replace(/\{SEQ(?::\d{1,2})?\}/g, ''), 0, ctx);
}

/** Whether the pattern needs a class code (`{CLASS}`). */
export const usesClassCode = (pattern: string) => pattern.includes('{CLASS}');
