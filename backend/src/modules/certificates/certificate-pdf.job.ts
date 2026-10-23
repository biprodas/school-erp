import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { PdfService } from '~/shared/pdf/pdf.service';
import { qrSvg } from '~/shared/pdf/qr';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { CertificateStatus } from './enums/certificate.enum';
import {
  CERTIFICATE_PDF_JOB,
  CertificateService,
} from './services/certificate.service';
import { ID_CARDS_JOB } from './services/id-card.service';

/** PDFs for certificates and ID cards, on the `pdf` queue. */
@Injectable()
export class CertificatePdfJob {
  constructor(
    private readonly tracker: JobTracker,
    private readonly pdf: PdfService,
  ) {}

  @JobHandler(QUEUES.pdf, CERTIFICATE_PDF_JOB)
  certificate(
    payload: JobPayload<{ certificateId: string }>,
    context: JobContext,
  ) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const certificates = await resolve(CertificateService);
      const files = await resolve(FileService);
      const c = await certificates.findById(payload.data.certificateId);
      const buffer = await this.pdf.render(`certificates/${c.type}`, {
        d: c.data,
        serial: c.serial,
        issuedOn: c.issuedAt.toISOString().slice(0, 10),
        revoked: c.status === CertificateStatus.REVOKED,
        qr: await qrSvg(c.data.verifyUrl),
      });
      const stored = await files.storeGenerated({
        buffer,
        originalName: `${c.type}-${c.serial}.pdf`,
      });
      return { fileId: stored.id };
    });
  }

  @JobHandler(QUEUES.pdf, ID_CARDS_JOB)
  idCards(payload: JobPayload<{ sectionId: string }>, context: JobContext) {
    return this.tracker.run(payload, context, async (scope) => {
      const { resolve } = scope;
      const sections = await resolve(SectionService);
      const enrollments = await resolve(EnrollmentService);
      const files = await resolve(FileService);
      const settings = await resolve(SettingsService);
      const section = await sections.findById(payload.data.sectionId);
      const school = await settings.getDisplay();
      const rows = await enrollments.findActiveInSection(section.id);
      const cards: Record<string, string | null>[] = [];
      for (const [i, e] of rows.entries()) {
        const s = e.student;
        let photo: string | null = null;
        if (s.photoFileId) {
          const { buffer, mime } = await files.read(s.photoFileId);
          photo = `data:${mime};base64,${buffer.toString('base64')}`;
        }
        cards.push({
          name: s.fullName,
          nameBn: s.nameBn,
          admissionNumber: s.admissionNumber,
          rollNo: e.rollNo,
          bloodGroup: s.bloodGroup,
          photo,
          qr: await qrSvg(s.admissionNumber),
        });
        await scope.progress(((i + 1) / rows.length) * 80);
      }
      const buffer = await this.pdf.render('id-cards/cards', {
        schoolName: school.name,
        schoolNameBn: school.nameBn,
        className: section.schoolClass?.name ?? '',
        sectionName: section.name,
        sessionName: section.academicYear?.name ?? '',
        cards,
      });
      const stored = await files.storeGenerated({
        buffer,
        originalName: `id-cards-${section.name}.pdf`,
      });
      return { fileId: stored.id, result: { cards: cards.length } };
    });
  }
}
