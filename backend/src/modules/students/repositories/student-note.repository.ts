import { Inject, Injectable } from '@nestjs/common';
import { In, Not } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentNote } from '../entities/student-note.entity';
import { SENSITIVE_NOTE_TYPES } from '../enums/note-type.enum';

@Injectable()
export class StudentNoteRepository extends BaseTenantRepository<StudentNote> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentNote, 'StudentNote');
  }

  /**
   * The student's notes; health, disciplinary and counselling ones only
   * with `includeSensitive` (the query leaves them out otherwise).
   */
  findByStudent(
    studentId: string,
    includeSensitive: boolean,
  ): Promise<StudentNote[]> {
    return this.repo.find({
      where: {
        studentId,
        noteType: includeSensitive
          ? undefined
          : Not(In([...SENSITIVE_NOTE_TYPES])),
      },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  /** One note of the student, under the same rule. */
  findOneForStudent(
    studentId: string,
    noteId: string,
    includeSensitive: boolean,
  ): Promise<StudentNote | null> {
    return this.repo.findOne({
      where: {
        id: noteId,
        studentId,
        noteType: includeSensitive
          ? undefined
          : Not(In([...SENSITIVE_NOTE_TYPES])),
      },
    });
  }
}
