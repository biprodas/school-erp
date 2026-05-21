import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export enum DemoteOldOwnerTo {
  ADMIN = 'admin',
  MEMBER = 'member',
  REMOVE = 'remove',
}

export class TransferOwnershipDto {
  @IsUUID('4')
  @IsNotEmpty()
  newOwnerUserId: string;

  /** What to do with the existing OWNER. Ignored if the tenant has no owner. Default: 'admin'. */
  @IsOptional()
  @IsEnum(DemoteOldOwnerTo)
  demoteOldOwnerTo?: DemoteOldOwnerTo;
}
