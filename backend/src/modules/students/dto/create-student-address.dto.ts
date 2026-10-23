import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AddressType } from '../enums/address-type.enum';

export class CreateStudentAddressDto {
  @IsEnum(AddressType)
  addressType: AddressType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  /** Geo ids from `GET /public/geo/...`; a lower unit implies its parents. */
  @IsOptional()
  @IsInt()
  divisionId?: number | null;

  @IsOptional()
  @IsInt()
  districtId?: number | null;

  @IsOptional()
  @IsInt()
  upazilaId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;
}
