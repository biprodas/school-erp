import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Raw,
} from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import {
  BD_FIXED_HOLIDAYS,
  BD_MOVABLE_HOLIDAYS,
  type MovableHolidayTemplate,
} from '~/shared/templates';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { ClassService } from '~/modules/classes/class.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { FilterHolidayDto } from './dto/filter-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Holiday } from './entities/holiday.entity';
import { HolidayType } from './enums/holiday-type.enum';
import { HolidayRepository } from './holiday.repository';

export interface HolidayTemplateResult {
  year: number;
  created: number;
  skipped: number;
  /** Moon-dependent holidays the school adds once their dates are set. */
  toConfirm: MovableHolidayTemplate[];
}

/** Whether a holiday covers `classId` (school-wide ones cover every class). */
export const appliesToClass = (holiday: Holiday, classId: string) =>
  holiday.classIds.length === 0 || holiday.classIds.includes(classId);

/**
 * The holiday calendar (PRD 6.7): public, school and religious holidays,
 * school-wide or for some classes. Attendance asks it whether a day can be
 * taken; onboarding applies the Bangladesh template.
 */
@Injectable()
export class HolidayService {
  constructor(
    private readonly holidayRepo: HolidayRepository,
    private readonly classes: ClassService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(filter: FilterHolidayDto): Promise<Paginated<Holiday>> {
    const where: FindOptionsWhere<Holiday> = {};
    if (filter.from) where.dateTo = MoreThanOrEqual(filter.from);
    if (filter.to) where.dateFrom = LessThanOrEqual(filter.to);
    if (filter.type) where.type = filter.type;
    if (filter.classId) {
      // School-wide (empty list) or naming the class.
      where.classIds = Raw(
        (column) => `(cardinality(${column}) = 0 OR :classId = ANY(${column}))`,
        { classId: filter.classId },
      );
    }
    return this.holidayRepo.findFiltered(where, filter);
  }

  findById(id: string): Promise<Holiday> {
    return this.holidayRepo.findByIdOrFail(id);
  }

  /** Holidays overlapping `[from, to]`, for calendars and registers. */
  findBetween(from: string, to: string): Promise<Holiday[]> {
    return this.holidayRepo.findOverlapping(from, to);
  }

  /** The holiday on `date` for a class, if any. */
  async findOn(date: string, classId: string): Promise<Holiday | null> {
    const holidays = await this.holidayRepo.findOverlapping(date, date);
    return holidays.find((h) => appliesToClass(h, classId)) ?? null;
  }

  async create(dto: CreateHolidayDto): Promise<Holiday> {
    const dateTo = dto.dateTo ?? dto.dateFrom;
    assertRange(dto.dateFrom, dateTo);
    const classIds = await this.checkClasses(dto.classIds ?? []);
    await this.assertFree(dto.name, dto.dateFrom);
    return this.holidayRepo.saveNew({
      name: dto.name,
      nameBn: dto.nameBn ?? null,
      type: dto.type,
      dateFrom: dto.dateFrom,
      dateTo,
      classIds,
    });
  }

  async update(id: string, dto: UpdateHolidayDto): Promise<Holiday> {
    const holiday = await this.findById(id);
    const next = {
      name: dto.name ?? holiday.name,
      nameBn: dto.nameBn !== undefined ? dto.nameBn : holiday.nameBn,
      type: dto.type ?? holiday.type,
      dateFrom: dto.dateFrom ?? holiday.dateFrom,
      dateTo:
        dto.dateTo ??
        (dto.dateFrom && holiday.dateTo === holiday.dateFrom
          ? dto.dateFrom
          : holiday.dateTo),
      classIds:
        dto.classIds !== undefined
          ? await this.checkClasses(dto.classIds)
          : holiday.classIds,
    };
    assertRange(next.dateFrom, next.dateTo);
    if (next.name !== holiday.name || next.dateFrom !== holiday.dateFrom) {
      await this.assertFree(next.name, next.dateFrom, id);
    }
    return this.holidayRepo.save(Object.assign(holiday, next));
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.holidayRepo.deleteById(id);
  }

  /**
   * Adds the Bangladesh fixed-date holidays for a year (idempotent: a
   * holiday with the same name and start is skipped) and lists the
   * moon-dependent ones for the school to add.
   */
  applyBdTemplate(year?: number): Promise<HolidayTemplateResult> {
    return this.ds.runInTransaction(async () => {
      const y = year ?? Number((await this.settings.today()).slice(0, 4));
      let created = 0;
      let skipped = 0;
      for (const t of BD_FIXED_HOLIDAYS) {
        const date = `${y}-${pad(t.month)}-${pad(t.day)}`;
        if (await this.holidayRepo.findByNameAndStart(t.name, date)) {
          skipped++;
          continue;
        }
        await this.holidayRepo.saveNew({
          name: t.name,
          nameBn: t.nameBn,
          type: t.type as HolidayType,
          dateFrom: date,
          dateTo: date,
          classIds: [],
        });
        created++;
      }
      await this.audit.record({
        action: AUDIT_ACTIONS.TEMPLATE_APPLIED,
        entityType: 'template',
        entityId: 'bd-holidays',
        after: { template: 'bd', year: y, created, skipped },
      });
      return { year: y, created, skipped, toConfirm: BD_MOVABLE_HOLIDAYS };
    });
  }

  private async checkClasses(classIds: string[]): Promise<string[]> {
    const unique = [...new Set(classIds)];
    for (const id of unique) await this.classes.findById(id);
    return unique;
  }

  private async assertFree(name: string, dateFrom: string, exceptId?: string) {
    const existing = await this.holidayRepo.findByNameAndStart(name, dateFrom);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({
        message: 'A holiday with this name already starts on that day',
        code: 'HOLIDAY_EXISTS',
      });
    }
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

function assertRange(from: string, to: string): void {
  if (to < from) {
    throw new BadRequestException({
      message: 'A holiday must end on or after the day it starts',
      code: 'INVALID_DATE_RANGE',
    });
  }
}
