import type { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { NumberingService } from './numbering.service';

describe('NumberingService', () => {
  const query = jest.fn();
  const ds = {
    orgId: 'org-a',
    getManager: () => ({ query }),
  } as unknown as TenantDataSourceProxy;
  const service = new NumberingService(ds);

  beforeEach(() => query.mockReset());

  it('upserts the counter for this org and returns the value it took', async () => {
    query.mockResolvedValue([{ value: '41' }]);

    await expect(service.next('receipt', '2026')).resolves.toBe(41);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT ("org_id", "key", "scope")'),
      ['org-a', 'receipt', '2026'],
    );
  });

  it('formats the next value through a pattern', async () => {
    query.mockResolvedValue([{ value: '7' }]);

    await expect(
      service.nextFormatted('student_id', '{YY}{CLASS}{SEQ:4}', '2026', {
        date: new Date(2026, 5, 1),
        classCode: '09',
      }),
    ).resolves.toBe('26090007');
  });
});
