import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { FilterAcademicYearDto } from './dto/filter-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { AcademicYear } from './entities/academic-year.entity';
import { AcademicYearRepository } from './academic-year.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class AcademicYearService {
  private readonly logger = new Logger(AcademicYearService.name);

  constructor(
    private readonly academicYearRepo: AcademicYearRepository,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(
    filter: FilterAcademicYearDto,
  ): Promise<Paginated<AcademicYear>> {
    const where: FindOptionsWhere<AcademicYear> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.isCurrent !== undefined) where.isCurrent = filter.isCurrent;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.academicYearRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<AcademicYear> {
    return this.academicYearRepo.findByIdOrFail(id);
  }

  /** The academic year marked current, if one is. */
  findCurrent(): Promise<AcademicYear | null> {
    return this.academicYearRepo.findCurrent();
  }

  /** `GET /academic-years/current`: 404 when no session is current. */
  async getCurrent(): Promise<AcademicYear> {
    const year = await this.findCurrent();
    if (!year) {
      throw new NotFoundException({
        message: 'No academic session is marked current',
        code: 'NO_CURRENT_SESSION',
      });
    }
    return year;
  }

  create(dto: CreateAcademicYearDto): Promise<AcademicYear> {
    return this.ds.runInTransaction(async () => {
      const existing = await this.academicYearRepo.findByName(dto.name);
      if (existing) {
        throw new ConflictException('Academic year name already in use');
      }

      await this.assertDates(dto.startDate, dto.endDate);

      const isCurrent = dto.isCurrent ?? false;
      if (isCurrent) {
        await this.academicYearRepo.clearCurrent();
      }

      return this.academicYearRepo.saveNew({
        name: dto.name,
        code: dto.code ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isCurrent,
        isActive: dto.isActive ?? true,
        description: dto.description ?? null,
      });
    });
  }

  update(id: string, dto: UpdateAcademicYearDto): Promise<AcademicYear> {
    return this.ds.runInTransaction(async () => {
      const academicYear = await this.findById(id);

      if (dto.name && dto.name !== academicYear.name) {
        const conflict = await this.academicYearRepo.findByName(dto.name);
        if (conflict && conflict.id !== id) {
          throw new ConflictException('Academic year name already in use');
        }
      }

      if (dto.isCurrent === true && !academicYear.isCurrent) {
        await this.academicYearRepo.clearCurrent(id);
      }

      Object.assign(academicYear, dto);
      if (dto.startDate || dto.endDate) {
        await this.assertDates(
          academicYear.startDate,
          academicYear.endDate,
          id,
        );
      }
      return this.academicYearRepo.save(academicYear);
    });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.academicYearRepo.deleteById(id);
  }

  /**
   * start < end, and no day shared with another (not deleted) session.
   * Checked inside the write's transaction; two concurrent overlapping
   * writes are rare enough (setup screens) not to need a DB constraint.
   */
  private async assertDates(
    startDate: string | null,
    endDate: string | null,
    exceptId?: string,
  ): Promise<void> {
    if (!startDate || !endDate || startDate >= endDate) {
      throw new BadRequestException({
        message: 'A session must end after it starts',
        code: 'INVALID_DATE_RANGE',
      });
    }
    const overlap = await this.academicYearRepo.findOverlapping(
      startDate,
      endDate,
      exceptId,
    );
    if (overlap) {
      throw new ConflictException({
        message: `The dates overlap session "${overlap.name}"`,
        code: 'SESSION_OVERLAP',
      });
    }
  }
}
