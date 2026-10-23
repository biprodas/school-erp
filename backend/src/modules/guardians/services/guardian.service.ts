import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { normalizePhone } from '~/common/identity/identifier';
import { Paginated } from '~/common/dto/paginated.dto';
import {
  InviteService,
  type ProvisionResult,
} from '~/modules/auth/services/invite.service';
import { GUARDIAN_ROLE_NAME } from '~/modules/rbac/system-roles.seed';
import { StudentService } from '~/modules/students/services/student.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AttachGuardianDto } from '../dto/attach-guardian.dto';
import { CreateGuardianDto } from '../dto/create-guardian.dto';
import { FilterGuardianDto } from '../dto/filter-guardian.dto';
import { UpdateGuardianDto } from '../dto/update-guardian.dto';
import { UpdateLinkDto } from '../dto/update-link.dto';
import { Guardian } from '../entities/guardian.entity';
import { StudentGuardian } from '../entities/student-guardian.entity';
import { GuardianRelation } from '../enums/guardian-relation.enum';
import { GuardianRepository } from '../repositories/guardian.repository';
import { StudentGuardianRepository } from '../repositories/student-guardian.repository';

/** A guardian made inside a caller's transaction, mail still to send. */
export interface GuardianProvisioned {
  guardian: Guardian;
  /** False when an existing guardian (same phone) was returned. */
  created: boolean;
  account: ProvisionResult | null;
}

/** A phone as stored; 400 for one that isn't a valid number. */
function storedPhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new BadRequestException({
      message: 'Invalid phone number',
      code: 'INVALID_PHONE',
    });
  }
  return normalized;
}

/**
 * Guardians and their links to students (PRD 6.6). Every guardian gets a
 * portal login with the guardian role, through the invite flow: an
 * activation link when they have an email, else a printed slip on request
 * (`portalSlip`). One person who is already a member here (a teacher who
 * is also a parent) keeps their account and gains the guardian role.
 */
