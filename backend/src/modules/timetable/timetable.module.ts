import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { PeriodController } from './controllers/period.controller';
import { ClassTimetableController } from './controllers/class-timetable.controller';
import { PeriodRepository } from './repositories/period.repository';
import { ClassTimetableRepository } from './repositories/class-timetable.repository';
import { PeriodService } from './services/period.service';
import { ClassTimetableService } from './services/class-timetable.service';

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
