import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AcademicYearModule } from '../academic-years/academic-year.module';
import { ClassModule } from '../classes/class.module';
import { EmployeeModule } from '../employees/employee.module';
import { SectionModule } from '../sections/section.module';
import { SubjectModule } from '../subjects/subject.module';
import { PeriodController } from './period.controller';
import { ClassTimetableController } from './class-timetable.controller';
import { PeriodRepository } from './period.repository';
import { ClassTimetableRepository } from './class-timetable.repository';
import { PeriodService } from './period.service';
import { ClassTimetableService } from './class-timetable.service';

@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    SubjectModule,
    EmployeeModule,
  ],
  controllers: [PeriodController, ClassTimetableController],
  providers: [
    PeriodRepository,
    ClassTimetableRepository,
    PeriodService,
    ClassTimetableService,
  ],
  exports: [PeriodService, ClassTimetableService],
})
export class TimetableModule {}
