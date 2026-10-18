import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/services/class.service';
import { SectionService } from '~/modules/sections/section.service';
import { StudentService } from '~/modules/students/services/student.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { FilterPromotionDto } from './dto/filter-promotion.dto';
import { StudentPromotion } from './entities/student-promotion.entity';
import { PromotionRepository } from './promotion.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    private readonly promotionRepo: PromotionRepository,
    private readonly studentService: StudentService,
    private readonly academicYearService: AcademicYearService,
    private readonly classService: ClassService,
    private readonly sectionService: SectionService,
  ) {}

  findFiltered(
    filter: FilterPromotionDto,
  ): Promise<Paginated<StudentPromotion>> {
    const where: FindOptionsWhere<StudentPromotion> = {};
    if (filter.id) where.id = filter.id;
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.fromYearId) where.fromYearId = filter.fromYearId;
    if (filter.toYearId) where.toYearId = filter.toYearId;
    return this.promotionRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<StudentPromotion> {
    const entity = await this.promotionRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`StudentPromotion "${id}" not found`);
    }
    return entity;
  }

  async create(dto: CreatePromotionDto): Promise<StudentPromotion> {
    await this.studentService.findById(dto.studentId);
    await this.academicYearService.findById(dto.fromYearId);
    await this.academicYearService.findById(dto.toYearId);
    await this.classService.findById(dto.fromClassId);
    await this.classService.findById(dto.toClassId);
    if (dto.fromSectionId) {
      await this.sectionService.findById(dto.fromSectionId);
    }
    if (dto.toSectionId) {
      await this.sectionService.findById(dto.toSectionId);
    }

    const created = await this.promotionRepo.saveNew({
      studentId: dto.studentId,
      fromYearId: dto.fromYearId,
      toYearId: dto.toYearId,
      fromClassId: dto.fromClassId,
      toClassId: dto.toClassId,
      fromSectionId: dto.fromSectionId ?? null,
      toSectionId: dto.toSectionId ?? null,
      promotionDate: dto.promotionDate ?? null,
    });
    return this.findById(created.id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.promotionRepo.deleteById(id);
  }
}
