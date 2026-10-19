import { SessionService } from '~/modules/auth/services/session.service';

/**
 * For controller-level e2e specs that mock the database: every session is
 * active. Specs that exercise sessions for real boot AppModule and create
 * them with `SessionService.start()`.
 */
export const ACTIVE_SESSIONS = {
  provide: SessionService,
  useValue: { isActive: () => Promise.resolve(true) },
};

/** `sid` claim for tokens signed directly by a spec. */
export const TEST_SESSION_ID = '00000000-0000-4000-8000-000000000001';
