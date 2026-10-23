import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { TermController } from './term.controller';
import { TermRepository } from './term.repository';
import { TermService } from './term.service';

@Module({
  imports: [RbacModule, AcademicYearModule],
  controllers: [TermController],
  providers: [TermRepository, TermService],
  exports: [TermService],
})
export class TermModule {}
