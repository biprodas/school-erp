import { PDFDocument } from 'pdf-lib';

/**
 * Joins PDFs page by page, in order, without rendering them again (a
 * section's report cards from the students' own cards). Fonts and images
 * are copied per document, so the result is about the sum of the inputs.
 */
export async function mergePdfs(parts: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const part of parts) {
    const doc = await PDFDocument.load(part);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return Buffer.from(await merged.save());
}
