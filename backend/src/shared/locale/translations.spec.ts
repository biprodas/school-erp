import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_LOCALE, LOCALES } from './locales';

/** `src/i18n/<locale>/<ns>.json`, flattened to `ns.path → text`. */
const dir = join(__dirname, '..', '..', 'i18n');

const flatten = (value: unknown, prefix: string, out: Map<string, string>) => {
  if (typeof value === 'string') out.set(prefix, value);
  else if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
  return out;
};

const catalog = (locale: string) => {
  const out = new Map<string, string>();
  for (const file of readdirSync(join(dir, locale)).filter((f) =>
    f.endsWith('.json'),
  ))
    flatten(
      JSON.parse(readFileSync(join(dir, locale, file), 'utf8')),
      file.replace(/\.json$/, ''),
      out,
    );
  return out;
};

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('translations', () => {
  const reference = catalog(DEFAULT_LOCALE);

  it('have a folder for every locale and nothing else', () => {
    expect(readdirSync(dir).sort()).toEqual([...LOCALES].sort());
  });

  it.each(LOCALES.filter((l) => l !== DEFAULT_LOCALE))(
    '%s has exactly the English keys, with the same {placeholders}',
    (locale) => {
      const texts = catalog(locale);
      expect([...texts.keys()].sort()).toEqual([...reference.keys()].sort());
      for (const [key, english] of reference) {
        expect([key, placeholders(texts.get(key)!)]).toEqual([
          key,
          placeholders(english),
        ]);
        expect([key, texts.get(key)!.trim()]).not.toEqual([key, '']);
      }
    },
  );
});
