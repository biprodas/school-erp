import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { ClassSubjectGroupService } from '~/modules/class-curriculum/services/class-subject-group.service';
import { FOURTH_SUBJECT_TYPES } from '~/modules/class-curriculum/enums/class-subject-type.enum';
import { SectionService } from '~/modules/sections/section.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { StudentService } from '~/modules/students/services/student.service';
import { CreateEnrollmentDto } from '../dto/create-enrollment.dto';
import { FilterEnrollmentDto } from '../dto/filter-enrollment.dto';
import { SelectSubjectDto } from '../dto/select-subject.dto';
import { UpdateEnrollmentDto } from '../dto/update-enrollment.dto';
import { StudentEnrollment } from '../entities/student-enrollment.entity';
import { StudentSubject } from '../entities/student-subject.entity';
import { StudentEnrollmentStatus } from '../enums/student-enrollment-status.enum';
import { EnrollmentRepository } from '../repositories/enrollment.repository';
import { StudentSubjectRepository } from '../repositories/student-subject.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly studentSubjectRepo: StudentSubjectRepository,
    private readonly studentService: StudentService,
    private readonly academicYearService: AcademicYearService,
    private readonly classService: ClassService,
    private readonly sectionService: SectionService,
    private readonly subjectService: SubjectService,
    private readonly classSubjectService: ClassSubjectService,
    private readonly classSubjectGroupService: ClassSubjectGroupService,
  ) {}

  // --- Enrollment CRUD -------------------------------------------------

  findFiltered(
    filter: FilterEnrollmentDto,
  ): Promise<Paginated<StudentEnrollment>> {
    const where: FindOptionsWhere<StudentEnrollment> = {};
    if (filter.id) where.id = filter.id;
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.classId) where.classId = filter.classId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.status) where.status = filter.status;
    return this.enrollmentRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<StudentEnrollment> {
    const entity = await this.enrollmentRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(
        `StudentEnrollment with id "${id}" not found`,
      );
    }
    return entity;
  }

  async create(dto: CreateEnrollmentDto): Promise<StudentEnrollment> {
    await this.studentService.findById(dto.studentId);
    await this.academicYearService.findById(dto.academicYearId);
    await this.classService.findById(dto.classId);
    await this.assertPlacement(dto.academicYearId, dto.classId, dto.sectionId);
    if (dto.subjectGroupId) {
      await this.assertGroupOffered(
        dto.classId,
        dto.subjectGroupId,
        dto.academicYearId,
      );
    }

    const existing = await this.enrollmentRepo.findForStudentYear(
      dto.studentId,
      dto.academicYearId,
    );
    if (existing) {
      throw new ConflictException(
        'Student is already enrolled for this academic year',
      );
    }

    const created = await this.enrollmentRepo.saveNew({
      studentId: dto.studentId,
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectGroupId: dto.subjectGroupId ?? null,
      rollNo: dto.rollNo ?? null,
      status: dto.status ?? StudentEnrollmentStatus.ACTIVE,
    });
    return this.findById(created.id);
  }

  async update(
    id: string,
    dto: UpdateEnrollmentDto,
  ): Promise<StudentEnrollment> {
    const enrollment = await this.findById(id);

    const classId = dto.classId ?? enrollment.classId;
    if (classId !== enrollment.classId) {
      await this.classService.findById(classId);
    }
    if (classId !== enrollment.classId || dto.sectionId) {
      await this.assertPlacement(
        enrollment.academicYearId,
        classId,
        dto.sectionId ?? enrollment.sectionId,
      );
    }
    if (dto.subjectGroupId) {
      await this.assertGroupOffered(
        classId,
        dto.subjectGroupId,
        enrollment.academicYearId,
      );
    }

    await this.enrollmentRepo.updateFields(id, dto);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.enrollmentRepo.deleteById(id);
  }

  /** The section must be one of the class's sections in the session. */
  private async assertPlacement(
    academicYearId: string,
    classId: string,
    sectionId: string,
  ): Promise<void> {
    const section = await this.sectionService.findById(sectionId);
    if (
      section.classId !== classId ||
      section.academicYearId !== academicYearId
    ) {
      throw new BadRequestException({
        message:
          "The section is not one of the class's sections in the session",
        code: 'SECTION_NOT_IN_CLASS',
      });
    }
  }

  private async assertGroupOffered(
    classId: string,
    subjectGroupId: string,
    academicYearId: string,
  ): Promise<void> {
    if (
      !(await this.classSubjectGroupService.isOffered(
        classId,
        subjectGroupId,
        academicYearId,
      ))
    ) {
      throw new BadRequestException({
        message: 'The class does not offer this group in the session',
        code: 'GROUP_NOT_OFFERED',
      });
    }
  }

  // --- Subject selection (electives) -----------------------------------

  async listSubjects(enrollmentId: string): Promise<StudentSubject[]> {
    await this.findById(enrollmentId);
    return this.studentSubjectRepo.findByEnrollment(enrollmentId);
  }

  async selectSubject(
    enrollmentId: string,
    dto: SelectSubjectDto,
  ): Promise<StudentSubject> {
    const enrollment = await this.findById(enrollmentId);
    await this.subjectService.findById(dto.subjectId);

    const offered = await this.classSubjectService.findOffered(
      enrollment.classId,
      dto.subjectId,
      enrollment.academicYearId,
    );
    if (!offered) {
      throw new BadRequestException(
        'Subject is not offered to this student’s class for the year',
      );
    }
    const isFourthSubject = dto.isFourthSubject ?? false;
    if (isFourthSubject) {
      if (!FOURTH_SUBJECT_TYPES.includes(offered.subjectType)) {
        throw new BadRequestException({
          message: 'Only a 4th or optional subject can be the 4th subject',
          code: 'NOT_A_FOURTH_SUBJECT',
        });
      }
      if (await this.studentSubjectRepo.findFourthSubject(enrollmentId)) {
        throw new ConflictException({
          message: 'The student already has a 4th subject',
          code: 'FOURTH_SUBJECT_TAKEN',
        });
      }
    }

    const existing = await this.studentSubjectRepo.findLink(
      enrollmentId,
      dto.subjectId,
    );
    if (existing) {
      throw new ConflictException(
        'Subject already selected for this enrollment',
      );
    }

    const link = await this.studentSubjectRepo.saveNew({
      studentEnrollmentId: enrollmentId,
      subjectId: dto.subjectId,
      isFourthSubject,
    });
    return this.studentSubjectRepo.findByIdWithSubject(
      link.id,
    ) as Promise<StudentSubject>;
  }

  async deselectSubject(enrollmentId: string, linkId: string): Promise<void> {
    const link = await this.studentSubjectRepo.findByIdOrFail(linkId);
    if (link.studentEnrollmentId !== enrollmentId) {
      throw new NotFoundException(
        `Subject selection "${linkId}" not found for enrollment "${enrollmentId}"`,
      );
    }
    await this.studentSubjectRepo.deleteById(linkId);
  }
}
