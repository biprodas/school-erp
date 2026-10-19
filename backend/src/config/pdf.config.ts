import { registerAs } from '@nestjs/config';

export interface PdfConfig {
  /** Pages rendered at once by the shared headless browser. */
  concurrency: number;
  /** Use a system Chrome/Chromium instead of Puppeteer's download. */
  executablePath?: string;
  /**
   * Launch Chrome without its sandbox. Needed in containers that run as
   * root; prefer a non-root user instead.
   */
  noSandbox: boolean;
}

export default registerAs('pdf', (): PdfConfig => ({
  concurrency: parseInt(process.env.PDF_CONCURRENCY ?? '4', 10),
  executablePath: process.env.PDF_CHROME_PATH || undefined,
  noSandbox: process.env.PDF_NO_SANDBOX === 'true',
}));
