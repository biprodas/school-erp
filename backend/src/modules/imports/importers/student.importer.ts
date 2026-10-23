import { Injectable } from '@nestjs/common';
import { normalizePhone } from '~/common/identity/identifier';
import type { ProvisionResult } from '~/modules/auth/services/invite.service';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import type { Class } from '~/modules/classes/entities/class.entity';
import { ClassSubjectGroupService } from '~/modules/class-curriculum/services/class-subject-group.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { GuardianRelation } from '~/modules/guardians/enums/guardian-relation.enum';
import { GuardianService } from '~/modules/guardians/services/guardian.service';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import type { Section } from '~/modules/sections/entities/section.entity';
import { SectionService } from '~/modules/sections/section.service';
import { SubjectGroupService } from '~/modules/subject-groups/services/subject-group.service';
import { BloodGroup } from '~/modules/students/enums/blood-group.enum';
import { StudentGender } from '~/modules/students/enums/student-gender.enum';
import { StudentService } from '~/modules/students/services/student.service';
import type {
  ParsedRow,
  RowError,
  SheetColumn,
} from '~/shared/spreadsheet/spreadsheet';
import { ImportType } from '../enums/import.enum';
import { addError, key, type ImportContext, type Importer } from './importer';

export interface StudentImportRow {
  admissionNumber?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nameBn?: string;
  gender?: StudentGender;
  dob?: string;
  religion?: string;
  bloodGroup?: BloodGroup;
  birthRegNo?: string;
  phone?: string;
  email?: string;
  previousSchool?: string;
  admissionDate?: string;
  className: string;
  sectionName: string;
  rollNo?: string | number;
  groupName?: string;
  fatherName?: string;
  fatherPhone?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherPhone?: string;
  motherOccupation?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: GuardianRelation;
  primaryContact?: 'father' | 'mother' | 'guardian';
}

type GuardianSlot = 'father' | 'mother' | 'guardian';

const SLOTS: {
  slot: GuardianSlot;
  name: keyof StudentImportRow;
  phone: keyof StudentImportRow;
  occupation?: keyof StudentImportRow;
  relation: GuardianRelation;
}[] = [
  {
    slot: 'father',
    name: 'fatherName',
    phone: 'fatherPhone',
    occupation: 'fatherOccupation',
    relation: GuardianRelation.FATHER,
  },
  {
    slot: 'mother',
    name: 'motherName',
    phone: 'motherPhone',
    occupation: 'motherOccupation',
    relation: GuardianRelation.MOTHER,
  },
  {
    slot: 'guardian',
    name: 'guardianName',
    phone: 'guardianPhone',
    relation: GuardianRelation.LOCAL_GUARDIAN,
  },
];

/** A cell value as trimmed text; empty → undefined. */
const text = (v: string | number | undefined | null) =>
  v === undefined || v === null ? undefined : String(v).trim() || undefined;

/**
 * Students with their guardians, placement and portal accounts (PRD 6.2
 * step 8). Guardians are matched by phone, in the file (siblings share
 * them) and against the school's guardians.
 */
@Injectable()
export class StudentImporter implements Importer<StudentImportRow> {
  readonly type = ImportType.STUDENTS;
  readonly permission = PERMISSIONS.STUDENTS_IMPORT;

  private lookups?: Promise<{
    classes: Map<string, Class>;
    sections: Map<string, Section>;
    groups: Map<string, string>;
  }>;

  constructor(
    private readonly students: StudentService,
    private readonly guardians: GuardianService,
    private readonly enrollments: EnrollmentService,
    private readonly academicYears: AcademicYearService,
    private readonly classes: ClassService,
    private readonly sections: SectionService,
    private readonly subjectGroups: SubjectGroupService,
    private readonly classSubjectGroups: ClassSubjectGroupService,
  ) {}

