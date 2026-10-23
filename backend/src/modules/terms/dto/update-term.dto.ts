import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTermDto } from './create-term.dto';

/** A term stays in its session. */
export class UpdateTermDto extends PartialType(
  OmitType(CreateTermDto, ['academicYearId'] as const),
) {}
