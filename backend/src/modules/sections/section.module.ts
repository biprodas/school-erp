import { forwardRef, Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { ClassModule } from '~/modules/classes/class.module';
import { RoomModule } from '~/modules/rooms/room.module';
import { ShiftModule } from '~/modules/shifts/shift.module';
import { SectionController } from './section.controller';
import { SectionRepository } from './section.repository';
import { SectionService } from './section.service';

/**
 * `forwardRef`: the controller filters by `AccessScope`, which reads
 * teacher assignments, and `TeachingModule` validates assignments against
 * sections. Only the modules form a cycle; the providers don't.
 */
@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    ClassModule,
    ShiftModule,
    RoomModule,
    forwardRef(() => AccessScopeModule),
  ],
  controllers: [SectionController],
  providers: [SectionRepository, SectionService],
  exports: [SectionService],
})
export class SectionModule {}
