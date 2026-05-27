import { registerAs } from '@nestjs/config';

const healthConfig = registerAs('health', () => ({
  diskPath: process.env.HEALTH_DISK_PATH ?? '/',
  diskThreshold: parseFloat(process.env.HEALTH_DISK_THRESHOLD ?? '0.9'),
  memoryHeapBytes: parseInt(
    process.env.HEALTH_MEMORY_HEAP_BYTES ?? `${300 * 1024 * 1024}`,
    10,
  ),
  memoryRssBytes: parseInt(
    process.env.HEALTH_MEMORY_RSS_BYTES ?? `${500 * 1024 * 1024}`,
    10,
  ),
}));

export type HealthConfig = ReturnType<typeof healthConfig>;
export default healthConfig;
