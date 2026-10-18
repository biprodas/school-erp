import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreatePeriodDto } from '../dto/create-period.dto';
import { UpdatePeriodDto } from '../dto/update-period.dto';
import { Period } from '../entities/period.entity';
import { PeriodRepository } from '../repositories/period.repository';

@Injectable()
export class PeriodService {
  private readonly logger = new Logger(PeriodService.name);

  constructor(private readonly periodRepo: PeriodRepository) {}

  async findAll(): Promise<Period[]> {
    return this.periodRepo.findFiltered({});
  }

  async findById(id: string): Promise<Period> {
    return this.periodRepo.findByIdOrFail(id);
  }

  async create(dto: CreatePeriodDto): Promise<Period> {
    const existing = await this.periodRepo.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Period name already in use');
    }

    return this.periodRepo.saveNew({
      name: dto.name,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdatePeriodDto): Promise<Period> {
    const period = await this.findById(id);

    if (dto.name && dto.name !== period.name) {
      const conflict = await this.periodRepo.findByName(dto.name);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Period name already in use');
      }
    }

    Object.assign(period, dto);
    return this.periodRepo.save(period);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.periodRepo.deleteById(id);
  }
}
