import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
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

  create(dto: CreateAcademicYearDto): Promise<AcademicYear> {
    return this.ds.runInTransaction(async () => {
      const existing = await this.academicYearRepo.findByName(dto.name);
      if (existing) {
        throw new ConflictException('Academic year name already in use');
      }

      const isCurrent = dto.isCurrent ?? false;
      if (isCurrent) {
        await this.academicYearRepo.clearCurrent();
      }

      return this.academicYearRepo.saveNew({
        name: dto.name,
        code: dto.code ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
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
      return this.academicYearRepo.save(academicYear);
    });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.academicYearRepo.deleteById(id);
  }
}
