import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { FindOptionsWhere } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { AppHosts } from '~/shared/hosts/app-hosts';
import { QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { GuardianRelation } from '~/modules/guardians/enums/guardian-relation.enum';
import { GuardianService } from '~/modules/guardians/services/guardian.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { NumberingService } from '~/modules/numbering/numbering.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { StudentService } from '~/modules/students/services/student.service';
import { CertificateRepository } from '../certificate.repository';
import {
  FilterCertificateDto,
  IssueCertificateDto,
  RevokeCertificateDto,
} from '../dto/certificate.dto';
import {
  Certificate,
  type CertificateData,
} from '../entities/certificate.entity';
import { CertificateStatus } from '../enums/certificate.enum';

export const CERTIFICATE_KEY = 'certificate';
export const CERTIFICATE_PDF_JOB = 'certificate';

/**
 * Certificates (PRD 6.6): issued with a serial and a snapshot of the
 * student's details, verifiable by QR code, revocable with a reason.
 */
@Injectable()
export class CertificateService {
  constructor(
    private readonly certificateRepo: CertificateRepository,
    private readonly students: StudentService,
    private readonly enrollments: EnrollmentService,
    private readonly guardians: GuardianService,
    private readonly settings: SettingsService,
    private readonly numbering: NumberingService,
    private readonly jobs: JobService,
    private readonly audit: AuditService,
    private readonly hosts: AppHosts,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
    @Inject(REQUEST) private readonly request: RequestWithOrg,
  ) {}

  findFiltered(filter: FilterCertificateDto): Promise<Paginated<Certificate>> {
    const where: FindOptionsWhere<Certificate> = {};
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    return this.certificateRepo.findFiltered(where, filter);
  }

  findById(id: string): Promise<Certificate> {
    return this.certificateRepo.findByIdOrFail(id);
  }

  issue(studentId: string, dto: IssueCertificateDto): Promise<Certificate> {
    return this.ds.runInTransaction(async () => {
      const verifyToken = randomBytes(24).toString('base64url');
      const data = await this.snapshot(studentId, verifyToken, dto);
      const pattern = (await this.settings.getSection('numbering')).certificate;
      const certificate = await this.certificateRepo.saveNew({
        studentId,
        type: dto.type,
        serial: await this.numbering.nextFormatted(CERTIFICATE_KEY, pattern),
        issuedAt: new Date(),
        issuedBy: this.context.current().userId,
        data,
        status: CertificateStatus.VALID,
        revokeReason: null,
        revokedAt: null,
        revokedBy: null,
        verifyToken,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.CERTIFICATE_ISSUED,
        entityType: 'certificate',
        entityId: certificate.id,
        after: { studentId, type: dto.type, serial: certificate.serial },
      });
      return certificate;
    });
  }

  revoke(id: string, dto: RevokeCertificateDto): Promise<Certificate> {
    return this.ds.runInTransaction(async () => {
      const certificate = await this.findById(id);
      if (certificate.status === CertificateStatus.REVOKED) {
        throw new ConflictException({
          message: 'The certificate is already revoked',
          code: 'CERTIFICATE_REVOKED',
        });
      }
      Object.assign(certificate, {
        status: CertificateStatus.REVOKED,
        revokeReason: dto.reason,
        revokedAt: new Date(),
        revokedBy: this.context.current().userId,
      });
      await this.certificateRepo.save(certificate);
      await this.audit.record({
        action: AUDIT_ACTIONS.CERTIFICATE_REVOKED,
        entityType: 'certificate',
        entityId: id,
        after: { reason: dto.reason },
      });
      return certificate;
    });
  }

  /** Queues the PDF (fixed layout per type, with the QR code). */
  async startPdf(id: string): Promise<Job> {
    await this.findById(id);
    return this.jobs.start<{ certificateId: string }>({
      type: 'certificates.pdf',
      queue: QUEUES.pdf,
      name: CERTIFICATE_PDF_JOB,
      data: { certificateId: id },
    });
  }

  private async snapshot(
    studentId: string,
    verifyToken: string,
    dto: IssueCertificateDto,
  ): Promise<CertificateData> {
    const student = await this.students.findById(studentId);
    const [latest] = await this.enrollments.findForStudent(studentId);
    const links = await this.guardians.listForStudent(studentId);
    const named = (relation: GuardianRelation) =>
      links.find((l) => l.relation === relation)?.guardian?.name ?? null;
    const school = await this.settings.getDisplay();
    return {
      studentName: student.fullName,
      studentNameBn: student.nameBn,
      admissionNumber: student.admissionNumber,
      dob: student.dob,
      fatherName: named(GuardianRelation.FATHER),
      motherName: named(GuardianRelation.MOTHER),
      className: latest?.schoolClass?.name ?? null,
      sectionName: latest?.section?.name ?? null,
      rollNo: latest?.rollNo ?? null,
      sessionName: latest?.academicYear?.name ?? null,
      schoolName: school.name,
      schoolNameBn: school.nameBn,
      verifyUrl: this.hosts.url(
        this.hosts.schoolHost(this.request.orgSlug!),
        `/verify/${verifyToken}`,
      ),
      remarks: dto.remarks ?? null,
      conduct: dto.conduct ?? null,
      leavingReason: dto.leavingReason ?? null,
    };
  }
}
