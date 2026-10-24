import { ConflictException, Injectable } from '@nestjs/common';
import { CreateExamTypeDto, UpdateExamTypeDto } from '../dto/exam.dto';
import { ExamType } from '../entities/exam-type.entity';
import { ExamTypeRepository } from '../repositories/exam-type.repository';

/** Exam types (class test, monthly, half-yearly, annual, …). */
@Injectable()
export class ExamTypeService {
  constructor(private readonly typeRepo: ExamTypeRepository) {}

  findAll(): Promise<ExamType[]> {
    return this.typeRepo.findAllOrdered();
  }

  findById(id: string): Promise<ExamType> {
    return this.typeRepo.findByIdOrFail(id);
  }

  async create(dto: CreateExamTypeDto): Promise<ExamType> {
    await this.assertNameFree(dto.name);
    return this.typeRepo.saveNew({
      name: dto.name,
      defaultWeight: dto.defaultWeight ?? 100,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async update(id: string, dto: UpdateExamTypeDto): Promise<ExamType> {
    const type = await this.findById(id);
    if (dto.name && dto.name !== type.name) await this.assertNameFree(dto.name);
    return this.typeRepo.save(Object.assign(type, dto));
  }

  /** Its exams keep running, without a type. */
  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.typeRepo.deleteById(id);
  }

  private async assertNameFree(name: string) {
    if (await this.typeRepo.findByName(name)) {
      throw new ConflictException({
        message: `An exam type is already called "${name}"`,
        code: 'EXAM_TYPE_EXISTS',
      });
    }
  }
}
