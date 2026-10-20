import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { ClassTeacherController } from './controllers/class-teacher.controller';
import { SubjectTeacherController } from './controllers/subject-teacher.controller';
import { ClassTeacherRepository } from './repositories/class-teacher.repository';
import { SubjectTeacherRepository } from './repositories/subject-teacher.repository';
import { ClassTeacherService } from './services/class-teacher.service';
import { SubjectTeacherService } from './services/subject-teacher.service';
import { TeachingService } from './services/teaching.service';

@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    SubjectModule,
    EmployeeModule,
  ],
  controllers: [ClassTeacherController, SubjectTeacherController],
  providers: [
    ClassTeacherRepository,
    SubjectTeacherRepository,
    ClassTeacherService,
    SubjectTeacherService,
    TeachingService,
  ],
  exports: [ClassTeacherService, SubjectTeacherService, TeachingService],
})
export class TeachingModule {}
