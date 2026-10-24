import * as Sentry from '@sentry/node';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
  withScope: jest.fn((fn: (scope: { setTag: jest.Mock }) => void) => fn(scope)),
}));
const scope = { setTag: jest.fn() };

describe('error tracking', () => {
  const saved = process.env.SENTRY_DSN;
  let tracking: typeof import('./error-tracking');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      tracking =
        jest.requireActual<typeof import('./error-tracking')>(
          './error-tracking',
        );
    });
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = saved;
  });

  it('is off without a DSN: nothing is initialized or sent', async () => {
    delete process.env.SENTRY_DSN;
    expect(tracking.initErrorTracking()).toBe(false);
    tracking.reportError(new Error('boom'));
    await tracking.flushErrorTracking();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('sends errors with ids as tags, never personal data', () => {
    process.env.SENTRY_DSN = 'https://key@o0.ingest.sentry.io/1';
    expect(tracking.initErrorTracking()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ sendDefaultPii: false }),
    );
    const err = new Error('boom');
    tracking.reportError(err, { orgId: 'org-1', where: 'GET /api/x' });
    expect(scope.setTag).toHaveBeenCalledWith('org_id', 'org-1');
    expect(scope.setTag).toHaveBeenCalledWith('where', 'GET /api/x');
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });
});