@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    private readonly guardianRepo: GuardianRepository,
    private readonly linkRepo: StudentGuardianRepository,
    private readonly invites: InviteService,
    private readonly studentService: StudentService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  // --- Guardian person CRUD --------------------------------------------

  /** `allowedSectionIds`: the caller's scope (null = every guardian). */
  findFiltered(
    filter: FilterGuardianDto,
    allowedSectionIds: string[] | null = null,
  ): Promise<Paginated<Guardian>> {
    if (allowedSectionIds !== null) {
      return this.guardianRepo.findInSections(filter, allowedSectionIds);
    }
    const where: FindOptionsWhere<Guardian> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.phone)
      where.phone = normalizePhone(filter.phone) ?? filter.phone;
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

  /** 404 unless the scope reaches a student of the guardian. */
  async assertReachable(
    id: string,
    allowedSectionIds: string[] | null,
  ): Promise<void> {
    if (allowedSectionIds === null) return;
    const page = await this.guardianRepo.findInSections(
      { id, page: 1, limit: 1 },
      allowedSectionIds,
    );
    if (!page.items.length) {
      throw new NotFoundException(`Guardian with id "${id}" not found`);
    }
  }

  /** The guardian with this phone, if any (any format). */
  findByPhone(phone: string): Promise<Guardian | null> {
    const normalized = normalizePhone(phone);
    return normalized
      ? this.guardianRepo.findByPhone(normalized)
      : Promise.resolve(null);
  }

  async create(dto: CreateGuardianDto): Promise<Guardian> {
    const made = await this.ds.runInTransaction(async () => {
      if (dto.phone && (await this.findByPhone(dto.phone))) {
        throw phoneTaken();
      }
      return this.provision(dto);
    });
    await made.account?.sendMail();
    return this.findById(made.guardian.id);
  }

  /**
   * The guardian with the phone in `dto`, or a new one with a portal login
   * (imports and inline creation). Joins the caller's transaction; send
   * `account.sendMail()` after it commits.
   */
  async findOrProvision(dto: CreateGuardianDto): Promise<GuardianProvisioned> {
    const existing = dto.phone ? await this.findByPhone(dto.phone) : null;
    if (existing) return { guardian: existing, created: false, account: null };
    return this.provision(dto);
  }

  async update(id: string, dto: UpdateGuardianDto): Promise<Guardian> {
    const guardian = await this.findById(id);
    const phone = dto.phone !== undefined ? storedPhone(dto.phone) : undefined;
    if (phone && phone !== guardian.phone) {
      const other = await this.guardianRepo.findByPhone(phone);
      if (other && other.id !== id) throw phoneTaken();
    }
    await this.guardianRepo.updateFields(id, {
      ...dto,
      ...(phone !== undefined && { phone }),
    });
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

  /** A printed-slip password for a guardian without one of their own. */
  async portalSlip(id: string): Promise<{ temporaryPassword: string }> {
    const guardian = await this.findById(id);
    if (!guardian.userId) {
      throw new NotFoundException({
        message: 'The guardian has no portal login',
        code: 'NO_PORTAL_ACCOUNT',
      });
    }
    return this.invites.issueSlip(guardian.userId);
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
    const { link, account } = await this.ds.runInTransaction(async () => {
      await this.studentService.findById(studentId);
      let guardianId: string;
      let account: ProvisionResult | null = null;
      if (dto.guardianId) {
        guardianId = (await this.findById(dto.guardianId)).id;
      } else {
        // Same phone as an existing guardian: that guardian is linked.
        const made = await this.findOrProvision(dto.createGuardian!);
        guardianId = made.guardian.id;
        account = made.account;
      }
      const link = await this.link(studentId, guardianId, {
        relation: dto.relation,
        isPrimary: dto.isPrimary ?? false,
        isEmergency: dto.isEmergency ?? false,
      });
      return { link, account };
    });
    await account?.sendMail();
    return this.linkRepo.findByIdOrFail(link.id);
  }

  /**
   * Links a guardian to a student (409 if already linked). A primary link
   * takes over from the previous one. Joins the caller's transaction.
   */
  async link(
    studentId: string,
    guardianId: string,
    options: {
      relation: GuardianRelation;
      isPrimary: boolean;
      isEmergency?: boolean;
    },
  ): Promise<StudentGuardian> {
    if (await this.linkRepo.findLink(studentId, guardianId)) {
      throw new ConflictException({
        message: 'Guardian is already linked to this student',
        code: 'GUARDIAN_ALREADY_LINKED',
      });
    }
    if (options.isPrimary) await this.linkRepo.clearPrimary(studentId);
    return this.linkRepo.saveNew({
      studentId,
      guardianId,
      relation: options.relation,
      isPrimary: options.isPrimary,
      isEmergency: options.isEmergency ?? false,
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

  /** A new guardian plus their portal login, in the caller's transaction. */
  private async provision(
    dto: CreateGuardianDto,
  ): Promise<GuardianProvisioned> {
    const phone = storedPhone(dto.phone);
    const account = await this.invites.provision({
      name: dto.name,
      email: dto.email,
      phone: phone ?? undefined,
      portalRole: GUARDIAN_ROLE_NAME,
      membership: 'active',
      phoneSlip: false,
      linkExistingMember: true,
    });
    const guardian = await this.guardianRepo.saveNew({
      name: dto.name,
      nameBn: dto.nameBn ?? null,
      phone,
      email: dto.email ?? null,
      address: dto.address ?? null,
      occupation: dto.occupation ?? null,
      income: dto.income ?? null,
      nid: dto.nid ?? null,
      userId: account.userId,
    });
    return { guardian, created: true, account };
  }
}

const phoneTaken = () =>
  new ConflictException({
    message: 'A guardian with this phone already exists; link them instead',
    code: 'GUARDIAN_PHONE_TAKEN',
  });
