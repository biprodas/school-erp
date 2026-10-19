import { detectMime, MIME } from './file-type';

const bytes = (...b: number[]) => Buffer.from(b);

describe('detectMime', () => {
  it('detects images and PDF by their signatures', () => {
    expect(
      detectMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    ).toBe(MIME.png);
    expect(detectMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(MIME.jpeg);
    expect(detectMime(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe(MIME.webp);
    expect(detectMime(Buffer.from('%PDF-1.7\n...'))).toBe(MIME.pdf);
  });

  it('tells an XLSX workbook from a plain ZIP', () => {
    const zip = Buffer.concat([
      bytes(0x50, 0x4b, 0x03, 0x04),
      Buffer.from('foo.txt'),
    ]);
    const xlsx = Buffer.concat([
      bytes(0x50, 0x4b, 0x03, 0x04),
      Buffer.from('xl/workbook.xml'),
    ]);
    expect(detectMime(zip)).toBe(MIME.zip);
    expect(detectMime(xlsx)).toBe(MIME.xlsx);
  });

  it('accepts UTF-8 text (including Bangla) as CSV', () => {
    expect(detectMime(Buffer.from('name,class\nরহিম,৬\n'))).toBe(MIME.csv);
  });

  it('rejects binaries and invalid text', () => {
    expect(detectMime(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // PE/EXE
    expect(detectMime(bytes(0xc3, 0x28))).toBeNull(); // invalid UTF-8
    expect(detectMime(Buffer.alloc(0))).toBeNull();
  });
});
