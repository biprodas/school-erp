import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every controller file under `src/`. */
function controllers(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) controllers(path, out);
    else if (name.endsWith('.controller.ts')) out.push(path);
  }
  return out;
}

describe('upload rate limits (PRD 11.4)', () => {
  it('puts UPLOAD_THROTTLE on every handler that takes a file', () => {
    const missing: string[] = [];
    for (const file of controllers(join(__dirname, '..', '..'))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!line.includes('UseInterceptors(FileUpload(')) return;
        // The decorator block of the handler, above and below the upload.
        const block = lines.slice(Math.max(0, i - 6), i + 6).join('\n');
        if (!block.includes('@Throttle(UPLOAD_THROTTLE)'))
          missing.push(`${file}:${i + 1}`);
      });
    }
    expect(missing).toEqual([]);
  });
});
