import { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { RbacSeederService } from './rbac-seeder.service';
import { SYSTEM_ROLES } from './system-roles.seed';

describe('RbacSeederService', () => {
  const buildHarness = (existingRole: unknown) => {
    const roleRepo = {
      findOne: jest.fn().mockResolvedValue(existingRole),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    const proxy = {
      getRepository: jest.fn().mockReturnValue(roleRepo),
      release: jest.fn(),
    };
    const connectionService = {
      getScopedConnection: jest.fn().mockResolvedValue(proxy),
    };
    const service = new RbacSeederService(
      connectionService as unknown as TenantConnectionService,
    );
    return { service, roleRepo, proxy };
  };

  it('seeds every system role into an empty schema and releases the connection', async () => {
    const { service, roleRepo, proxy } = buildHarness(null);

    await service.seedSystemRoles('tenant_acme');

    expect(roleRepo.save).toHaveBeenCalledTimes(SYSTEM_ROLES.length);
    expect(roleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isSystem: true }),
    );
    expect(proxy.release).toHaveBeenCalled();
  });

  it('is idempotent — skips roles that already exist', async () => {
    const { service, roleRepo } = buildHarness({ id: 'existing' });

    await service.seedSystemRoles('tenant_acme');

    expect(roleRepo.save).not.toHaveBeenCalled();
  });

  it('releases the connection even when seeding fails', async () => {
    const { service, roleRepo, proxy } = buildHarness(null);
    roleRepo.save.mockRejectedValueOnce(new Error('db error'));

    await expect(service.seedSystemRoles('tenant_acme')).rejects.toThrow(
      'db error',
    );
    expect(proxy.release).toHaveBeenCalled();
  });
});
