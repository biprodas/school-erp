import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { SectionModule } from '~/modules/sections/section.module';
import { ClassController } from './controllers/class.controller';
import { ClassSectionController } from './controllers/class-section.controller';
import { ClassRepository } from './repositories/class.repository';
import { ClassSectionRepository } from './repositories/class-section.repository';
import { ClassService } from './services/class.service';

@Module({
  imports: [RbacModule, SectionModule],
  controllers: [ClassController, ClassSectionController],
  providers: [ClassRepository, ClassSectionRepository, ClassService],
  exports: [ClassService],
})
export class ClassModule {}
