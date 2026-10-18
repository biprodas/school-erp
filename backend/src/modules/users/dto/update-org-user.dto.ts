import { PartialType, PickType } from '@nestjs/swagger';
import { CreateOrgUserDto } from './create-org-user.dto';

/** Email and password belong to the global account; roles have their own endpoints. */
export class UpdateOrgUserDto extends PartialType(
  PickType(CreateOrgUserDto, ['name', 'status'] as const),
) {}
