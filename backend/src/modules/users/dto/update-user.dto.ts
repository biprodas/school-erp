import { PartialType, PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/** Email and password are changed through the auth flows. */
export class UpdateUserDto extends PartialType(
  PickType(CreateUserDto, ['name', 'status', 'isAdmin'] as const),
) {}
