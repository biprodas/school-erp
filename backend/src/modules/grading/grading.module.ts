import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { ClassGradingController } from './controllers/class-grading.controller';
import { GradingSystemController } from './controllers/grading-system.controller';
import { ClassGradingRepository } from './repositories/class-grading.repository';
import { GradeScaleItemRepository } from './repositories/grade-scale-item.repository';
import { GradingSystemRepository } from './repositories/grading-system.repository';
import { GradingService } from './services/grading.service';

/** Grading systems and the pure grading engine (`engine/`). */
@Module({
  imports: [RbacModule, AcademicYearModule, ClassModule],
  controllers: [GradingSystemController, ClassGradingController],
  providers: [
    GradingSystemRepository,
    GradeScaleItemRepository,
    ClassGradingRepository,
    GradingService,
  ],
  exports: [GradingService],
})
export class GradingModule {}
