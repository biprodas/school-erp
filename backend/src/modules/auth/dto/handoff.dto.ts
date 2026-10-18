import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class IssueHandoffDto {
  @ApiProperty({ description: 'Organization to sign in to' })
  @IsDefined()
  @IsUUID()
  orgId: string;
}

export class ExchangeHandoffDto {
  @ApiProperty({ description: 'Raw handoff code from the redirect URL' })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  code: string;
}
