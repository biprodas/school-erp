import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Font families every PDF template can use. */
export const PDF_FONT_STACK = {
  sans: "'Noto Sans Bengali', 'Noto Sans', sans-serif",
  serif: "'Noto Serif Bengali', 'Noto Serif', serif",
};

const FACES: Array<{ pkg: string; family: string; weight: 400 | 700 }> = [
  { pkg: 'noto-sans-bengali', family: 'Noto Sans Bengali', weight: 400 },
  { pkg: 'noto-sans-bengali', family: 'Noto Sans Bengali', weight: 700 },
  { pkg: 'noto-serif-bengali', family: 'Noto Serif Bengali', weight: 400 },
  { pkg: 'noto-serif-bengali', family: 'Noto Serif Bengali', weight: 700 },
];
/** Fontsource splits each face by script; Bangla text needs `bengali`. */
const SUBSETS = ['bengali', 'latin'];

let css: string | undefined;

/**
 * `@font-face` rules with the bundled Noto Bengali fonts inlined as data
 * URIs, so rendering never depends on fonts installed on the server and
 * Bangla conjuncts are shaped correctly. Built once, then cached.
 */
export function pdfFontCss(): string {
  if (css) return css;
  const rules: string[] = [];
  for (const { pkg, family, weight } of FACES) {
    const dir = join(
      dirname(require.resolve(`@fontsource/${pkg}/package.json`)),
      'files',
    );
    for (const subset of SUBSETS) {
      const file = join(dir, `${pkg}-${subset}-${weight}-normal.woff2`);
      const data = readFileSync(file).toString('base64');
      rules.push(
        `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
          `font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');}`,
      );
    }
  }
  css = rules.join('\n');
  return css;
}
