import { PDFDocument } from 'pdf-lib';
import { mergePdfs } from './pdf-merge';

const pdfWith = async (pages: number) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 300]);
  return Buffer.from(await doc.save());
};

describe('mergePdfs', () => {
  it('keeps every page of every part, in order', async () => {
    const merged = await PDFDocument.load(
      await mergePdfs([await pdfWith(1), await pdfWith(2), await pdfWith(1)]),
    );
    expect(merged.getPages().map((p) => p.getWidth())).toEqual([
      200, 200, 201, 200,
    ]);
  });
});
