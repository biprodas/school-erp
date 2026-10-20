import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AuditLogController } from './controllers/audit-log.controller';
import { PlatformAuditLogController } from './controllers/platform-audit-log.controller';
import { PlatformAuditLog } from './entities/platform-audit-log.entity';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { AuditService } from './services/audit.service';
import { PlatformAuditService } from './services/platform-audit.service';

/**
 * Audit logs (PRD 6.3, 8.1): `AuditService` for a school's `audit_logs`
 * (tenant connection, joins the caller's transaction) and
 * `PlatformAuditService` for `platform_audit_logs` (root connection).
 * Global because nearly every module records something, including RbacModule,
 * which this module needs for its permission guard.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlatformAuditLog]), RbacModule],
  controllers: [AuditLogController, PlatformAuditLogController],
  providers: [AuditLogRepository, AuditService, PlatformAuditService],
  exports: [AuditService, PlatformAuditService],
})
export class AuditModule {}
