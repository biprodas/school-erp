import { PartialType } from '@nestjs/swagger';
import { CreateSubjectGroupDto } from './create-subject-group.dto';

export class UpdateSubjectGroupDto extends PartialType(CreateSubjectGroupDto) {}
