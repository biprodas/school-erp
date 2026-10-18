import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateGuardianDto } from './create-guardian.dto';

/** Logins are only created together with the guardian. */
export class UpdateGuardianDto extends PartialType(
  OmitType(CreateGuardianDto, ['createUser'] as const),
) {}
