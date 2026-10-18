import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { SectionController } from './section.controller';
import { SectionRepository } from './section.repository';
import { SectionService } from './section.service';

@Module({
  imports: [RbacModule],
  controllers: [SectionController],
  providers: [SectionRepository, SectionService],
  exports: [SectionService],
})
export class SectionModule {}
