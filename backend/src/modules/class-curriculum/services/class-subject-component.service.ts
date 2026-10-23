import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateClassSubjectComponentDto,
  UpdateClassSubjectComponentDto,
} from '../dto/class-subject-component.dto';
import { ClassSubjectComponent } from '../entities/class-subject-component.entity';
import { ClassSubjectComponentRepository } from '../repositories/class-subject-component.repository';

/**
 * The CQ / MCQ / practical / written / oral parts of a class subject, each
 * with its full and pass marks (PRD 6.4). Exams (M5) read them.
 */
@Injectable()
export class ClassSubjectComponentService {
  constructor(
    private readonly componentRepo: ClassSubjectComponentRepository,
  ) {}

  list(classSubjectId: string): Promise<ClassSubjectComponent[]> {
    return this.componentRepo.findByClassSubject(classSubjectId);
  }

  /** The class subject must exist; callers check it. */
  async add(
    classSubjectId: string,
    dto: CreateClassSubjectComponentDto,
  ): Promise<ClassSubjectComponent> {
    assertMarks(dto.fullMarks, dto.passMarks ?? null);
    const existing = await this.componentRepo.findByComponent(
      classSubjectId,
      dto.component,
    );
    if (existing) {
      throw new ConflictException({
        message: `The subject already has a ${dto.component} component`,
        code: 'COMPONENT_EXISTS',
      });
    }
    return this.componentRepo.saveNew({
      classSubjectId,
      component: dto.component,
      fullMarks: dto.fullMarks,
      passMarks: dto.passMarks ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async update(
    classSubjectId: string,
    id: string,
    dto: UpdateClassSubjectComponentDto,
  ): Promise<ClassSubjectComponent> {
    const component = await this.getOrFail(classSubjectId, id);
    if (dto.component && dto.component !== component.component) {
      const clash = await this.componentRepo.findByComponent(
        classSubjectId,
        dto.component,
      );
      if (clash) {
        throw new ConflictException({
          message: `The subject already has a ${dto.component} component`,
          code: 'COMPONENT_EXISTS',
        });
      }
    }
    Object.assign(component, dto);
    assertMarks(component.fullMarks, component.passMarks);
    return this.componentRepo.save(component);
  }

  async remove(classSubjectId: string, id: string): Promise<void> {
    await this.getOrFail(classSubjectId, id);
    await this.componentRepo.deleteById(id);
  }

  private async getOrFail(
    classSubjectId: string,
    id: string,
  ): Promise<ClassSubjectComponent> {
    const component = await this.componentRepo.findById(id);
    if (!component || component.classSubjectId !== classSubjectId) {
      throw new NotFoundException(
        `Component "${id}" not found for class subject "${classSubjectId}"`,
      );
    }
    return component;
  }
}

function assertMarks(fullMarks: number, passMarks: number | null): void {
  if (passMarks !== null && passMarks > fullMarks) {
    throw new BadRequestException({
      message: 'Pass marks cannot exceed full marks',
      code: 'INVALID_MARKS',
    });
  }
}
