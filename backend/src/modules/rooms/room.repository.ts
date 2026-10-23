import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Room } from './entities/room.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class RoomRepository extends BaseTenantRepository<Room> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Room, 'Room');
  }

  findByName(name: string): Promise<Room | null> {
    return this.repo.findOne({ where: { name } });
  }

  findFiltered(
    where: FindOptionsWhere<Room>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Room>> {
    return this.findPage(
      { where, order: { building: 'ASC', name: 'ASC' } },
      page,
    );
  }
}