  async columns(): Promise<SheetColumn<StudentImportRow>[]> {
    const classNames = (await this.classes.findAllOrdered()).map((c) => c.name);
    return [
      { key: 'admissionNumber', header: 'Student ID', example: '' },
      {
        key: 'firstName',
        header: 'First name',
        required: true,
        example: 'Rahim',
      },
      { key: 'middleName', header: 'Middle name' },
      {
        key: 'lastName',
        header: 'Last name',
        required: true,
        example: 'Uddin',
      },
      {
        key: 'nameBn',
        header: 'Name (Bangla)',
        example: 'রহিম উদ্দিন',
        width: 22,
      },
      {
        key: 'gender',
        header: 'Gender',
        options: Object.values(StudentGender),
        example: StudentGender.MALE,
      },
      {
        key: 'dob',
        header: 'Date of birth',
        type: 'date',
        example: '2014-03-21',
      },
      { key: 'religion', header: 'Religion', example: 'Islam' },
      {
        key: 'bloodGroup',
        header: 'Blood group',
        options: Object.values(BloodGroup),
      },
      { key: 'birthRegNo', header: 'Birth registration no', width: 22 },
      { key: 'phone', header: 'Student phone' },
      { key: 'email', header: 'Student email' },
      { key: 'previousSchool', header: 'Previous school', width: 22 },
      { key: 'admissionDate', header: 'Admission date', type: 'date' },
      {
        key: 'className',
        header: 'Class',
        required: true,
        options: classNames.join(',').length < 250 ? classNames : undefined,
        example: classNames[0],
      },
      { key: 'sectionName', header: 'Section', required: true, example: 'A' },
      { key: 'rollNo', header: 'Roll', example: 1 },
      { key: 'groupName', header: 'Group' },
      { key: 'fatherName', header: 'Father name', example: 'Karim Uddin' },
      { key: 'fatherPhone', header: 'Father phone', example: '01712345678' },
      { key: 'fatherOccupation', header: 'Father occupation' },
      { key: 'motherName', header: 'Mother name' },
      { key: 'motherPhone', header: 'Mother phone' },
      { key: 'motherOccupation', header: 'Mother occupation' },
      { key: 'guardianName', header: 'Local guardian name' },
      { key: 'guardianPhone', header: 'Local guardian phone' },
      {
        key: 'guardianRelation',
        header: 'Local guardian relation',
        options: [
          GuardianRelation.LOCAL_GUARDIAN,
          GuardianRelation.BROTHER,
          GuardianRelation.SISTER,
          GuardianRelation.OTHER,
        ],
      },
      {
        key: 'primaryContact',
        header: 'Primary contact',
        options: ['father', 'mother', 'guardian'],
      },
    ];
  }

  async validate(
    rows: ParsedRow<StudentImportRow>[],
    ctx: ImportContext,
  ): Promise<Map<number, RowError[]>> {
    const errors = new Map<number, RowError[]>();
    const { classes, sections, groups } = await this.load(ctx);
    const manual = await this.students.allowsManualId();
    const ids = new Map<string, number>();
    const rolls = new Map<string, number>();
    const perSection = new Map<string, number>();

    for (const { row, values: v } of rows) {
      const err = (column: string, code: string, message: string) =>
        addError(errors, row, column, code, message);

      const admissionNumber = text(v.admissionNumber);
      if (admissionNumber) {
        if (!manual) {
          err(
            'Student ID',
            'MANUAL_ID_NOT_ALLOWED',
            'Student IDs are generated here; leave it empty',
          );
        } else if (ids.has(admissionNumber)) {
          err(
            'Student ID',
            'DUPLICATE_IN_FILE',
            `Same ID as row ${ids.get(admissionNumber)}`,
          );
        } else if (await this.students.findByAdmissionNumber(admissionNumber)) {
          err(
            'Student ID',
            'DUPLICATE_IN_DB',
            'This student ID is already in use',
          );
        }
        ids.set(admissionNumber, row);
      }
      if (v.phone && !normalizePhone(String(v.phone))) {
        err('Student phone', 'INVALID_PHONE', 'Not a valid phone number');
      }
      if (v.birthRegNo && !/^\d{17}$/.test(String(v.birthRegNo))) {
        err('Birth registration no', 'INVALID_FORMAT', 'Must be 17 digits');
      }

      const cls = v.className ? classes.get(key(v.className)) : undefined;
      if (v.className && !cls) {
        err('Class', 'UNKNOWN_CLASS', `No class "${v.className}"`);
      }
      const section =
        cls && v.sectionName
          ? sections.get(`${cls.id}:${key(v.sectionName)}`)
          : undefined;
      if (cls && v.sectionName && !section) {
        err(
          'Section',
          'UNKNOWN_SECTION',
          `${cls.name} has no section "${v.sectionName}" in the session`,
        );
      }
      if (v.groupName) {
        const groupId = groups.get(key(v.groupName));
        if (
          !groupId ||
          !cls ||
          !(await this.classSubjectGroups.isOffered(
            cls.id,
            groupId,
            ctx.academicYearId!,
          ))
        ) {
          err(
            'Group',
            'UNKNOWN_GROUP',
            `The class doesn't offer "${v.groupName}"`,
          );
        }
      }
      if (section) {
        const roll = text(v.rollNo);
        if (roll) {
          const rollKey = `${section.id}:${roll}`;
          if (rolls.has(rollKey)) {
            err(
              'Roll',
              'DUPLICATE_IN_FILE',
              `Same roll as row ${rolls.get(rollKey)}`,
            );
          } else if (await this.enrollments.isRollTaken(section.id, roll)) {
            err('Roll', 'ROLL_TAKEN', `Roll ${roll} is taken in this section`);
          }
          rolls.set(rollKey, row);
        }
        if (section.capacity !== null) {
          const count =
            (perSection.get(section.id) ??
              (await this.enrollments.countActiveInSection(section.id))) + 1;
          perSection.set(section.id, count);
          if (count > section.capacity) {
            err(
              'Section',
              'SECTION_FULL',
              `Section ${section.name} is full (${section.capacity})`,
            );
          }
        }
      }

      const phones = new Map<string, GuardianSlot>();
      let anyGuardian = false;
      for (const s of SLOTS) {
        const name = text(v[s.name]);
        const rawPhone = text(v[s.phone]);
        if (!name && !rawPhone) continue;
        anyGuardian = true;
        const header =
          SLOTS.indexOf(s) === 2
            ? 'Local guardian'
            : s.slot === 'father'
              ? 'Father'
              : 'Mother';
        if (!name)
          err(
            `${header} name`,
            'REQUIRED',
            `${header} name is required with a phone`,
          );
        if (!rawPhone) {
          err(
            `${header} phone`,
            'REQUIRED',
            `${header} phone is required (it becomes their portal login)`,
          );
          continue;
        }
        const phone = normalizePhone(rawPhone);
        if (!phone) {
          err(`${header} phone`, 'INVALID_PHONE', 'Not a valid phone number');
        } else if (phones.has(phone)) {
          err(
            `${header} phone`,
            'DUPLICATE_IN_ROW',
            `Same phone as the ${phones.get(phone)}`,
          );
        } else {
          phones.set(phone, s.slot);
        }
      }
      if (!anyGuardian) {
        err(
          'Father name',
          'GUARDIAN_REQUIRED',
          'Give at least one guardian with a phone',
        );
      }
      if (v.primaryContact) {
        const slot = SLOTS.find((s) => s.slot === v.primaryContact)!;
        if (!text(v[slot.name])) {
          err(
            'Primary contact',
            'INVALID_OPTION',
            `There is no ${v.primaryContact} on this row`,
          );
        }
      }
    }
    return errors;
  }

