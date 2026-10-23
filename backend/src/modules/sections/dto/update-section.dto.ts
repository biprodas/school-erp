import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateSectionDto } from './create-section.dto';

/**
 * A section stays in its class and session; `null` clears the shift, room
 * or capacity.
 */
export class UpdateSectionDto extends PartialType(
  OmitType(CreateSectionDto, ['academicYearId', 'classId'] as const),
) {}
