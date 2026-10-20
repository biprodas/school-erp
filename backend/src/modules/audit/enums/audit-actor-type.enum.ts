/** Who performed an audited action. */
export enum AuditActorType {
  /** A signed-in member of the school (or an anonymous sign-in attempt). */
  USER = 'user',
  /** A platform user (super-admin; support with consent in 1b). */
  PLATFORM = 'platform',
  /** The app itself: scheduled jobs, background work without an actor. */
  SYSTEM = 'system',
}
