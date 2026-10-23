import { forwardRef, Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { ClassTeacherController } from './controllers/class-teacher.controller';
import { SubjectTeacherController } from './controllers/subject-teacher.controller';
import { ClassTeacherRepository } from './repositories/class-teacher.repository';
import { SubjectTeacherRepository } from './repositories/subject-teacher.repository';
import { ClassTeacherService } from './services/class-teacher.service';
import { SubjectTeacherService } from './services/subject-teacher.service';
import { TeachingService } from './services/teaching.service';

/**
 * `forwardRef`s: `AccessScopeModule` reads `TeachingService`, and the
 * controllers here and in `SectionModule` filter by `AccessScope`. Only the
 * modules form a cycle; the providers don't.
 */
@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    forwardRef(() => SectionModule),
    ClassCurriculumModule,
    EmployeeModule,
    SettingsModule,
    forwardRef(() => AccessScopeModule),
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
