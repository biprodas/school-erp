import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { SectionController } from './section.controller';
import { SectionRepository } from './section.repository';
import { SectionService } from './section.service';

@Module({
  imports: [RbacModule],
  controllers: [SectionController],
  providers: [SectionRepository, SectionService],
  exports: [SectionService, SectionRepository],
})
export class SectionModule {}
