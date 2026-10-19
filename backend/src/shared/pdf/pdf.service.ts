import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Browser, type PDFOptions } from 'puppeteer';
import type { PdfConfig } from '~/config';
import { PDF_FONT_STACK, pdfFontCss } from './pdf-fonts';

export type PdfPaper =
  'A4' | 'A4-landscape' | 'Legal' | 'Legal-landscape' | '80mm';

export interface PdfRenderOptions {
  paper?: PdfPaper;
  /** CSS margin shorthand for A4/Legal, e.g. `12mm`. */
  margin?: string;
  /** Extra CSS appended after the base styles. */
  css?: string;
}

const TEMPLATE_DIR = join(__dirname, 'templates');

/**
 * HTML → PDF with headless Chrome. One shared browser, at most
 * `PDF_CONCURRENCY` pages at once; call it from `pdf` queue jobs, never
 * from a request handler. Templates are Handlebars files in `templates/`.
 */
@Injectable()
export class PdfService implements OnApplicationShutdown {
  private readonly logger = new Logger(PdfService.name);
  private readonly cfg: PdfConfig;
  private browser?: Promise<Browser>;
  private readonly compiled = new Map<string, Handlebars.TemplateDelegate>();
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(config: ConfigService) {
    this.cfg = config.get<PdfConfig>('pdf')!;
  }

  /** Renders `templates/<name>.hbs` with `data`. */
  async render(
    template: string,
    data: Record<string, unknown>,
    options: PdfRenderOptions = {},
  ): Promise<Buffer> {
    return this.renderHtml(this.template(template)(data), options);
  }

  /** Renders a body HTML fragment inside the base layout (fonts, reset). */
  async renderHtml(
    bodyHtml: string,
    options: PdfRenderOptions = {},
  ): Promise<Buffer> {
    const html = layout(bodyHtml, options.css);
    await this.acquire();
    try {
      const page = await (await this.getBrowser()).newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const pdf = await page.pdf(await pdfOptions(page, options));
        return Buffer.from(pdf);
      } finally {
        await page.close();
      }
    } finally {
      this.release();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.browser) return;
    try {
      await (await this.browser).close();
    } catch (err) {
      this.logger.warn(`Closing the PDF browser failed: ${String(err)}`);
    }
  }

  private template(name: string): Handlebars.TemplateDelegate {
    if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(name)) {
      throw new Error(`Invalid PDF template name "${name}"`);
    }
    let tpl = this.compiled.get(name);
    if (!tpl) {
      const source = readFileSync(join(TEMPLATE_DIR, `${name}.hbs`), 'utf8');
      tpl = Handlebars.compile(source, { strict: true });
      this.compiled.set(name, tpl);
    }
    return tpl;
  }

  private getBrowser(): Promise<Browser> {
    this.browser ??= puppeteer
      .launch({
        headless: true,
        executablePath: this.cfg.executablePath,
        args: this.cfg.noSandbox
          ? ['--no-sandbox', '--disable-setuid-sandbox']
          : [],
      })
      .catch((err: unknown) => {
        this.browser = undefined; // let the next call retry
        throw err;
      });
    return this.browser;
  }

  private async acquire(): Promise<void> {
    if (this.active < this.cfg.concurrency) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
}

function layout(body: string, extraCss = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${pdfFontCss()}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:${PDF_FONT_STACK.sans};font-size:11pt;line-height:1.4;color:#111;
-webkit-print-color-adjust:exact;print-color-adjust:exact}
.serif{font-family:${PDF_FONT_STACK.serif}}
table{border-collapse:collapse;width:100%}
${extraCss}
</style></head><body>${body}</body></html>`;
}

async function pdfOptions(
  page: import('puppeteer').Page,
  { paper = 'A4', margin = '12mm' }: PdfRenderOptions,
): Promise<PDFOptions> {
  if (paper === '80mm') {
    // Thermal receipts: fixed width, height follows the content.
    await page.setViewport({ width: 302, height: 100 }); // 80mm at 96dpi
    const heightPx = await page.evaluate(() => document.body.scrollHeight);
    return {
      width: '80mm',
      height: `${Math.ceil(heightPx) + 8}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    };
  }
  const [format, orientation] = paper.split('-') as ['A4' | 'Legal', string?];
  return {
    format,
    landscape: orientation === 'landscape',
    printBackground: true,
    margin: { top: margin, right: margin, bottom: margin, left: margin },
  };
}
