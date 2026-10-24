import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  collectErrorCodes,
  renderErrorCodes,
} from '../src/common/errors/error-codes';

/** Writes `doc/error-codes.md` from the codes thrown in `src/`. */
const root = join(__dirname, '..', 'src');
const entries = collectErrorCodes(root);
writeFileSync(
  join(__dirname, '..', '..', 'doc', 'error-codes.md'),
  renderErrorCodes(entries),
);
console.log(`doc/error-codes.md: ${entries.length} codes`);
