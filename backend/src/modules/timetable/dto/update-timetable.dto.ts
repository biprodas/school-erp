import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTimetableDto } from './create-timetable.dto';

/** The year, class-section, day and period identify the slot and cannot change. */
export class UpdateTimetableDto extends PartialType(
  OmitType(CreateTimetableDto, [
    'academicYearId',
    'classId',
    'sectionId',
    'dayOfWeek',
    'periodId',
  ] as const),
) {}
