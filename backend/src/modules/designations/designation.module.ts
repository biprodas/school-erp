import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { DesignationController } from './designation.controller';
import { DesignationRepository } from './designation.repository';
import { DesignationService } from './designation.service';

@Module({
  imports: [RbacModule],
  controllers: [DesignationController],
  providers: [DesignationRepository, DesignationService],
  exports: [DesignationService, DesignationRepository],
})
export class DesignationModule {}
