import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Employee } from '~/modules/employees/entities/employee.entity';
import { EmployeeStatus } from '~/modules/employees/enums/employee-status.enum';
import type { DatedAssignment } from './assignment-dates';

/** Staff who can take on teaching (on leave counts: it's temporary). */
export const ASSIGNABLE_STATUSES: readonly string[] = [
  EmployeeStatus.ACTIVE,
  EmployeeStatus.ON_LEAVE,
];

export function assertAssignable(employee: Employee): void {
  if (!ASSIGNABLE_STATUSES.includes(employee.status)) {
    throw new BadRequestException({
      message: 'Only active staff can be assigned',
      code: 'EMPLOYEE_NOT_ACTIVE',
    });
  }
}

/** Ended rows record who taught when; they are never deleted. */
export function assertNotHistory(row: DatedAssignment): void {
  if (row.effectiveTo !== null) {
    throw new ConflictException({
      message: 'Ended assignments are history and cannot be deleted',
      code: 'ASSIGNMENT_HISTORY',
    });
  }
}
