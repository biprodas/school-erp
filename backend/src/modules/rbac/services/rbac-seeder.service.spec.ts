import { EntityManager } from 'typeorm';
import { RbacSeederService } from './rbac-seeder.service';
import { SYSTEM_ROLES } from '../system-roles.seed';

describe('RbacSeederService', () => {
  const buildHarness = (existingRole: unknown) => {
    const roleRepo = {
      findOne: jest.fn().mockResolvedValue(existingRole),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(roleRepo),
    } as unknown as EntityManager;
    return { service: new RbacSeederService(), roleRepo, manager };
  };

  it('seeds every system role for the organization', async () => {
    const { service, roleRepo, manager } = buildHarness(null);

    await service.seedSystemRoles(manager, 'org-acme');

    expect(roleRepo.save).toHaveBeenCalledTimes(SYSTEM_ROLES.length);
    expect(roleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isSystem: true, orgId: 'org-acme' }),
    );
    expect(roleRepo.findOne).toHaveBeenCalledWith({
      where: { orgId: 'org-acme', name: SYSTEM_ROLES[0].name },
    });
  });

  it('is idempotent — skips roles that already exist', async () => {
    const { service, roleRepo, manager } = buildHarness({ id: 'existing' });

    await service.seedSystemRoles(manager, 'org-acme');

    expect(roleRepo.save).not.toHaveBeenCalled();
  });

  it('propagates failures so the creation transaction rolls back', async () => {
    const { service, roleRepo, manager } = buildHarness(null);
    roleRepo.save.mockRejectedValueOnce(new Error('db error'));

    await expect(service.seedSystemRoles(manager, 'org-acme')).rejects.toThrow(
      'db error',
    );
  });
});
