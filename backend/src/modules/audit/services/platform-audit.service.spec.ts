import { EntityManager, Repository } from 'typeorm';
import { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { AUDIT_ACTIONS } from '../audit-actions';
import { PlatformAuditLog } from '../entities/platform-audit-log.entity';
import { AuditActorType } from '../enums/audit-actor-type.enum';
import { PlatformAuditService } from './platform-audit.service';

describe('PlatformAuditService', () => {
  let service: PlatformAuditService;
  let repo: { create: jest.Mock; save: jest.Mock; findAndCount: jest.Mock };
  let userId: string | null;
  let platformRole: PlatformRole | null;

  beforeEach(() => {
    userId = 'super-1';
    platformRole = PlatformRole.SUPER_ADMIN;
    repo = {
      create: jest.fn((v: object) => v),
      save: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const context = {
      current: () => ({
        orgId: null,
        userId,
        isAdmin: false,
        platformRole,
        sessionId: null,
        ip: '192.0.2.1',
        userAgent: 'jest',
        requestId: 'req-p',
      }),
    };
    service = new PlatformAuditService(
      repo as unknown as Repository<PlatformAuditLog>,
      context as unknown as RequestContext,
    );
  });

  it('records a signed-in super-admin as platform, with the school concerned', async () => {
    await service.record({
      action: AUDIT_ACTIONS.ORGANIZATION_UPDATED,
      orgId: 'org-9',
      entityType: 'organization',
      entityId: 'org-9',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-9',
        actorUserId: 'super-1',
        actorType: AuditActorType.PLATFORM,
        requestId: 'req-p',
      }),
    );
  });

  it('records any console role (support too) as platform', async () => {
    platformRole = PlatformRole.SUPPORT;
    await service.record({ action: AUDIT_ACTIONS.LOGOUT });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: AuditActorType.PLATFORM }),
    );
  });

  it('records another signed-in platform user as a user', async () => {
    userId = 'member-1';
    platformRole = PlatformRole.USER;
    await service.record({ action: AUDIT_ACTIONS.LOGOUT });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'member-1',
        actorType: AuditActorType.USER,
      }),
    );
  });

  it('records a sign-in flow actor (nobody signed in) as a user', async () => {
    userId = null;
    platformRole = null;
    await service.record({ action: AUDIT_ACTIONS.LOGIN, actorUserId: 'u-2' });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'u-2',
        actorType: AuditActorType.USER,
      }),
    );
  });

  it('records work without an actor as the system', async () => {
    userId = null;
    platformRole = null;
    await service.record({ action: AUDIT_ACTIONS.ORGANIZATION_UPDATED });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        actorType: AuditActorType.SYSTEM,
      }),
    );
  });

  it("writes through the caller's transaction manager when given", async () => {
    const txRepo = { create: jest.fn((v: object) => v), save: jest.fn() };
    const manager = {
      getRepository: jest.fn(() => txRepo),
    } as unknown as EntityManager;

    await service.record(
      { action: AUDIT_ACTIONS.ORGANIZATION_CREATED },
      manager,
    );

    expect(txRepo.save).toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('records an anonymous sign-in failure with no school', async () => {
    userId = null;
    await service.record({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorUserId: null,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: null,
        actorUserId: null,
        actorType: AuditActorType.USER,
      }),
    );
  });

  it('pages the platform log, newest first', async () => {
    const page = await service.findFiltered({
      orgId: 'org-9',
      page: 3,
      limit: 5,
    });

    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: { orgId: 'org-9' },
      order: { createdAt: 'DESC', seq: 'DESC' },
      skip: 10,
      take: 5,
    });
    expect(page.meta).toEqual({ page: 3, limit: 5, total: 0, totalPages: 0 });
  });
});
