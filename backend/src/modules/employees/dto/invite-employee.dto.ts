import { IsArray, IsOptional, IsUUID } from 'class-validator';

/**
 * `POST /employees/:id/invite`. The invite goes to the employee's email
 * (activation link) or, without one, their phone (a printed slip).
 */
export class InviteEmployeeDto {
  /** Defaults to the designation's default role. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
