import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AcademicYearModule } from '../academic-years/academic-year.module';
import { ClassModule } from '../classes/class.module';
import { ClassCurriculumModule } from '../class-curriculum/class-curriculum.module';
import { SectionModule } from '../sections/section.module';
import { StudentModule } from '../students/student.module';
import { SubjectModule } from '../subjects/subject.module';
import { EnrollmentController } from './enrollment.controller';
import { StudentSubjectController } from './student-subject.controller';
import { EnrollmentRepository } from './enrollment.repository';
import { StudentSubjectRepository } from './student-subject.repository';
import { EnrollmentService } from './enrollment.service';

@Module({
  imports: [
    RbacModule,
    StudentModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    SubjectModule,
    ClassCurriculumModule,
  ],
  controllers: [EnrollmentController, StudentSubjectController],
  providers: [
    EnrollmentRepository,
    StudentSubjectRepository,
    EnrollmentService,
  ],
  exports: [EnrollmentService, EnrollmentRepository],
})
export class EnrollmentModule {}
