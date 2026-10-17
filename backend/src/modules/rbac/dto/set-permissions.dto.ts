import { IsArray, IsString } from 'class-validator';

export class SetPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
