import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { AttendanceModule } from '~/modules/attendance/attendance.module';
import { ClassModule } from '~/modules/classes/class.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { DomainEventModule } from '~/modules/domain-events/domain-event.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { FileModule } from '~/modules/files/file.module';
import { GradingModule } from '~/modules/grading/grading.module';
import { JobModule } from '~/modules/jobs/job.module';
import { PlanModule } from '~/modules/plans/plan.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { TermModule } from '~/modules/terms/term.module';
import { ExamTypeController } from './controllers/exam-type.controller';
import { ExamController } from './controllers/exam.controller';
import { MarkSheetController } from './controllers/mark-sheet.controller';
import { ResultDefinitionController } from './controllers/result-definition.controller';
import { ResultController } from './controllers/result.controller';
import { ExamRepository } from './repositories/exam.repository';
import { ExamSubjectRepository } from './repositories/exam-subject.repository';
import { ExamTypeRepository } from './repositories/exam-type.repository';
import { MarkRepository } from './repositories/mark.repository';
import { MarkSheetRepository } from './repositories/mark-sheet.repository';
import { ResultDefinitionRepository } from './repositories/result-definition.repository';
import { ResultRepository } from './repositories/result.repository';
import { ResultJobs } from './results.jobs';
import { ExamTypeService } from './services/exam-type.service';
import { ExamService } from './services/exam.service';
import { MarkSheetService } from './services/mark-sheet.service';
import { ResultDefinitionService } from './services/result-definition.service';
import { ResultDocumentService } from './services/result-document.service';
import { ResultService } from './services/result.service';
import { TabulationService } from './services/tabulation.service';

/**
 * Exams and results (PRD 6.9): exam setup, mark sheets and their
 * workflow, tabulation with the grading engine, publishing, report cards
 * and result sheets.
 */
@Module({
  imports: [
    RbacModule,
    AccessScopeModule,
    AcademicYearModule,
    TermModule,
    ClassModule,
    SectionModule,
    ClassCurriculumModule,
    EnrollmentModule,
    GradingModule,
    SettingsModule,
    AttendanceModule,
    DomainEventModule,
    FileModule,
    JobModule,
    PlanModule,
  ],
  controllers: [
    ExamTypeController,
    ExamController,
    MarkSheetController,
    ResultDefinitionController,
    ResultController,
  ],
  providers: [
    ExamTypeRepository,
    ExamRepository,
    ExamSubjectRepository,
    MarkSheetRepository,
    MarkRepository,
    ResultDefinitionRepository,
    ResultRepository,
    ExamTypeService,
    ExamService,
    MarkSheetService,
    ResultDefinitionService,
    TabulationService,
    ResultService,
    ResultDocumentService,
    ResultJobs,
  ],
  exports: [MarkSheetService, ResultService, ExamService],
})
export class ExamModule {}
