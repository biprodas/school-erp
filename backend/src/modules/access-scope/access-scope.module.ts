import { forwardRef, Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { TeachingModule } from '~/modules/teaching/teaching.module';
import { AccessScope } from './access-scope.service';

/**
 * Scope rules on top of RBAC: which sections and subjects a user's
 * permissions reach. Separate from RbacModule because it needs teaching
 * assignments, and TeachingModule itself depends on RbacModule. The
 * section and teaching controllers filter by it, hence the `forwardRef`.
 */
@Module({
  imports: [RbacModule, forwardRef(() => TeachingModule)],
  providers: [AccessScope],
  exports: [AccessScope],
})
export class AccessScopeModule {}
