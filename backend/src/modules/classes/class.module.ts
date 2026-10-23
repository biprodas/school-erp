import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { ClassController } from './class.controller';
import { ClassRepository } from './class.repository';
import { ClassService } from './class.service';

@Module({
  imports: [RbacModule],
  controllers: [ClassController],
  providers: [ClassRepository, ClassService],
  exports: [ClassService],
})
export class ClassModule {}
