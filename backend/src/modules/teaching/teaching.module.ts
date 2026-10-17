import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AcademicYearModule } from '../academic-years/academic-year.module';
import { ClassModule } from '../classes/class.module';
import { EmployeeModule } from '../employees/employee.module';
import { SectionModule } from '../sections/section.module';
import { SubjectModule } from '../subjects/subject.module';
import { ClassTeacherController } from './class-teacher.controller';
import { SubjectTeacherController } from './subject-teacher.controller';
import { ClassTeacherRepository } from './class-teacher.repository';
import { SubjectTeacherRepository } from './subject-teacher.repository';
import { ClassTeacherService } from './class-teacher.service';
import { SubjectTeacherService } from './subject-teacher.service';

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
  ],
  exports: [ClassTeacherService, SubjectTeacherService],
})
export class TeachingModule {}
