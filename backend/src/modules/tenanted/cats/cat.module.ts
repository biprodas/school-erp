import { Module } from '@nestjs/common';
import { CatController } from './cat.controller';
import { CatRepository } from './cat.repository';
import { CatService } from './cat.service';

@Module({
  controllers: [CatController],
  providers: [CatRepository, CatService],
  exports: [CatService],
})
export class CatModule {}
