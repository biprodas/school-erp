import { PickType } from '@nestjs/swagger';
import { CreateRoleDto } from './create-role.dto';

/** Name (and optional description) of the copy; permissions and scope come from the source role. */
export class CloneRoleDto extends PickType(CreateRoleDto, [
  'name',
  'description',
] as const) {}
