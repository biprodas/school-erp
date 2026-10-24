/** Domain event types (`<area>.<event>`); stored as text. */
export const DOMAIN_EVENTS = {
  /**
   * A section's register was submitted or changed. Payload:
   * `AttendanceSubmittedEvent` (attendance module). Phase 1b sends the
   * absentee alerts from it, once per student and day.
   */
  ATTENDANCE_SUBMITTED: 'attendance.submitted',
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
