import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  /** S3-compatible endpoint; MinIO locally. Unset = AWS S3. */
  endpoint?: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  /** MinIO and most self-hosted S3 need path-style URLs. */
  forcePathStyle: boolean;
  /** Lifetime of signed download URLs, in seconds. */
  signedUrlTtl: number;
  /** Hard upper bound for any upload; each purpose can set a lower one. */
  uploadMaxBytes: number;
}

export default registerAs('storage', (): StorageConfig => ({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION ?? 'us-east-1',
  bucket: process.env.S3_BUCKET ?? 'school-erp',
  accessKey: process.env.S3_ACCESS_KEY ?? '',
  secretKey: process.env.S3_SECRET_KEY ?? '',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  signedUrlTtl: parseInt(process.env.S3_SIGNED_URL_TTL ?? '300', 10),
  uploadMaxBytes: parseInt(
    process.env.UPLOAD_MAX_BYTES ?? String(10 * 1024 * 1024),
    10,
  ),
}));
