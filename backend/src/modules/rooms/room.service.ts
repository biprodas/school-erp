import { ConflictException, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CreateRoomDto } from './dto/create-room.dto';
import { FilterRoomDto } from './dto/filter-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room } from './entities/room.entity';
import { RoomType } from './enums/room-type.enum';
import { RoomRepository } from './room.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class RoomService {
  constructor(private readonly roomRepo: RoomRepository) {}

  findFiltered(filter: FilterRoomDto): Promise<Paginated<Room>> {
    const where: FindOptionsWhere<Room> = {};
    if (filter.id) where.id = filter.id;
    if (filter.building) where.building = filter.building;
    if (filter.type) where.type = filter.type;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.roomRepo.findFiltered(where, filter);
  }

  findById(id: string): Promise<Room> {
    return this.roomRepo.findByIdOrFail(id);
  }

  async create(dto: CreateRoomDto): Promise<Room> {
    await this.assertNameFree(dto.name);
    return this.roomRepo.saveNew({
      name: dto.name,
      building: dto.building ?? null,
      capacity: dto.capacity ?? null,
      type: dto.type ?? RoomType.CLASSROOM,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.findById(id);
    if (dto.name && dto.name !== room.name) {
      await this.assertNameFree(dto.name, id);
    }
    Object.assign(room, dto);
    return this.roomRepo.save(room);
  }

  /** Sections using it as their home room keep running without one. */
  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.roomRepo.deleteById(id);
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const existing = await this.roomRepo.findByName(name);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Room name already in use');
    }
  }
}
