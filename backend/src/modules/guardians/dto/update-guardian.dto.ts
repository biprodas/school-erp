import { PartialType } from '@nestjs/swagger';
import { CreateGuardianDto } from './create-guardian.dto';

/** The portal login is made with the guardian and isn't edited here. */
export class UpdateGuardianDto extends PartialType(CreateGuardianDto) {}
