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
        { current: () => ({ userId: 'u-1' }) } as never,
      );

    it('records a list that includes health notes', async () => {
      await serviceWith([NoteType.GENERAL, NoteType.HEALTH]).listForStudent(
        'stu-1',
        true,
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
        true,
      );
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('asks the repository to leave sensitive notes out without the key', async () => {
      const repo = { findByStudent: jest.fn().mockResolvedValue([]) };
      const service = new StudentNoteService(
        repo as unknown as StudentNoteRepository,
        students,
        audit as unknown as AuditService,
        { current: () => ({ userId: 'u-1' }) } as never,
      );

      await service.listForStudent('stu-1', false);

      expect(repo.findByStudent).toHaveBeenCalledWith('stu-1', false);
    });

    it('refuses to write a sensitive note without the key', async () => {
      const service = serviceWith([]);
      for (const noteType of [
        NoteType.HEALTH,
        NoteType.DISCIPLINARY,
        NoteType.COUNSELLING,
      ]) {
        await expect(
          service.create('stu-1', { noteType, note: 'x' }, false),
        ).rejects.toMatchObject({
          response: { code: 'SENSITIVE_NOTE_FORBIDDEN' },
        });
      }
    });
  });
});
