import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDefined, IsFQDN, IsString, MaxLength } from 'class-validator';

export class AddDomainDto {
  @ApiProperty({
    description: 'App host to map, e.g. erp.myschool.edu.bd',
    example: 'erp.myschool.edu.bd',
  })
  @IsDefined()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase().replace(/\.$/, '')
      : value,
  )
  @MaxLength(253)
  @IsFQDN({ require_tld: true, allow_underscores: false })
  hostname: string;
}
