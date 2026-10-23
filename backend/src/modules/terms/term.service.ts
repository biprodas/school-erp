import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { CreateTermDto } from './dto/create-term.dto';
import { FilterTermDto } from './dto/filter-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { Term } from './entities/term.entity';
import { TermRepository } from './term.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class TermService {
  constructor(
    private readonly termRepo: TermRepository,
    private readonly academicYearService: AcademicYearService,
  ) {}

  findFiltered(filter: FilterTermDto): Promise<Paginated<Term>> {
    const where: FindOptionsWhere<Term> = {};
    if (filter.id) where.id = filter.id;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.termRepo.findFiltered(where, filter);
  }

  findById(id: string): Promise<Term> {
    return this.termRepo.findByIdOrFail(id);
  }

  async create(dto: CreateTermDto): Promise<Term> {
    await this.assertNameFree(dto.academicYearId, dto.name);
    await this.assertDates(dto.academicYearId, dto.startDate, dto.endDate);
    return this.termRepo.saveNew({
      academicYearId: dto.academicYearId,
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async update(id: string, dto: UpdateTermDto): Promise<Term> {
    const term = await this.findById(id);
    if (dto.name && dto.name !== term.name) {
      await this.assertNameFree(term.academicYearId, dto.name, id);
    }
    Object.assign(term, dto);
    await this.assertDates(term.academicYearId, term.startDate, term.endDate);
    return this.termRepo.save(term);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.termRepo.deleteById(id);
  }

  private async assertNameFree(
    academicYearId: string,
    name: string,
    exceptId?: string,
  ) {
    const existing = await this.termRepo.findByName(academicYearId, name);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Term name already in use in this session');
    }
  }

  /** start ≤ end, both inside the session. */
  private async assertDates(
    academicYearId: string,
    startDate: string,
    endDate: string,
  ) {
    const year = await this.academicYearService.findById(academicYearId);
    const outside =
      (year.startDate && startDate < year.startDate) ||
      (year.endDate && endDate > year.endDate);
    if (startDate > endDate || outside) {
      throw new BadRequestException({
        message: 'A term must end after it starts, inside its session',
        code: 'INVALID_DATE_RANGE',
      });
    }
  }
}
