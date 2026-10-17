import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { CatController } from './cat.controller';
import { CatRepository } from './cat.repository';
import { CatService } from './cat.service';

@Module({
  imports: [RbacModule],
  controllers: [CatController],
  providers: [CatRepository, CatService],
  exports: [CatService],
})
export class CatModule {}
