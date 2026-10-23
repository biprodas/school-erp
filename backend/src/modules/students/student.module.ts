import { Module } from '@nestjs/common';
import { PlanModule } from '~/modules/plans/plan.module';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { AuthModule } from '~/modules/auth/auth.module';
import { ClassModule } from '~/modules/classes/class.module';
import { FileModule } from '~/modules/files/file.module';
import { JobModule } from '~/modules/jobs/job.module';
import { NumberingModule } from '~/modules/numbering/numbering.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StudentAddressController } from './controllers/student-address.controller';
import { StudentController } from './controllers/student.controller';
import { StudentDocumentController } from './controllers/student-document.controller';
import { StudentEmergencyContactController } from './controllers/student-emergency-contact.controller';
import { StudentMedicalRecordController } from './controllers/student-medical-record.controller';
import { StudentNoteController } from './controllers/student-note.controller';
import { StudentAddressService } from './services/student-address.service';
import { StudentService } from './services/student.service';
import { StudentDocumentService } from './services/student-document.service';
import { StudentEmergencyContactService } from './services/student-emergency-contact.service';
import { StudentExportService } from './services/student-export.service';
import { StudentMedicalRecordService } from './services/student-medical-record.service';
import { StudentNoteService } from './services/student-note.service';
import { StudentScope } from './services/student-scope.service';
import { StudentAddressRepository } from './repositories/student-address.repository';
import { StudentDocumentRepository } from './repositories/student-document.repository';
import { StudentEmergencyContactRepository } from './repositories/student-emergency-contact.repository';
import { StudentMedicalRecordRepository } from './repositories/student-medical-record.repository';
import { StudentNoteRepository } from './repositories/student-note.repository';
import { StudentStatusHistoryRepository } from './repositories/student-status-history.repository';
import { StudentRepository } from './repositories/student.repository';
import { StudentExportJob } from './student-export.job';
import { StudentSearchBootstrap } from './student-search.bootstrap';

@Module({
  imports: [
    RbacModule,
    PlanModule,
    AuthModule,
    AcademicYearModule,
    AccessScopeModule,
    ClassModule,
    FileModule,
    JobModule,
    NumberingModule,
    SettingsModule,
  ],
  controllers: [
    StudentController,
    StudentAddressController,
    StudentDocumentController,
    StudentMedicalRecordController,
    StudentEmergencyContactController,
    StudentNoteController,
  ],
  providers: [
    StudentRepository,
    StudentStatusHistoryRepository,
    StudentService,
    StudentScope,
    StudentExportService,
    StudentExportJob,
    StudentSearchBootstrap,
    StudentAddressRepository,
    StudentAddressService,
    StudentDocumentRepository,
    StudentDocumentService,
    StudentMedicalRecordRepository,
    StudentMedicalRecordService,
    StudentEmergencyContactRepository,
    StudentEmergencyContactService,
    StudentNoteRepository,
    StudentNoteService,
  ],
  exports: [
    StudentService,
    StudentScope,
    StudentMedicalRecordService,
    StudentDocumentService,
    StudentNoteService,
  ],
})
export class StudentModule {}
