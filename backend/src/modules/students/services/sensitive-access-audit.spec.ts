import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { NoteType } from '../enums/note-type.enum';
import { StudentMedicalRecordRepository } from '../repositories/student-medical-record.repository';
import { StudentNoteRepository } from '../repositories/student-note.repository';
import { StudentMedicalRecordService } from './student-medical-record.service';
import { StudentNoteService } from './student-note.service';
import { StudentService } from './student.service';

/** Reading health data is audited (PRD 6.3), without copying the data. */
describe('sensitive data access auditing', () => {
  let audit: { record: jest.Mock };
  const students = {
    findById: jest.fn(() => Promise.resolve({ id: 'stu-1' })),
  } as unknown as StudentService;

  beforeEach(() => {
    audit = { record: jest.fn() };
  });

  describe('StudentMedicalRecordService.getForStudent', () => {
    const serviceWith = (record: object | null) =>
      new StudentMedicalRecordService(
        {
          findByStudent: jest.fn(() => Promise.resolve(record)),
        } as unknown as StudentMedicalRecordRepository,
        students,
        audit as unknown as AuditService,
      );

    it('records the view under the student, with no payload', async () => {
      await serviceWith({ id: 'med-1', allergies: 'peanuts' }).getForStudent(
        'stu-1',
      );

      expect(audit.record).toHaveBeenCalledWith({
        action: AUDIT_ACTIONS.STUDENT_MEDICAL_VIEWED,
        entityType: 'student',
        entityId: 'stu-1',
      });
    });

    it('records nothing when there is no record', async () => {
      await serviceWith(null).getForStudent('stu-1');
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('StudentNoteService.listForStudent', () => {
    const serviceWith = (types: NoteType[]) =>
      new StudentNoteService(
        {
          findByStudent: jest.fn(() =>
            Promise.resolve(
              types.map((noteType, i) => ({ id: `n${i}`, noteType })),
            ),
          ),
        } as unknown as StudentNoteRepository,
        students,
        audit as unknown as AuditService,
      );

    it('records a list that includes health notes', async () => {
      await serviceWith([NoteType.GENERAL, NoteType.HEALTH]).listForStudent(
        'stu-1',
      );

      expect(audit.record).toHaveBeenCalledWith({
        action: AUDIT_ACTIONS.STUDENT_NOTE_SENSITIVE_VIEWED,
        entityType: 'student',
        entityId: 'stu-1',
      });
    });

    it('records nothing for ordinary notes', async () => {
      await serviceWith([NoteType.GENERAL, NoteType.ACADEMIC]).listForStudent(
        'stu-1',
      );
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
