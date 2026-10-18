import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { DesignationController } from './designation.controller';
import { DesignationRepository } from './designation.repository';
import { DesignationService } from './designation.service';

@Module({
  imports: [RbacModule],
  controllers: [DesignationController],
  providers: [DesignationRepository, DesignationService],
  exports: [DesignationService],
})
export class DesignationModule {}
