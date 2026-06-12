import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { SectionModule } from '../sections/section.module';
import { ClassController } from './class.controller';
import { ClassSectionController } from './class-section.controller';
import { ClassRepository } from './class.repository';
import { ClassSectionRepository } from './class-section.repository';
import { ClassService } from './class.service';

@Module({
  imports: [RbacModule, SectionModule],
  controllers: [ClassController, ClassSectionController],
  providers: [ClassRepository, ClassSectionRepository, ClassService],
  exports: [ClassService, ClassRepository],
})
export class ClassModule {}
