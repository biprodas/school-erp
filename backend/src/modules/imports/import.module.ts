import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { ClassModule } from '~/modules/classes/class.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { DepartmentModule } from '~/modules/departments/department.module';
import { DesignationModule } from '~/modules/designations/designation.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { FileModule } from '~/modules/files/file.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { JobModule } from '~/modules/jobs/job.module';
import { SectionModule } from '~/modules/sections/section.module';
import { StudentModule } from '~/modules/students/student.module';
import { SubjectGroupModule } from '~/modules/subject-groups/subject-group.module';
import { ImportController } from './controllers/import.controller';
import { ImportJob } from './import.job';
import { ImportRepository } from './import.repository';
import { StaffImporter } from './importers/staff.importer';
import { StudentImporter } from './importers/student.importer';
import { ImportService } from './services/import.service';

/** Excel imports for students (with guardians) and staff (PRD 6.2). */
@Module({
  imports: [
    RbacModule,
    AccessScopeModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    SubjectGroupModule,
    ClassCurriculumModule,
    StudentModule,
    GuardianModule,
    EnrollmentModule,
    EmployeeModule,
    DepartmentModule,
    DesignationModule,
    FileModule,
    JobModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportRepository,
    ImportService,
    StudentImporter,
    StaffImporter,
    ImportJob,
  ],
})
export class ImportModule {}
