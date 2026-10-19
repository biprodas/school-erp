import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { JobHandlerMetadata } from './job-handler.decorator';
import type { JobContext, JobHandlerFn, JobPayload } from './job.types';
import { JOB_HANDLER_METADATA, type QueueName } from './queue.constants';

const key = (queue: string, name: string) => `${queue}:${name}`;

/** Finds every `@JobHandler()` method at startup and dispatches jobs to it. */
@Injectable()
export class JobHandlerRegistry implements OnModuleInit {
  private readonly handlers = new Map<string, JobHandlerFn>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      // Request-scoped providers have no static instance; handlers must be
      // singletons (tenant work runs through TenantJobRunner instead).
      if (!wrapper.isDependencyTreeStatic() || !instance) continue;
      const proto = Object.getPrototypeOf(instance) as object | null;
      if (!proto) continue;
      for (const method of this.scanner.getAllMethodNames(proto)) {
        const fn = (instance as Record<string, unknown>)[method];
        if (typeof fn !== 'function') continue;
        const meta = this.reflector.get<JobHandlerMetadata | undefined>(
          JOB_HANDLER_METADATA,
          fn,
        );
        if (meta) {
          this.register(
            meta.queue,
            meta.name,
            (fn as JobHandlerFn).bind(instance) as JobHandlerFn,
          );
        }
      }
    }
  }

  register(queue: QueueName, name: string, handler: JobHandlerFn): void {
    const k = key(queue, name);
    if (this.handlers.has(k)) {
      throw new Error(`Duplicate job handler for ${k}`);
    }
    this.handlers.set(k, handler);
  }

  /** Queues that have at least one handler (the ones that need a worker). */
  queues(): QueueName[] {
    return [
      ...new Set([...this.handlers.keys()].map((k) => k.split(':')[0])),
    ] as QueueName[];
  }

  async dispatch(payload: JobPayload, context: JobContext): Promise<unknown> {
    const handler = this.handlers.get(key(context.queue, context.name));
    if (!handler) {
      throw new Error(`No job handler for ${key(context.queue, context.name)}`);
    }
    return handler(payload, context);
  }
}
