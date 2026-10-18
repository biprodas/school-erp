import { PartialType, PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OrganizationStatus } from '../enums/organization-status.enum';
import { CreateOrganizationDto } from './create-organization.dto';

/** The slug and owner are fixed after creation (ownership has its own endpoint). */
export class UpdateOrganizationDto extends PartialType(
  PickType(CreateOrganizationDto, ['name', 'domain'] as const),
) {
  /** Platform admins only (enforced in OrganizationService). */
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}
