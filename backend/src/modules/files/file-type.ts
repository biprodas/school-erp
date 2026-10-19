/**
 * Detects a file's real type from its first bytes, so a renamed `.exe`
 * can't pass as a PDF. Only the types the app accepts are recognized.
 */
export const MIME = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  csv: 'text/csv',
} as const;

export type AllowedMime = (typeof MIME)[keyof typeof MIME];

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length &&
  bytes.every((b, i) => buf[offset + i] === b);

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** True for valid UTF-8 text without NUL bytes (CSV uploads). */
function isText(buf: Buffer): boolean {
  if (!buf.length || buf.includes(0)) return false;
  try {
    utf8.decode(buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * The detected MIME type, or null when the content isn't one we accept. A
 * ZIP is reported as XLSX only when it contains the OOXML workbook part.
 */
export function detectMime(buf: Buffer): AllowedMime | null {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return MIME.png;
  }
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return MIME.jpeg;
  if (startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8)) {
    return MIME.webp;
  }
  if (startsWith(buf, ascii('%PDF-'))) return MIME.pdf;
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    return buf.includes('xl/workbook.xml') ? MIME.xlsx : MIME.zip;
  }
  return isText(buf) ? MIME.csv : null;
}
