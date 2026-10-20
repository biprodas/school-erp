import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { AUDIT_ACTIONS } from '../audit-actions';
import { PlatformAuditLog } from '../entities/platform-audit-log.entity';
import { AuditActorType } from '../enums/audit-actor-type.enum';
import { PlatformAuditService } from './platform-audit.service';

describe('PlatformAuditService', () => {
  let service: PlatformAuditService;
  let repo: { create: jest.Mock; save: jest.Mock; findAndCount: jest.Mock };
  let userId: string | null;

  beforeEach(() => {
    userId = 'super-1';
    repo = {
      create: jest.fn((v: object) => v),
      save: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const context = {
      current: () => ({
        orgId: null,
        userId,
        isAdmin: true,
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

  it('records a signed-in actor as platform, with the school concerned', async () => {
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
      order: { createdAt: 'DESC' },
      skip: 10,
      take: 5,
    });
    expect(page.meta).toEqual({ page: 3, limit: 5, total: 0, totalPages: 0 });
  });
});
