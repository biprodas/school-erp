import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearRepository } from '../academic-years/academic-year.repository';
import { ClassRepository } from '../classes/class.repository';
import { ClassSubjectRepository } from '../class-curriculum/class-subject.repository';
import { SectionRepository } from '../sections/section.repository';
import { SubjectRepository } from '../subjects/subject.repository';
import { StudentService } from '../students/student.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { FilterEnrollmentDto } from './dto/filter-enrollment.dto';
import { SelectSubjectDto } from './dto/select-subject.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { StudentEnrollment } from './entities/student-enrollment.entity';
import { StudentSubject } from './entities/student-subject.entity';
import { StudentEnrollmentStatus } from './enums/student-enrollment-status.enum';
import { EnrollmentRepository } from './enrollment.repository';
import { StudentSubjectRepository } from './student-subject.repository';

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly studentSubjectRepo: StudentSubjectRepository,
    private readonly studentService: StudentService,
    private readonly academicYearRepo: AcademicYearRepository,
    private readonly classRepo: ClassRepository,
    private readonly sectionRepo: SectionRepository,
    private readonly subjectRepo: SubjectRepository,
    private readonly classSubjectRepo: ClassSubjectRepository,
  ) {}

  // --- Enrollment CRUD -------------------------------------------------

  async findFiltered(
    filter: FilterEnrollmentDto,
  ): Promise<StudentEnrollment[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.classId) where.classId = filter.classId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.status) where.status = filter.status;
    return this.enrollmentRepo.findFiltered(where);
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
    await this.academicYearRepo.findByIdOrFail(dto.academicYearId);
    await this.classRepo.findByIdOrFail(dto.classId);
    await this.sectionRepo.findByIdOrFail(dto.sectionId);

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

    if (dto.classId && dto.classId !== enrollment.classId) {
      await this.classRepo.findByIdOrFail(dto.classId);
    }
    if (dto.sectionId && dto.sectionId !== enrollment.sectionId) {
      await this.sectionRepo.findByIdOrFail(dto.sectionId);
    }

    Object.assign(enrollment, dto);
    await this.enrollmentRepo.save(enrollment);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.enrollmentRepo.deleteById(id);
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
    await this.subjectRepo.findByIdOrFail(dto.subjectId);

    const offered = await this.classSubjectRepo.findOfferedSubjectIds(
      enrollment.classId,
      enrollment.academicYearId,
    );
    if (!offered.includes(dto.subjectId)) {
      throw new BadRequestException(
        'Subject is not offered to this student’s class for the year',
      );
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
