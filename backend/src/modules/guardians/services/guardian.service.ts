import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoleService } from '~/modules/rbac/services/role.service';
import { StudentService } from '~/modules/students/services/student.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { AttachGuardianDto } from '../dto/attach-guardian.dto';
import { CreateGuardianDto } from '../dto/create-guardian.dto';
import { FilterGuardianDto } from '../dto/filter-guardian.dto';
import { UpdateGuardianDto } from '../dto/update-guardian.dto';
import { UpdateLinkDto } from '../dto/update-link.dto';
import { Guardian } from '../entities/guardian.entity';
import { StudentGuardian } from '../entities/student-guardian.entity';
import { GuardianRepository } from '../repositories/guardian.repository';
import { StudentGuardianRepository } from '../repositories/student-guardian.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { Paginated } from '~/common/dto/paginated.dto';

const PARENT_ROLE_NAME = 'parent';

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    private readonly guardianRepo: GuardianRepository,
    private readonly linkRepo: StudentGuardianRepository,
    private readonly userService: OrgUserService,
    private readonly roleService: RoleService,
    private readonly studentService: StudentService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  // --- Guardian person CRUD --------------------------------------------

  findFiltered(filter: FilterGuardianDto): Promise<Paginated<Guardian>> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.phone) where.phone = filter.phone;
    if (filter.email) where.email = filter.email;
    if (filter.userId) where.userId = filter.userId;
    return this.guardianRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Guardian> {
    const guardian = await this.guardianRepo.findByIdWithUser(id);
    if (!guardian) {
      throw new NotFoundException(`Guardian with id "${id}" not found`);
    }
    return guardian;
  }

  create(dto: CreateGuardianDto): Promise<Guardian> {
    return this.ds.runInTransaction(async () => {
      const guardian = await this.createEntity(dto);
      return this.findById(guardian.id);
    });
  }

  /** Creates and persists a guardian (no re-fetch); shared with `attach`. */
  private async createEntity(dto: CreateGuardianDto): Promise<Guardian> {
    if (dto.userId && dto.createUser) {
      throw new BadRequestException(
        'Provide either userId or createUser, not both',
      );
    }

    let userId: string | null = null;

    if (dto.userId) {
      await this.userService.findById(dto.userId);
      const linked = await this.guardianRepo.findByUserId(dto.userId);
      if (linked) {
        throw new ConflictException(
          'User is already linked to another guardian',
        );
      }
      userId = dto.userId;
    } else if (dto.createUser) {
      const role = await this.roleService.findSystemRole(PARENT_ROLE_NAME);
      const newUser = await this.userService.create({
        name: dto.name,
        email: dto.createUser.email,
        password: dto.createUser.password,
        roleIds: [role.id],
      });
      userId = newUser.id;
    }

    return this.guardianRepo.saveNew({
      name: dto.name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      userId,
    });
  }

  async update(id: string, dto: UpdateGuardianDto): Promise<Guardian> {
    const guardian = await this.findById(id);

    if (dto.userId && dto.userId !== guardian.userId) {
      await this.userService.findById(dto.userId);
      const linked = await this.guardianRepo.findByUserId(dto.userId);
      if (linked && linked.id !== id) {
        throw new ConflictException(
          'User is already linked to another guardian',
        );
      }
    }

    Object.assign(guardian, dto);
    await this.guardianRepo.save(guardian);
    return this.findById(id);
  }

  /**
   * Soft-deletes the guardian and unlinks them from their students, so
   * students' guardian lists never show a deleted guardian.
   */
  remove(id: string): Promise<void> {
    return this.ds.runInTransaction(async () => {
      await this.findById(id);
      await this.linkRepo.deleteByGuardian(id);
      await this.guardianRepo.deleteById(id);
    });
  }

  // --- Student <-> Guardian links --------------------------------------

  async listForStudent(studentId: string): Promise<StudentGuardian[]> {
    await this.studentService.findById(studentId);
    return this.linkRepo.findByStudent(studentId);
  }

  attach(studentId: string, dto: AttachGuardianDto): Promise<StudentGuardian> {
    return this.ds.runInTransaction(async () => {
      await this.studentService.findById(studentId);

      if (dto.guardianId && dto.createGuardian) {
        throw new BadRequestException(
          'Provide either guardianId or createGuardian, not both',
        );
      }
      if (!dto.guardianId && !dto.createGuardian) {
        throw new BadRequestException(
          'Provide either guardianId or createGuardian',
        );
      }

      let guardianId: string;
      if (dto.guardianId) {
        await this.findById(dto.guardianId);
        const existing = await this.linkRepo.findLink(
          studentId,
          dto.guardianId,
        );
        if (existing) {
          throw new ConflictException(
            'Guardian is already linked to this student',
          );
        }
        guardianId = dto.guardianId;
      } else {
        const guardian = await this.createEntity(dto.createGuardian!);
        guardianId = guardian.id;
      }

      if (dto.isPrimary) {
        await this.linkRepo.clearPrimary(studentId);
      }

      const link = await this.linkRepo.saveNew({
        studentId,
        guardianId,
        relation: dto.relation,
        isPrimary: dto.isPrimary ?? false,
        isEmergency: dto.isEmergency ?? false,
      });

      return this.linkRepo.findByIdOrFail(link.id);
    });
  }

  updateLink(
    studentId: string,
    linkId: string,
    dto: UpdateLinkDto,
  ): Promise<StudentGuardian> {
    return this.ds.runInTransaction(async () => {
      const link = await this.getLinkOrFail(studentId, linkId);

      if (dto.isPrimary === true && !link.isPrimary) {
        await this.linkRepo.clearPrimary(studentId);
      }

      Object.assign(link, dto);
      await this.linkRepo.save(link);
      return this.linkRepo.findByIdOrFail(linkId);
    });
  }

  async detach(studentId: string, linkId: string): Promise<void> {
    await this.getLinkOrFail(studentId, linkId);
    await this.linkRepo.deleteById(linkId);
  }

  private async getLinkOrFail(
    studentId: string,
    linkId: string,
  ): Promise<StudentGuardian> {
    const link = await this.linkRepo.findByIdOrFail(linkId);
    if (link.studentId !== studentId) {
      throw new NotFoundException(
        `Guardian link "${linkId}" not found for student "${studentId}"`,
      );
    }
    return link;
  }
}
