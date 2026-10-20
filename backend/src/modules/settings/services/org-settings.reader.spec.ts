import type { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { settingsCache } from '../settings.cache';
import { OrgSettingsReader } from './org-settings.reader';

describe('OrgSettingsReader', () => {
  const findOne = jest.fn();
  const release = jest.fn();
  const connections = {
    getScopedConnection: jest.fn(() =>
      Promise.resolve({ getRepository: () => ({ findOne }), release }),
    ),
  };
  const reader = new OrgSettingsReader(
    connections as unknown as TenantConnectionService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    settingsCache.invalidate();
  });

  it("reads the school's row on a connection scoped to it, then caches", async () => {
    findOne.mockResolvedValue({ security: { sessionIdleMinutes: 30 } });

    expect((await reader.get('org-1')).security.sessionIdleMinutes).toBe(30);
    expect((await reader.get('org-1')).locale.timeZone).toBe('Asia/Dhaka');

    expect(connections.getScopedConnection).toHaveBeenCalledTimes(1);
    expect(connections.getScopedConnection).toHaveBeenCalledWith('org-1');
    expect(findOne).toHaveBeenCalledWith({ where: { orgId: 'org-1' } });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases the connection when the read fails', async () => {
    findOne.mockRejectedValue(new Error('db down'));

    await expect(reader.get('org-2')).rejects.toThrow('db down');
    expect(release).toHaveBeenCalled();
  });
});
