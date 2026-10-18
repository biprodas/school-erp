import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { SectionModule } from '~/modules/sections/section.module';
import { StudentModule } from '~/modules/students/student.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { EnrollmentController } from './controllers/enrollment.controller';
import { StudentSubjectController } from './controllers/student-subject.controller';
import { EnrollmentRepository } from './repositories/enrollment.repository';
import { StudentSubjectRepository } from './repositories/student-subject.repository';
import { EnrollmentService } from './services/enrollment.service';

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
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
