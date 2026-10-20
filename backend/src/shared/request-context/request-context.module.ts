import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { RequestContext } from './request-context.service';

/**
 * Continuation-local request context for the whole app. The CLS middleware
 * is mounted on every route and keeps the request (`CLS_REQ`), which
 * `RequestContext` reads. Global, like the config.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, saveReq: true },
    }),
  ],
  providers: [RequestContext],
  exports: [RequestContext],
})
export class RequestContextModule {}
