import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { ClassModule } from '~/modules/classes/class.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StudentModule } from '~/modules/students/student.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { EnrollmentController } from './controllers/enrollment.controller';
import { StudentStatusController } from './controllers/student-status.controller';
import { StudentSubjectController } from './controllers/student-subject.controller';
import { EnrollmentChangeRepository } from './repositories/enrollment-change.repository';
import { EnrollmentRepository } from './repositories/enrollment.repository';
import { StudentSubjectRepository } from './repositories/student-subject.repository';
import { EnrollmentService } from './services/enrollment.service';

@Module({
  imports: [
    RbacModule,
    StudentModule,
    AcademicYearModule,
    AccessScopeModule,
    ClassModule,
    SectionModule,
    SettingsModule,
    SubjectModule,
    ClassCurriculumModule,
  ],
  controllers: [
    EnrollmentController,
    StudentSubjectController,
    StudentStatusController,
  ],
  providers: [
    EnrollmentRepository,
    StudentSubjectRepository,
    EnrollmentChangeRepository,
    EnrollmentService,
  ],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
