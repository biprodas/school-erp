import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { UserModule } from '../users/user.module';
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
import { StudentMedicalRecordService } from './services/student-medical-record.service';
import { StudentNoteService } from './services/student-note.service';
import { StudentAddressRepository } from './repositories/student-address.repository';
import { StudentDocumentRepository } from './repositories/student-document.repository';
import { StudentEmergencyContactRepository } from './repositories/student-emergency-contact.repository';
import { StudentMedicalRecordRepository } from './repositories/student-medical-record.repository';
import { StudentNoteRepository } from './repositories/student-note.repository';
import { StudentRepository } from './repositories/student.repository';

@Module({
  imports: [RbacModule, UserModule],
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
    StudentService,
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
  exports: [StudentService],
})
export class StudentModule {}
