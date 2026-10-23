/**
 * Student lifecycle (PRD 6.6). `applicant` arrives with admissions (6.5);
 * until then students start `active`. Changes go through
 * `POST /students/:id/status`, which checks {@link STATUS_TRANSITIONS}.
 */
export enum StudentStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRANSFERRED = 'transferred',
  LEFT = 'left',
  GRADUATED = 'graduated',
  DROPPED_OUT = 'dropped_out',
}

/** Where each status may go next. Leaving statuses allow re-admission. */
export const STATUS_TRANSITIONS: Readonly<
  Record<StudentStatus, readonly StudentStatus[]>
> = {
  [StudentStatus.ACTIVE]: [
    StudentStatus.SUSPENDED,
    StudentStatus.TRANSFERRED,
    StudentStatus.LEFT,
    StudentStatus.GRADUATED,
    StudentStatus.DROPPED_OUT,
  ],
  [StudentStatus.SUSPENDED]: [
    StudentStatus.ACTIVE,
    StudentStatus.TRANSFERRED,
    StudentStatus.LEFT,
    StudentStatus.DROPPED_OUT,
  ],
  [StudentStatus.TRANSFERRED]: [StudentStatus.ACTIVE],
  [StudentStatus.LEFT]: [StudentStatus.ACTIVE],
  [StudentStatus.DROPPED_OUT]: [StudentStatus.ACTIVE],
  [StudentStatus.GRADUATED]: [],
};

/** Statuses after which the student no longer attends. */
export const LEAVING_STATUSES: readonly StudentStatus[] = [
  StudentStatus.TRANSFERRED,
  StudentStatus.LEFT,
  StudentStatus.GRADUATED,
  StudentStatus.DROPPED_OUT,
];
