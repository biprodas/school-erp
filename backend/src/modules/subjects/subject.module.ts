import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { SubjectController } from './subject.controller';
import { SubjectRepository } from './subject.repository';
import { SubjectService } from './subject.service';

@Module({
  imports: [RbacModule],
  controllers: [SubjectController],
  providers: [SubjectRepository, SubjectService],
  exports: [SubjectService],
})
export class SubjectModule {}
