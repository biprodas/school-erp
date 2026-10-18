import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStakeholderDto } from './create-stakeholder.dto';

/** Logins are only created together with the stakeholder. */
export class UpdateStakeholderDto extends PartialType(
  OmitType(CreateStakeholderDto, ['createUser'] as const),
) {}
