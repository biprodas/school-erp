import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class AttachSectionDto {
  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;
}
