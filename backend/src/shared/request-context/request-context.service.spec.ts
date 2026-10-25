import { CLS_REQ, ClsService, ClsServiceManager } from 'nestjs-cls';
import { RequestContext } from './request-context.service';

describe('RequestContext', () => {
  const cls: ClsService = ClsServiceManager.getClsService();
  const context = new RequestContext(cls);

  const expressLike = (
    headers: Record<string, string>,
    extra: object = {},
  ) => ({
    headers,
    ip: '10.0.0.1',
    header: (name: string) => headers[name.toLowerCase()],
    ...extra,
  });

  it('is empty outside a CLS context', () => {
    expect(context.current()).toMatchObject({
      userId: null,
      ip: null,
      requestId: null,
    });
  });

  it('reads the actor, client and request id from the current request', () => {
    // X-Forwarded-For is Express's business (`trust proxy`): only req.ip counts.
    const req = expressLike(
      {
        'x-request-id': 'req-1',
        'x-forwarded-for': '203.0.113.7, 10.0.0.2',
        'user-agent': 'Mozilla',
      },
      {
        orgId: 'org-1',
        user: {
          userId: 'u1',
          isAdmin: true,
          platformRole: 'support',
          sessionId: 's1',
        },
      },
    );

    const snapshot = cls.run(() => {
      cls.set(CLS_REQ, req);
      return context.current();
    });

    expect(snapshot).toEqual({
      orgId: 'org-1',
      userId: 'u1',
      isAdmin: true,
      platformRole: 'support',
      sessionId: 's1',
      ip: '10.0.0.1',
      userAgent: 'Mozilla',
      requestId: 'req-1',
    });
  });

  it('sees the user the auth guard sets after the context opened', () => {
    const req: Record<string, unknown> = expressLike({});
    const snapshot = cls.run(() => {
      cls.set(CLS_REQ, req);
      req.user = { userId: 'late', isAdmin: false, sessionId: 's' };
      return context.current();
    });
    expect(snapshot.userId).toBe('late');
  });

  it("handles a job runner's plain request object", () => {
    const snapshot = cls.run(() => {
      cls.set(CLS_REQ, {
        orgId: 'org-2',
        headers: {},
        user: { userId: 'actor', isAdmin: false },
      });
      return context.current();
    });
    expect(snapshot).toMatchObject({
      orgId: 'org-2',
      userId: 'actor',
      ip: null,
      requestId: null,
    });
  });
});
