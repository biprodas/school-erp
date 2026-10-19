import type { ConfigService } from '@nestjs/config';
import { PdfService } from './pdf.service';

// Renders with the real headless Chrome that Puppeteer downloads. The
// sandbox is off here only: the HTML is fixed test input, and Ubuntu 24+
// blocks the sandbox for downloaded Chrome builds (AppArmor userns rules).
jest.setTimeout(60_000);

describe('PdfService', () => {
  const service = new PdfService({
    get: () => ({
      concurrency: 2,
      executablePath: process.env.PDF_CHROME_PATH,
      noSandbox: true,
    }),
  } as unknown as ConfigService);

  afterAll(() => service.onApplicationShutdown());

  it('renders Bangla with the bundled Noto Bengali fonts embedded', async () => {
    const pdf = await service.render('smoke-test', {
      title: 'প্রগতি উচ্চ বিদ্যালয়',
      body: 'শিক্ষার্থীর নাম: মোঃ রহিম উদ্দিন, শ্রেণি: ষষ্ঠ, রোল: ১২',
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const raw = pdf.toString('latin1');
    expect(raw).toMatch(/NotoSansBengali/);
    expect(raw).toMatch(/NotoSerifBengali/);
  });

  it('renders thermal receipts 80 mm wide', async () => {
    const pdf = await service.renderHtml('<p>Receipt #000123 — ৳ ১,২০০</p>', {
      paper: '80mm',
    });
    // 80 mm ≈ 227 pt (Chrome rounds the width to whole pixels).
    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(
      pdf.toString('latin1'),
    );
    expect(Number(box?.[1])).toBeCloseTo(226.8, 0);
    expect(Number(box?.[2])).toBeGreaterThan(0);
  });

  it('rejects template names that could escape the templates folder', async () => {
    await expect(service.render('../secrets', {})).rejects.toThrow(
      /Invalid PDF template name/,
    );
  });
});
