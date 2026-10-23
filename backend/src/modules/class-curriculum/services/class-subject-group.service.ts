import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { SubjectGroupService } from '~/modules/subject-groups/services/subject-group.service';
import { CreateClassSubjectGroupDto } from '../dto/create-class-subject-group.dto';
import { FilterClassSubjectGroupDto } from '../dto/filter-class-subject-group.dto';
import { UpdateClassSubjectGroupDto } from '../dto/update-class-subject-group.dto';
import { ClassSubjectGroup } from '../entities/class-subject-group.entity';
import { ClassSubjectGroupRepository } from '../repositories/class-subject-group.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class ClassSubjectGroupService {
  private readonly logger = new Logger(ClassSubjectGroupService.name);

  constructor(
    private readonly classSubjectGroupRepo: ClassSubjectGroupRepository,
    private readonly classService: ClassService,
    private readonly subjectGroupService: SubjectGroupService,
    private readonly academicYearService: AcademicYearService,
  ) {}

  findFiltered(
    filter: FilterClassSubjectGroupDto,
  ): Promise<Paginated<ClassSubjectGroup>> {
    const where: FindOptionsWhere<ClassSubjectGroup> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.subjectGroupId) where.subjectGroupId = filter.subjectGroupId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.classSubjectGroupRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<ClassSubjectGroup> {
    const entity = await this.classSubjectGroupRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(
        `ClassSubjectGroup with id "${id}" not found`,
      );
    }
    return entity;
  }

  async create(dto: CreateClassSubjectGroupDto): Promise<ClassSubjectGroup> {
    await this.classService.findById(dto.classId);
    await this.subjectGroupService.findById(dto.subjectGroupId);
    await this.academicYearService.findById(dto.academicYearId);

    const existing = await this.classSubjectGroupRepo.findLink(
      dto.classId,
      dto.subjectGroupId,
      dto.academicYearId,
    );
    if (existing) {
      throw new ConflictException(
        'Subject group is already offered to this class for the year',
      );
    }

    const created = await this.classSubjectGroupRepo.saveNew({
      classId: dto.classId,
      subjectGroupId: dto.subjectGroupId,
      academicYearId: dto.academicYearId,
    });
    return this.findById(created.id);
  }

  async update(
    id: string,
    dto: UpdateClassSubjectGroupDto,
  ): Promise<ClassSubjectGroup> {
    const entity = await this.findById(id);
    if (dto.classId) await this.classService.findById(dto.classId);
    if (dto.subjectGroupId) {
      await this.subjectGroupService.findById(dto.subjectGroupId);
    }
    if (dto.academicYearId) {
      await this.academicYearService.findById(dto.academicYearId);
    }

    const next = {
      classId: dto.classId ?? entity.classId,
      subjectGroupId: dto.subjectGroupId ?? entity.subjectGroupId,
      academicYearId: dto.academicYearId ?? entity.academicYearId,
    };
    const existing = await this.classSubjectGroupRepo.findLink(
      next.classId,
      next.subjectGroupId,
      next.academicYearId,
    );
    if (existing && existing.id !== id) {
      throw new ConflictException(
        'Subject group is already offered to this class for the year',
      );
    }

    await this.classSubjectGroupRepo.updateLink(id, next);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classSubjectGroupRepo.deleteById(id);
  }

  /** Whether the class offers the group in the session. */
  async isOffered(
    classId: string,
    subjectGroupId: string,
    academicYearId: string,
  ): Promise<boolean> {
    return !!(await this.classSubjectGroupRepo.findLink(
      classId,
      subjectGroupId,
      academicYearId,
    ));
  }

  /**
   * Session rollover: offers every group of `fromYearId` in `toYearId`
   * too. With `merge`, groups already offered are skipped; otherwise a
   * clash is refused. Call inside the caller's transaction.
   */
  async copyToYear(
    fromYearId: string,
    toYearId: string,
    merge: boolean,
  ): Promise<{ created: number; skipped: number }> {
    const key = (g: ClassSubjectGroup) => `${g.classId}:${g.subjectGroupId}`;
    const existing = new Set(
      (await this.classSubjectGroupRepo.findInYear(toYearId)).map(key),
    );
    const result = { created: 0, skipped: 0 };
    for (const source of await this.classSubjectGroupRepo.findInYear(
      fromYearId,
    )) {
      if (existing.has(key(source))) {
        if (!merge) {
          throw new ConflictException({
            message: 'The target session already offers subject groups',
            code: 'ROLLOVER_TARGET_NOT_EMPTY',
          });
        }
        result.skipped++;
        continue;
      }
      await this.classSubjectGroupRepo.saveNew({
        classId: source.classId,
        subjectGroupId: source.subjectGroupId,
        academicYearId: toYearId,
      });
      result.created++;
    }
    return result;
  }
}
