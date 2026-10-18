import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SubjectService } from '~/modules/subjects/subject.service';
import { AttachGroupSubjectDto } from '../dto/attach-group-subject.dto';
import { CreateSubjectGroupDto } from '../dto/create-subject-group.dto';
import { FilterSubjectGroupDto } from '../dto/filter-subject-group.dto';
import { UpdateGroupSubjectDto } from '../dto/update-group-subject.dto';
import { UpdateSubjectGroupDto } from '../dto/update-subject-group.dto';
import { SubjectGroup } from '../entities/subject-group.entity';
import { SubjectGroupSubject } from '../entities/subject-group-subject.entity';
import { SubjectGroupRepository } from '../repositories/subject-group.repository';
import { SubjectGroupSubjectRepository } from '../repositories/subject-group-subject.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class SubjectGroupService {
  private readonly logger = new Logger(SubjectGroupService.name);

  constructor(
    private readonly subjectGroupRepo: SubjectGroupRepository,
    private readonly linkRepo: SubjectGroupSubjectRepository,
    private readonly subjectService: SubjectService,
  ) {}

  // --- SubjectGroup CRUD -----------------------------------------------

  findFiltered(
    filter: FilterSubjectGroupDto,
  ): Promise<Paginated<SubjectGroup>> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.subjectGroupRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<SubjectGroup> {
    const group = await this.subjectGroupRepo.findByIdWithSubjects(id);
    if (!group) {
      throw new NotFoundException(`SubjectGroup with id "${id}" not found`);
    }
    return group;
  }

  async create(dto: CreateSubjectGroupDto): Promise<SubjectGroup> {
    const existing = await this.subjectGroupRepo.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Subject group name already in use');
    }

    const group = await this.subjectGroupRepo.saveNew({
      name: dto.name,
      code: dto.code ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.findById(group.id);
  }

  async update(id: string, dto: UpdateSubjectGroupDto): Promise<SubjectGroup> {
    const group = await this.findById(id);

    if (dto.name && dto.name !== group.name) {
      const conflict = await this.subjectGroupRepo.findByName(dto.name);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Subject group name already in use');
      }
    }

    Object.assign(group, dto);
    await this.subjectGroupRepo.save(group);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.subjectGroupRepo.deleteById(id);
  }

  // --- SubjectGroup <-> Subject links ----------------------------------

  async listSubjects(groupId: string): Promise<SubjectGroupSubject[]> {
    await this.findById(groupId);
    return this.linkRepo.findByGroup(groupId);
  }

  async attachSubject(
    groupId: string,
    dto: AttachGroupSubjectDto,
  ): Promise<SubjectGroupSubject> {
    await this.findById(groupId);
    await this.subjectService.findById(dto.subjectId);

    const existing = await this.linkRepo.findLink(groupId, dto.subjectId);
    if (existing) {
      throw new ConflictException('Subject is already in this subject group');
    }

    const link = await this.linkRepo.saveNew({
      subjectGroupId: groupId,
      subjectId: dto.subjectId,
      isCompulsory: dto.isCompulsory ?? true,
      displayOrder: dto.displayOrder ?? 0,
    });
    return this.linkRepo.findByIdWithSubject(
      link.id,
    ) as Promise<SubjectGroupSubject>;
  }

  async updateSubject(
    groupId: string,
    linkId: string,
    dto: UpdateGroupSubjectDto,
  ): Promise<SubjectGroupSubject> {
    const link = await this.getLinkOrFail(groupId, linkId);

    Object.assign(link, dto);
    await this.linkRepo.save(link);
    return this.linkRepo.findByIdWithSubject(
      linkId,
    ) as Promise<SubjectGroupSubject>;
  }

  async detachSubject(groupId: string, linkId: string): Promise<void> {
    await this.getLinkOrFail(groupId, linkId);
    await this.linkRepo.deleteById(linkId);
  }

  private async getLinkOrFail(
    groupId: string,
    linkId: string,
  ): Promise<SubjectGroupSubject> {
    const link = await this.linkRepo.findByIdOrFail(linkId);
    if (link.subjectGroupId !== groupId) {
      throw new NotFoundException(
        `Subject link "${linkId}" not found for subject group "${groupId}"`,
      );
    }
    return link;
  }
}
