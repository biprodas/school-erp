import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource, In } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { Membership } from 'src/modules/platform/memberships/entities/membership.entity';
import { MembershipRole } from 'src/modules/platform/memberships/enums/membership-role.enum';
import { Key } from '~/common/enums/keys.enum';
import { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { TenantMigrationService } from '~/tenancy/tenant-migration.service';
import { TenantMiddleware } from '~/tenancy/tenant.middleware';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { RequestContextDto } from '~/common/dto/request-context.dto';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Membership)
    private membershipRepository: Repository<Membership>,
    @InjectDataSource()
    private dataSource: DataSource,
    private tenantConnectionService: TenantConnectionService,
    private tenantMigrationService: TenantMigrationService,
    private configService: ConfigService,
  ) {}

  /**
   * Creates a tenant. If the requester is not a SUPER_ADMIN they
   * automatically receive an OWNER membership for the new tenant.
   *
   * The entire operation (record + schema + membership) is wrapped
   * in a transaction so partial state is rolled back on failure.
   */
  async createTenant(
    ctx: RequestContextDto,
    dto: CreateTenantDto,
  ): Promise<Tenant> {
    const { user } = ctx;
    const ownerId =
      user?.role === PlatformRole.SUPER_ADMIN ? undefined : user?.id ?? '';

    // Two-phase flow:
    // 1) Create tenant record + schema and COMMIT (so other connections can see it)
    // 2) Run migrations/sync using a separate connection
    // 3) Create membership
    // If phase (2) fails, perform compensating rollback (drop schema + delete tenant).
    const schemaName = `${Key.TenantSchemaPrefix}${dto.slug
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let tenant: Tenant | null = null;
    try {
      const existing = await queryRunner.manager.findOne(Tenant, {
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException('Tenant slug already exists');
      }

      tenant = queryRunner.manager.create(Tenant, {
        ...dto,
        schemaName,
      });
      await queryRunner.manager.save(tenant);

      const quoted = this.quoteIdentifier(schemaName);
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ${quoted}`);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create tenant "${dto.slug}": ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }

    try {
      await this.runTenantMigrations(schemaName);

      if (ownerId && tenant) {
        await this.membershipRepository.save(
          this.membershipRepository.create({
            userId: ownerId,
            tenantId: tenant.id,
            role: MembershipRole.OWNER,
          }),
        );
      }

      // tenant is always set if we got here, but keep types safe
      return tenant as Tenant;
    } catch (error) {
      // Compensating rollback: best-effort cleanup to avoid orphaned tenants/schemas.
      try {
        const cleanupRunner = this.dataSource.createQueryRunner();
        await cleanupRunner.connect();
        await cleanupRunner.startTransaction();
        try {
          const quoted = this.quoteIdentifier(schemaName);
          await cleanupRunner.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`);
          if (tenant?.id) {
            await cleanupRunner.manager.delete(Tenant, tenant.id);
          } else {
            await cleanupRunner.manager.delete(Tenant, { slug: dto.slug });
          }
          await cleanupRunner.commitTransaction();
        } catch (cleanupErr) {
          await cleanupRunner.rollbackTransaction();
          this.logger.error(
            `Failed compensating rollback for tenant "${dto.slug}": ${(cleanupErr as Error).message}`,
          );
        } finally {
          await cleanupRunner.release();
        }
      } catch (cleanupOuterErr) {
        this.logger.error(
          `Failed to initialize compensating rollback: ${(cleanupOuterErr as Error).message}`,
        );
      }

      this.logger.error(
        `Failed to finalize tenant "${dto.slug}" setup: ${error.message}`,
      );
      throw error;
    }
  }

  async getAllTenants(ctx: RequestContextDto): Promise<Tenant[]> {
    if (ctx.user?.role !== PlatformRole.SUPER_ADMIN) {
      return this.getTenantsByUser(ctx, ctx.user?.id ?? '');
    }

    return this.tenantRepository.find();
  }

  /** Returns only tenants where the user has any membership. */
  async getTenantsByUser(_ctx: RequestContextDto, userId: string): Promise<Tenant[]> {
    const memberships = await this.membershipRepository.find({
      where: { userId },
    });
    const tenantIds = memberships.map((m) => m.tenantId);
    if (!tenantIds.length) return [];
    return this.tenantRepository.find({ where: { id: In(tenantIds) } });
  }

  async findById(ctx: RequestContextDto, id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { slug } });
  }

  /**
   * Returns a tenant only if the requester is a SUPER_ADMIN or has any
   * membership in that tenant.
   */
  async findByIdForUser(
    ctx: RequestContextDto,
    id: string,
  ): Promise<Tenant> {
    const tenant = await this.findById(ctx, id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (ctx.user?.role === PlatformRole.SUPER_ADMIN) return tenant;

    const membership = await this.membershipRepository.findOne({
      where: { tenantId: id, userId: ctx.user?.id ?? '' },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
    }
    return tenant;
  }

  async updateTenant(
    ctx: RequestContextDto,
    id: string,
    dto: UpdateTenantDto,
  ): Promise<Tenant> {
    const { user } = ctx;
    const tenant = await this.findById(ctx, id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (user?.role !== PlatformRole.SUPER_ADMIN) {
      const membership = await this.membershipRepository.findOne({
        where: { tenantId: id, userId: user?.id ?? '', role: MembershipRole.OWNER },
      });
      if (!membership) {
        throw new ForbiddenException('Only the tenant owner or a super admin can update this tenant');
      }
    }

    Object.assign(tenant, dto);
    const saved = await this.tenantRepository.save(tenant);
    TenantMiddleware.invalidateCache(tenant.slug);
    return saved;
  }

  async deleteTenant(ctx: RequestContextDto, id: string): Promise<void> {
    const tenant = await this.findById(ctx, id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quoted = this.quoteIdentifier(tenant.schemaName);
      await queryRunner.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`);
      await queryRunner.manager.delete(Tenant, id);
      await queryRunner.commitTransaction();
      TenantMiddleware.invalidateCache(tenant.slug);
      this.logger.log(`Tenant "${tenant.slug}" and schema ${tenant.schemaName} deleted`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to delete tenant "${tenant.slug}": ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async runTenantMigrations(schemaName: string) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (isProduction) {
      const result =
        await this.tenantMigrationService.runMigrationsForSchema(schemaName);
      if (result.status === 'failed') {
        throw new Error(
          `Migration failed for schema ${schemaName}: ${result.error}`,
        );
      }
      return;
    }

    await this.tenantConnectionService.synchronizeSchema(schemaName);
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
