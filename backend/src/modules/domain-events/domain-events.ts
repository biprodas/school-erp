/** Domain event types (`<area>.<event>`); stored as text. */
export const DOMAIN_EVENTS = {
  /**
   * A section's register was submitted or changed. Payload:
   * `AttendanceSubmittedEvent` (attendance module). Phase 1b sends the
   * absentee alerts from it, once per student and day.
   */
  ATTENDANCE_SUBMITTED: 'attendance.submitted',
  /**
   * A class's results were published. Payload: `resultDefinitionId`,
   * `academicYearId`, `classId`, `enrollmentIds`. M7 notifies guardians.
   */
  RESULTS_PUBLISHED: 'results.published',
  /** A fee payment was recorded (M7 confirms it to the guardian). */
  PAYMENT_RECEIVED: 'payment.received',
  /** An invoice reached a `fees.reminderDays` offset unpaid (M7 sends it). */
  FEES_DUE_REMINDER: 'fees.due_reminder',
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
