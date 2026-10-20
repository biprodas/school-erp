import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  FilterAuditLogDto,
  FilterPlatformAuditLogDto,
} from './filter-audit-log.dto';

/** Property names that fail, validated like the global ValidationPipe. */
async function failing(cls: new () => object, query: object) {
  const result = await validate(plainToInstance(cls, query), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return result.map((e) => e.property).sort();
}

describe('FilterAuditLogDto', () => {
  it.each([
    '2026-10-01',
    '2024-02-29',
    '2026-10-01T00:00:00Z',
    '2026-10-01T06:00:00+06:00',
  ])('accepts the instant %s', async (value) => {
    expect(
      await failing(FilterAuditLogDto, { from: value, to: value }),
    ).toEqual([]);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-10-01T25:00:00Z', 'yesterday'])(
    'rejects %s',
    async (value) => {
      expect(
        await failing(FilterAuditLogDto, { from: value, to: value }),
      ).toEqual(['from', 'to']);
    },
  );

  it('applies the same rules on the platform log', async () => {
    expect(
      await failing(FilterPlatformAuditLogDto, { from: '2026-02-30' }),
    ).toEqual(['from']);
  });
});
