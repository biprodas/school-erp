import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { SubjectModule } from '../subjects/subject.module';
import { SubjectGroupController } from './subject-group.controller';
import { SubjectGroupSubjectController } from './subject-group-subject.controller';
import { SubjectGroupRepository } from './subject-group.repository';
import { SubjectGroupSubjectRepository } from './subject-group-subject.repository';
import { SubjectGroupService } from './subject-group.service';

@Module({
  imports: [RbacModule, SubjectModule],
  controllers: [SubjectGroupController, SubjectGroupSubjectController],
  providers: [
    SubjectGroupRepository,
    SubjectGroupSubjectRepository,
    SubjectGroupService,
  ],
  exports: [SubjectGroupService, SubjectGroupRepository],
})
export class SubjectGroupModule {}
