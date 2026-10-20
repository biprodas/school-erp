import { FindOperator } from 'typeorm';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { AUDIT_ACTIONS } from '../audit-actions';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let repo: {
    saveNew: jest.Mock;
    findFiltered: jest.Mock<
      Promise<unknown>,
      [Record<string, unknown>, unknown]
    >;
  };

  beforeEach(() => {
    repo = {
      saveNew: jest.fn(),
      findFiltered: jest.fn<
        Promise<unknown>,
        [Record<string, unknown>, unknown]
      >(),
    };
    const context = {
      current: () => ({
        orgId: 'org-1',
        userId: 'u1',
        isAdmin: true,
        sessionId: 's1',
        ip: '198.51.100.1',
        userAgent: 'jest',
        requestId: 'req-1',
      }),
    };
    service = new AuditService(
      repo as unknown as AuditLogRepository,
      context as unknown as RequestContext,
    );
  });

  it('writes one row through the tenant repository', async () => {
    await service.record({
      action: AUDIT_ACTIONS.ROLE_DELETED,
      entityType: 'role',
      entityId: 'r1',
      before: { name: 'coach' },
    });

    expect(repo.saveNew).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'role.deleted',
        entityId: 'r1',
        before: { name: 'coach' },
        after: null,
        actorUserId: 'u1',
        ip: '198.51.100.1',
        requestId: 'req-1',
      }),
    );
  });

  describe('findFiltered', () => {
    const whereOf = () => repo.findFiltered.mock.calls[0][0];

    it('matches a full action exactly and passes paging through', async () => {
      const filter = { action: 'auth.account_locked', page: 2, limit: 10 };
      await service.findFiltered(filter);

      expect(whereOf()).toEqual({ action: 'auth.account_locked' });
      expect(repo.findFiltered.mock.calls[0][1]).toBe(filter);
    });

    it('treats an action ending in "." as a prefix, escaping "_"', async () => {
      await service.findFiltered({ action: 'role_x.' });

      const action = whereOf().action as FindOperator<string>;
      expect(action.type).toBe('like');
      expect(action.value).toBe('role\\_x.%');
    });

    it('filters by entity, actor and a time window', async () => {
      await service.findFiltered({
        entityType: 'user',
        entityId: 'u9',
        actorUserId: '00000000-0000-4000-8000-000000000009',
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-02T00:00:00Z',
      });

      const where = whereOf();
      expect(where).toMatchObject({
        entityType: 'user',
        entityId: 'u9',
        actorUserId: '00000000-0000-4000-8000-000000000009',
      });
      expect((where.createdAt as FindOperator<unknown>).type).toBe('and');
    });

    it('uses a single bound when only one is given', async () => {
      await service.findFiltered({ from: '2026-10-01T00:00:00Z' });
      expect((whereOf().createdAt as FindOperator<unknown>).type).toBe(
        'moreThanOrEqual',
      );
    });
  });
});
