import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AcademicYearRepository } from '../academic-years/academic-year.repository';
import { ClassRepository } from '../classes/class.repository';
import { SectionRepository } from '../sections/section.repository';
import { StudentService } from '../students/student.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { FilterPromotionDto } from './dto/filter-promotion.dto';
import { StudentPromotion } from './entities/student-promotion.entity';
import { PromotionRepository } from './promotion.repository';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    private readonly promotionRepo: PromotionRepository,
    private readonly studentService: StudentService,
    private readonly academicYearRepo: AcademicYearRepository,
    private readonly classRepo: ClassRepository,
    private readonly sectionRepo: SectionRepository,
  ) {}

  async findFiltered(filter: FilterPromotionDto): Promise<StudentPromotion[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.fromYearId) where.fromYearId = filter.fromYearId;
    if (filter.toYearId) where.toYearId = filter.toYearId;
    return this.promotionRepo.findFiltered(where);
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
    await this.academicYearRepo.findByIdOrFail(dto.fromYearId);
    await this.academicYearRepo.findByIdOrFail(dto.toYearId);
    await this.classRepo.findByIdOrFail(dto.fromClassId);
    await this.classRepo.findByIdOrFail(dto.toClassId);
    if (dto.fromSectionId) {
      await this.sectionRepo.findByIdOrFail(dto.fromSectionId);
    }
    if (dto.toSectionId) {
      await this.sectionRepo.findByIdOrFail(dto.toSectionId);
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
