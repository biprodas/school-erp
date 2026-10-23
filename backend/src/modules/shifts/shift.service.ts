import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CreateShiftDto } from './dto/create-shift.dto';
import { FilterShiftDto } from './dto/filter-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { Shift } from './entities/shift.entity';
import { ShiftRepository } from './shift.repository';
import { Paginated } from '~/common/dto/paginated.dto';

/** `HH:mm` → `HH:mm:ss`, so times compare as strings. */
const normalizeTime = (time: string) =>
  time.length === 5 ? `${time}:00` : time;

@Injectable()
export class ShiftService {
  constructor(private readonly shiftRepo: ShiftRepository) {}

  findFiltered(filter: FilterShiftDto): Promise<Paginated<Shift>> {
    const where: FindOptionsWhere<Shift> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    return this.shiftRepo.findFiltered(where, filter);
  }

  findById(id: string): Promise<Shift> {
    return this.shiftRepo.findByIdOrFail(id);
  }

  async create(dto: CreateShiftDto): Promise<Shift> {
    await this.assertNameFree(dto.name);
    const startTime = normalizeTime(dto.startTime);
    const endTime = normalizeTime(dto.endTime);
    assertTimes(startTime, endTime);
    return this.shiftRepo.saveNew({
      name: dto.name,
      startTime,
      endTime,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async update(id: string, dto: UpdateShiftDto): Promise<Shift> {
    const shift = await this.findById(id);
    if (dto.name && dto.name !== shift.name) {
      await this.assertNameFree(dto.name, id);
    }
    Object.assign(shift, {
      ...dto,
      ...(dto.startTime && { startTime: normalizeTime(dto.startTime) }),
      ...(dto.endTime && { endTime: normalizeTime(dto.endTime) }),
    });
    assertTimes(shift.startTime, shift.endTime);
    return this.shiftRepo.save(shift);
  }

  /** Sections in the shift keep running, without one (`shift_id` → null). */
  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.shiftRepo.deleteById(id);
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const existing = await this.shiftRepo.findByName(name);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Shift name already in use');
    }
  }
}

function assertTimes(startTime: string, endTime: string): void {
  if (startTime >= endTime) {
    throw new BadRequestException({
      message: 'A shift must end after it starts',
      code: 'INVALID_TIME_RANGE',
    });
  }
}
