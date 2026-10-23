import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { SubjectGroupModule } from '~/modules/subject-groups/subject-group.module';
import { ClassSubjectController } from './controllers/class-subject.controller';
import { ClassSubjectComponentController } from './controllers/class-subject-component.controller';
import { ClassSubjectGroupController } from './controllers/class-subject-group.controller';
import { ClassSubjectRepository } from './repositories/class-subject.repository';
import { ClassSubjectComponentRepository } from './repositories/class-subject-component.repository';
import { ClassSubjectGroupRepository } from './repositories/class-subject-group.repository';
import { ClassSubjectService } from './services/class-subject.service';
import { ClassSubjectComponentService } from './services/class-subject-component.service';
import { ClassSubjectGroupService } from './services/class-subject-group.service';

@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    ClassModule,
    SubjectModule,
    SubjectGroupModule,
  ],
  controllers: [
    ClassSubjectController,
    ClassSubjectComponentController,
    ClassSubjectGroupController,
  ],
  providers: [
    ClassSubjectRepository,
    ClassSubjectComponentRepository,
    ClassSubjectGroupRepository,
    ClassSubjectService,
    ClassSubjectComponentService,
    ClassSubjectGroupService,
  ],
  exports: [ClassSubjectService, ClassSubjectGroupService],
})
export class ClassCurriculumModule {}
