import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateAttendanceStatusDto,
  UpdateAttendanceStatusDto,
} from '../dto/attendance-status.dto';
import { AttendanceStatus } from '../entities/attendance-status.entity';
import {
  type AttendanceStatusView,
  SYSTEM_STATUSES,
  SYSTEM_STATUS_CODES,
} from '../enums/attendance.enum';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceStatusRepository } from '../repositories/attendance-status.repository';

const view = (s: AttendanceStatus): AttendanceStatusView => ({
  id: s.id,
  code: s.code,
  labelEn: s.labelEn,
  labelBn: s.labelBn,
  countsAs: s.countsAs,
  symbol: s.symbol,
  sortOrder: s.sortOrder,
  isSystem: false,
  isActive: s.isActive,
});

/**
 * Attendance statuses (PRD 6.7): the five fixed system ones plus the
 * school's own. Read once per request.
 */
@Injectable()
export class AttendanceStatusService {
  private all?: Promise<AttendanceStatusView[]>;

  constructor(
    private readonly statusRepo: AttendanceStatusRepository,
    private readonly recordRepo: AttendanceRecordRepository,
  ) {}

  /** System statuses first, then the school's, each by sort order. */
  list(): Promise<AttendanceStatusView[]> {
    this.all ??= this.statusRepo
      .findAllOrdered()
      .then((custom) => [...SYSTEM_STATUSES, ...custom.map(view)]);
    return this.all;
  }

  /** Every status by code, inactive ones included (they're on old records). */
  async byCode(): Promise<Map<string, AttendanceStatusView>> {
    return new Map((await this.list()).map((s) => [s.code, s]));
  }

  async create(dto: CreateAttendanceStatusDto): Promise<AttendanceStatusView> {
    if (
      SYSTEM_STATUS_CODES.has(dto.code) ||
      (await this.statusRepo.findByCode(dto.code))
    ) {
      throw new ConflictException({
        message: `Status code "${dto.code}" is taken`,
        code: 'STATUS_CODE_TAKEN',
      });
    }
    const saved = await this.statusRepo.saveNew({
      code: dto.code,
      labelEn: dto.labelEn,
      labelBn: dto.labelBn,
      countsAs: dto.countsAs,
      symbol: dto.symbol,
      sortOrder: dto.sortOrder ?? 100,
      isActive: dto.isActive ?? true,
    });
    this.all = undefined;
    return view(saved);
  }

  async update(
    id: string,
    dto: UpdateAttendanceStatusDto,
  ): Promise<AttendanceStatusView> {
    const status = await this.findCustom(id);
    const saved = await this.statusRepo.save(Object.assign(status, dto));
    this.all = undefined;
    return view(saved);
  }

  /** Only while no record uses it; otherwise deactivate it. */
  async remove(id: string): Promise<void> {
    const status = await this.findCustom(id);
    if (await this.recordRepo.countWithStatus(status.code)) {
      throw new ConflictException({
        message: 'Records use this status; deactivate it instead',
        code: 'STATUS_IN_USE',
      });
    }
    await this.statusRepo.deleteById(id);
    this.all = undefined;
  }

  private async findCustom(id: string): Promise<AttendanceStatus> {
    const status = await this.statusRepo.findById(id);
    if (!status) {
      throw new NotFoundException(`Attendance status "${id}" not found`);
    }
    return status;
  }
}
