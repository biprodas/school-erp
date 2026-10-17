import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AcademicYearModule } from '../academic-years/academic-year.module';
import { ClassModule } from '../classes/class.module';
import { SubjectModule } from '../subjects/subject.module';
import { SubjectGroupModule } from '../subject-groups/subject-group.module';
import { ClassSubjectController } from './class-subject.controller';
import { ClassSubjectGroupController } from './class-subject-group.controller';
import { ClassSubjectRepository } from './class-subject.repository';
import { ClassSubjectGroupRepository } from './class-subject-group.repository';
import { ClassSubjectService } from './class-subject.service';
import { ClassSubjectGroupService } from './class-subject-group.service';

@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    ClassModule,
    SubjectModule,
    SubjectGroupModule,
  ],
  controllers: [ClassSubjectController, ClassSubjectGroupController],
  providers: [
    ClassSubjectRepository,
    ClassSubjectGroupRepository,
    ClassSubjectService,
    ClassSubjectGroupService,
  ],
  exports: [ClassSubjectService, ClassSubjectRepository],
})
export class ClassCurriculumModule {}
