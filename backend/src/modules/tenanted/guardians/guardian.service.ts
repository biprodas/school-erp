import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoleRepository } from '../rbac/role.repository';
import { StudentService } from '../students/student.service';
import { UserService } from '../users/user.service';
import { AttachGuardianDto } from './dto/attach-guardian.dto';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { FilterGuardianDto } from './dto/filter-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { Guardian } from './entities/guardian.entity';
import { StudentGuardian } from './entities/student-guardian.entity';
import { GuardianRepository } from './guardian.repository';
import { StudentGuardianRepository } from './student-guardian.repository';

const PARENT_ROLE_NAME = 'parent';

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    private readonly guardianRepo: GuardianRepository,
    private readonly linkRepo: StudentGuardianRepository,
    private readonly userService: UserService,
    private readonly roleRepo: RoleRepository,
    private readonly studentService: StudentService,
  ) {}

  // --- Guardian person CRUD --------------------------------------------

  async findFiltered(filter: FilterGuardianDto): Promise<Guardian[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.phone) where.phone = filter.phone;
    if (filter.email) where.email = filter.email;
    if (filter.userId) where.userId = filter.userId;
    return this.guardianRepo.findFiltered(where);
  }

  async findById(id: string): Promise<Guardian> {
    const guardian = await this.guardianRepo.findByIdWithUser(id);
    if (!guardian) {
      throw new NotFoundException(`Guardian with id "${id}" not found`);
    }
    return guardian;
  }

  async create(dto: CreateGuardianDto): Promise<Guardian> {
    const guardian = await this.createEntity(dto);
    return this.findById(guardian.id);
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
      const role = await this.roleRepo.findByName(PARENT_ROLE_NAME);
      if (!role) {
        throw new NotFoundException(
          `System role "${PARENT_ROLE_NAME}" is not seeded for this tenant`,
        );
      }
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

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.guardianRepo.deleteById(id);
  }

  // --- Student <-> Guardian links --------------------------------------

  async listForStudent(studentId: string): Promise<StudentGuardian[]> {
    await this.studentService.findById(studentId);
    return this.linkRepo.findByStudent(studentId);
  }

  async attach(
    studentId: string,
    dto: AttachGuardianDto,
  ): Promise<StudentGuardian> {
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
      const existing = await this.linkRepo.findLink(studentId, dto.guardianId);
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
  }

  async updateLink(
    studentId: string,
    linkId: string,
    dto: UpdateLinkDto,
  ): Promise<StudentGuardian> {
    const link = await this.getLinkOrFail(studentId, linkId);

    if (dto.isPrimary === true && !link.isPrimary) {
      await this.linkRepo.clearPrimary(studentId);
    }

    Object.assign(link, dto);
    await this.linkRepo.save(link);
    return this.linkRepo.findByIdOrFail(linkId);
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
