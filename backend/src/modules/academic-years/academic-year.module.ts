import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AcademicYearController } from './academic-year.controller';
import { AcademicYearRepository } from './academic-year.repository';
import { AcademicYearService } from './academic-year.service';

@Module({
  imports: [RbacModule],
  controllers: [AcademicYearController],
  providers: [AcademicYearRepository, AcademicYearService],
  exports: [AcademicYearService, AcademicYearRepository],
})
export class AcademicYearModule {}
