import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { SubjectGroupService } from '~/modules/subject-groups/services/subject-group.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import {
  CreateClassSubjectComponentDto,
  UpdateClassSubjectComponentDto,
} from '../dto/class-subject-component.dto';
import { CreateClassSubjectDto } from '../dto/create-class-subject.dto';
import { FilterClassSubjectDto } from '../dto/filter-class-subject.dto';
import { UpdateClassSubjectDto } from '../dto/update-class-subject.dto';
import { ClassSubject } from '../entities/class-subject.entity';
import { ClassSubjectComponent } from '../entities/class-subject-component.entity';
import { ClassSubjectType } from '../enums/class-subject-type.enum';
import { ClassSubjectRepository } from '../repositories/class-subject.repository';
import { ClassSubjectComponentService } from './class-subject-component.service';
import { Paginated } from '~/common/dto/paginated.dto';

/** What `copyToYear` did; `ids` maps each source class subject to its copy. */
export interface ClassSubjectCopyResult {
  ids: Map<string, string>;
  created: number;
  skipped: number;
}

@Injectable()
export class ClassSubjectService {
  private readonly logger = new Logger(ClassSubjectService.name);

  constructor(
    private readonly classSubjectRepo: ClassSubjectRepository,
    private readonly components: ClassSubjectComponentService,
    private readonly classService: ClassService,
    private readonly subjectService: SubjectService,
    private readonly subjectGroupService: SubjectGroupService,
    private readonly academicYearService: AcademicYearService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(
    filter: FilterClassSubjectDto,
  ): Promise<Paginated<ClassSubject>> {
    const where: FindOptionsWhere<ClassSubject> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.subjectId) where.subjectId = filter.subjectId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.subjectGroupId) where.subjectGroupId = filter.subjectGroupId;
    if (filter.subjectType) where.subjectType = filter.subjectType;
    return this.classSubjectRepo.findFiltered(where, filter);
  }

  /** Subject ids a class offers in an academic year. */
  findOfferedSubjectIds(
    classId: string,
    academicYearId: string,
  ): Promise<string[]> {
    return this.classSubjectRepo.findOfferedSubjectIds(classId, academicYearId);
  }

  /** The class subject for a class, subject and year, if offered. */
  findOffered(
    classId: string,
    subjectId: string,
    academicYearId: string,
  ): Promise<ClassSubject | null> {
    return this.classSubjectRepo.findLink(classId, subjectId, academicYearId);
  }

  async findById(id: string): Promise<ClassSubject> {
    const entity = await this.classSubjectRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`ClassSubject with id "${id}" not found`);
    }
    return entity;
  }

  /** Every class subject of a session, with components (exam setup). */
  findInYear(academicYearId: string): Promise<ClassSubject[]> {
    return this.classSubjectRepo.findInYear(academicYearId);
  }

  countInYear(academicYearId: string): Promise<number> {
    return this.classSubjectRepo.countInYear(academicYearId);
  }

  create(dto: CreateClassSubjectDto): Promise<ClassSubject> {
    return this.ds.runInTransaction(async () => {
      await this.classService.findById(dto.classId);
      await this.subjectService.findById(dto.subjectId);
      await this.academicYearService.findById(dto.academicYearId);
      if (dto.subjectGroupId) {
        await this.subjectGroupService.findById(dto.subjectGroupId);
      }

      const existing = await this.classSubjectRepo.findLink(
        dto.classId,
        dto.subjectId,
        dto.academicYearId,
      );
      if (existing) {
        throw new ConflictException(
          'Subject is already offered to this class for the year',
        );
      }

      const components = dto.components ?? [];
      const created = await this.classSubjectRepo.saveNew({
        classId: dto.classId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        subjectType: dto.subjectType ?? ClassSubjectType.COMPULSORY,
        subjectGroupId: dto.subjectGroupId ?? null,
        weeklyClasses: dto.weeklyClasses ?? null,
        passMarks: dto.passMarks ?? null,
        fullMarks:
          dto.fullMarks ??
          (components.length
            ? components.reduce((sum, c) => sum + c.fullMarks, 0)
            : null),
      });
      for (const [order, component] of components.entries()) {
        await this.components.add(created.id, {
          ...component,
          sortOrder: component.sortOrder ?? order,
        });
      }
      return this.findById(created.id);
    });
  }

  async update(id: string, dto: UpdateClassSubjectDto): Promise<ClassSubject> {
    const entity = await this.findById(id);
    if (dto.subjectGroupId) {
      await this.subjectGroupService.findById(dto.subjectGroupId);
    }
    await this.classSubjectRepo.updateFields(entity.id, dto);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classSubjectRepo.deleteById(id);
  }

  // --- Components ------------------------------------------------------

  async listComponents(
    classSubjectId: string,
  ): Promise<ClassSubjectComponent[]> {
    await this.findById(classSubjectId);
    return this.components.list(classSubjectId);
  }

  async addComponent(
    classSubjectId: string,
    dto: CreateClassSubjectComponentDto,
  ): Promise<ClassSubjectComponent> {
    await this.findById(classSubjectId);
    return this.components.add(classSubjectId, dto);
  }

  updateComponent(
    classSubjectId: string,
    componentId: string,
    dto: UpdateClassSubjectComponentDto,
  ): Promise<ClassSubjectComponent> {
    return this.components.update(classSubjectId, componentId, dto);
  }

  removeComponent(classSubjectId: string, componentId: string): Promise<void> {
    return this.components.remove(classSubjectId, componentId);
  }

  // --- Rollover --------------------------------------------------------

  /**
   * Copies every class subject of `fromYearId`, with its components, into
   * `toYearId` with new ids. With `merge`, a subject the class already
   * offers in the target is skipped (and mapped to it); otherwise any
   * clash is refused. Call inside the caller's transaction.
   */
  async copyToYear(
    fromYearId: string,
    toYearId: string,
    merge: boolean,
  ): Promise<ClassSubjectCopyResult> {
    const key = (cs: ClassSubject) => `${cs.classId}:${cs.subjectId}`;
    const existing = new Map(
      (await this.classSubjectRepo.findInYear(toYearId)).map((cs) => [
        key(cs),
        cs.id,
      ]),
    );
    const result: ClassSubjectCopyResult = {
      ids: new Map(),
      created: 0,
      skipped: 0,
    };
    for (const source of await this.classSubjectRepo.findInYear(fromYearId)) {
      const match = existing.get(key(source));
      if (match) {
        if (!merge) throw targetNotEmpty();
        result.ids.set(source.id, match);
        result.skipped++;
        continue;
      }
      const copy = await this.classSubjectRepo.saveNew({
        classId: source.classId,
        subjectId: source.subjectId,
        academicYearId: toYearId,
        subjectType: source.subjectType,
        subjectGroupId: source.subjectGroupId,
        weeklyClasses: source.weeklyClasses,
        passMarks: source.passMarks,
        fullMarks: source.fullMarks,
      });
      for (const c of source.components ?? []) {
        await this.components.add(copy.id, {
          component: c.component,
          fullMarks: c.fullMarks,
          passMarks: c.passMarks,
          sortOrder: c.sortOrder,
        });
      }
      result.ids.set(source.id, copy.id);
      result.created++;
    }
    return result;
  }

  /**
   * Maps each class subject of `fromYearId` to the same class and subject
   * in `toYearId`, where offered (rollover without copying).
   */
  async matchInYear(
    fromYearId: string,
    toYearId: string,
  ): Promise<Map<string, string>> {
    const key = (cs: ClassSubject) => `${cs.classId}:${cs.subjectId}`;
    const target = new Map(
      (await this.classSubjectRepo.findInYear(toYearId)).map((cs) => [
        key(cs),
        cs.id,
      ]),
    );
    const ids = new Map<string, string>();
    for (const cs of await this.classSubjectRepo.findInYear(fromYearId)) {
      const match = target.get(key(cs));
      if (match) ids.set(cs.id, match);
    }
    return ids;
  }

  /** Throws unless the class subject is in the given class and session. */
  assertInSection(
    classSubject: ClassSubject,
    section: { classId: string; academicYearId: string },
  ): void {
    if (
      classSubject.classId !== section.classId ||
      classSubject.academicYearId !== section.academicYearId
    ) {
      throw new BadRequestException({
        message: "The subject is not in the section's class and session",
        code: 'SUBJECT_NOT_IN_SECTION',
      });
    }
  }
}

const targetNotEmpty = () =>
  new ConflictException({
    message: 'The target session already has class subjects',
    code: 'ROLLOVER_TARGET_NOT_EMPTY',
  });
