import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AcademicYearModule } from '../academic-years/academic-year.module';
import { ClassModule } from '../classes/class.module';
import { SectionModule } from '../sections/section.module';
import { StudentModule } from '../students/student.module';
import { PromotionController } from './promotion.controller';
import { PromotionRepository } from './promotion.repository';
import { PromotionService } from './promotion.service';

@Module({
  imports: [
    RbacModule,
    StudentModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
  ],
  controllers: [PromotionController],
  providers: [PromotionRepository, PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
