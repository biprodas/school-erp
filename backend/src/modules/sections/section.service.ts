import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { RoomService } from '~/modules/rooms/room.service';
import { ShiftService } from '~/modules/shifts/shift.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { FilterSectionDto } from './dto/filter-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { Section } from './entities/section.entity';
import { SectionRepository } from './section.repository';
import { Paginated } from '~/common/dto/paginated.dto';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';

/** What `copyToYear` did; `ids` maps each source section to its copy. */
export interface SectionCopyResult {
  ids: Map<string, string>;
  created: number;
  skipped: number;
}

const sectionKey = (classId: string, name: string) =>
  `${classId}:${name.trim().toLowerCase()}`;

@Injectable()
export class SectionService {
  constructor(
    private readonly sectionRepo: SectionRepository,
    private readonly academicYearService: AcademicYearService,
    private readonly classService: ClassService,
    private readonly shiftService: ShiftService,
    private readonly roomService: RoomService,
  ) {}

  /**
   * `allowedIds` is the caller's `AccessScope.sections(...)` answer:
   * `null` lists everything, a list only those sections.
   */
  findFiltered(
    filter: FilterSectionDto,
    allowedIds: string[] | null = null,
  ): Promise<Paginated<Section>> {
    const where: FindOptionsWhere<Section> = {};
    if (filter.id) where.id = filter.id;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.classId) where.classId = filter.classId;
    if (filter.shiftId) where.shiftId = filter.shiftId;
    if (filter.name) where.name = filter.name;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (allowedIds !== null) {
      const ids = filter.id
        ? allowedIds.filter((id) => id === filter.id)
        : allowedIds;
      if (!ids.length) {
        const { page = 1, limit = DEFAULT_PAGE_SIZE } = filter;
        return Promise.resolve(new Paginated<Section>([], 0, { page, limit }));
      }
      where.id = In(ids);
    }
    return this.sectionRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Section> {
    const section = await this.sectionRepo.findByIdWithRelations(id);
    if (!section) {
      throw new NotFoundException(`Section with id "${id}" not found`);
    }
    return section;
  }

  /** Every section of a session (setup lists are small). */
  findInYear(academicYearId: string): Promise<Section[]> {
    return this.sectionRepo.findInYear(academicYearId);
  }

  countInYear(academicYearId: string): Promise<number> {
    return this.sectionRepo.countInYear(academicYearId);
  }

  async create(dto: CreateSectionDto): Promise<Section> {
    await this.academicYearService.findById(dto.academicYearId);
    await this.classService.findById(dto.classId);
    if (dto.shiftId) await this.shiftService.findById(dto.shiftId);
    if (dto.roomId) await this.roomService.findById(dto.roomId);
    await this.assertNameFree(dto.academicYearId, dto.classId, dto.name);

    const section = await this.sectionRepo.saveNew({
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      name: dto.name,
      shiftId: dto.shiftId ?? null,
      roomId: dto.roomId ?? null,
      capacity: dto.capacity ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.findById(section.id);
  }

  async update(id: string, dto: UpdateSectionDto): Promise<Section> {
    const section = await this.findById(id);
    if (dto.name && dto.name !== section.name) {
      await this.assertNameFree(
        section.academicYearId,
        section.classId,
        dto.name,
        id,
      );
    }
    if (dto.shiftId) await this.shiftService.findById(dto.shiftId);
    if (dto.roomId) await this.roomService.findById(dto.roomId);

    await this.sectionRepo.updateFields(id, dto);
    return this.findById(id);
  }

  /** Refused (409) while students are enrolled in it. */
  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.sectionRepo.deleteById(id);
  }

  /**
   * Session rollover: copies every section of `fromYearId` into
   * `toYearId` (same class, name, shift, room, capacity) with new ids.
   * With `merge`, sections whose class and name already exist in the
   * target are skipped and mapped to the existing one. Call inside the
   * caller's transaction.
   */
  async copyToYear(
    fromYearId: string,
    toYearId: string,
    merge: boolean,
  ): Promise<SectionCopyResult> {
    const existing = new Map(
      (await this.sectionRepo.findInYear(toYearId)).map((s) => [
        sectionKey(s.classId, s.name),
        s.id,
      ]),
    );
    const result: SectionCopyResult = {
      ids: new Map(),
      created: 0,
      skipped: 0,
    };
    for (const source of await this.sectionRepo.findInYear(fromYearId)) {
      const match = existing.get(sectionKey(source.classId, source.name));
      if (match) {
        if (!merge) {
          throw new ConflictException({
            message: 'The target session already has sections',
            code: 'ROLLOVER_TARGET_NOT_EMPTY',
          });
        }
        result.ids.set(source.id, match);
        result.skipped++;
        continue;
      }
      const copy = await this.sectionRepo.saveNew({
        academicYearId: toYearId,
        classId: source.classId,
        name: source.name,
        shiftId: source.shiftId,
        roomId: source.roomId,
        capacity: source.capacity,
        isActive: source.isActive,
      });
      result.ids.set(source.id, copy.id);
      result.created++;
    }
    return result;
  }

  /**
   * Maps each section of `fromYearId` to the section of the same class and
   * name in `toYearId`, where one exists (rollover without copying).
   */
  async matchInYear(
    fromYearId: string,
    toYearId: string,
  ): Promise<Map<string, string>> {
    const target = new Map(
      (await this.sectionRepo.findInYear(toYearId)).map((s) => [
        sectionKey(s.classId, s.name),
        s.id,
      ]),
    );
    const ids = new Map<string, string>();
    for (const s of await this.sectionRepo.findInYear(fromYearId)) {
      const match = target.get(sectionKey(s.classId, s.name));
      if (match) ids.set(s.id, match);
    }
    return ids;
  }

  private async assertNameFree(
    academicYearId: string,
    classId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.sectionRepo.findByName(
      academicYearId,
      classId,
      name,
    );
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({
        message:
          'This class already has a section with that name in the session',
        code: 'SECTION_NAME_TAKEN',
      });
    }
  }
}
