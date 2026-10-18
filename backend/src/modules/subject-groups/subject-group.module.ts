import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { SubjectGroupController } from './controllers/subject-group.controller';
import { SubjectGroupSubjectController } from './controllers/subject-group-subject.controller';
import { SubjectGroupRepository } from './repositories/subject-group.repository';
import { SubjectGroupSubjectRepository } from './repositories/subject-group-subject.repository';
import { SubjectGroupService } from './services/subject-group.service';

@Module({
  imports: [RbacModule, SubjectModule],
  controllers: [SubjectGroupController, SubjectGroupSubjectController],
  providers: [
    SubjectGroupRepository,
    SubjectGroupSubjectRepository,
    SubjectGroupService,
  ],
  exports: [SubjectGroupService],
})
export class SubjectGroupModule {}