  async commitRow(
    v: StudentImportRow,
    ctx: ImportContext,
    mails: ProvisionResult[],
  ): Promise<Record<string, unknown>> {
    const { classes, sections, groups } = await this.load(ctx);
    const cls = classes.get(key(v.className))!;
    const section = sections.get(`${cls.id}:${key(v.sectionName)}`)!;
    const year = await this.academicYears.findById(ctx.academicYearId!);

    const student = await this.students.create(
      {
        admissionNumber: text(v.admissionNumber),
        firstName: v.firstName,
        middleName: text(v.middleName),
        lastName: v.lastName,
        nameBn: text(v.nameBn),
        gender: v.gender,
        dob: v.dob,
        religion: text(v.religion),
        bloodGroup: v.bloodGroup,
        birthRegNo: text(v.birthRegNo),
        phone: text(v.phone),
        email: text(v.email),
        previousSchool: text(v.previousSchool),
        admissionDate: v.admissionDate,
      },
      {
        classId: cls.id,
        date: v.admissionDate ?? year.startDate ?? undefined,
      },
    );

    const present = SLOTS.filter((s) => text(v[s.name]));
    const primary = v.primaryContact ?? present[0]?.slot;
    const guardianIds: string[] = [];
    for (const s of present) {
      const made = await this.guardians.findOrProvision({
        name: text(v[s.name])!,
        phone: text(v[s.phone]),
        occupation: s.occupation ? text(v[s.occupation]) : undefined,
      });
      if (made.account) mails.push(made.account);
      await this.guardians.link(student.id, made.guardian.id, {
        relation:
          s.slot === 'guardian'
            ? (v.guardianRelation ?? GuardianRelation.LOCAL_GUARDIAN)
            : s.relation,
        isPrimary: s.slot === primary,
      });
      guardianIds.push(made.guardian.id);
    }

    const enrolled = await this.enrollments.enroll({
      studentId: student.id,
      academicYearId: ctx.academicYearId!,
      classId: cls.id,
      sectionId: section.id,
      rollNo: text(v.rollNo),
      subjectGroupId: v.groupName ? groups.get(key(v.groupName)) : undefined,
    });
    if (enrolled.account) mails.push(enrolled.account);
    return {
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      enrollmentId: enrolled.enrollment.id,
      guardianIds,
    };
  }

  /** Classes, the session's sections and groups, read once per import. */
  private load(ctx: ImportContext) {
    this.lookups ??= (async () => {
      const classes = new Map(
        (await this.classes.findAllOrdered()).map((c) => [key(c.name), c]),
      );
      const sections = new Map(
        (await this.sections.findInYear(ctx.academicYearId!)).map((s) => [
          `${s.classId}:${key(s.name)}`,
          s,
        ]),
      );
      const groups = new Map(
        (
          await this.subjectGroups.findFiltered({ page: 1, limit: 100 })
        ).items.map((g) => [key(g.name), g.id]),
      );
      return { classes, sections, groups };
    })();
    return this.lookups;
  }
}
