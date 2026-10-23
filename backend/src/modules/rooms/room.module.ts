import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { RoomController } from './room.controller';
import { RoomRepository } from './room.repository';
import { RoomService } from './room.service';

@Module({
  imports: [RbacModule],
  controllers: [RoomController],
  providers: [RoomRepository, RoomService],
  exports: [RoomService],
})
export class RoomModule {}
