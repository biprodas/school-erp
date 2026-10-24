import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageConfig } from '~/config';

/**
 * S3-compatible object storage (MinIO locally). Objects are private; clients
 * download through short-lived signed URLs that a feature module hands out
 * after its own permission check. Keys look like `orgs/<orgId>/<kind>/<id>`.
 */
@Injectable()
export class StorageService implements OnApplicationShutdown {
  private readonly client: S3Client;
  private readonly cfg: StorageConfig;

  constructor(config: ConfigService) {
    this.cfg = config.get<StorageConfig>('storage')!;
    this.client = new S3Client({
      endpoint: this.cfg.endpoint,
      region: this.cfg.region,
      forcePathStyle: this.cfg.forcePathStyle,
      credentials: this.cfg.accessKey
        ? {
            accessKeyId: this.cfg.accessKey,
            secretAccessKey: this.cfg.secretKey,
          }
        : undefined,
    });
  }

  static orgKey(orgId: string, kind: string, id: string): string {
    return `orgs/${orgId}/${kind}/${id}`;
  }

  async put(
    key: string,
    body: Buffer,
    contentType: string,
    downloadName?: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentDisposition: downloadName
          ? contentDisposition(downloadName)
          : undefined,
      }),
    );
  }

  /** Signed GET URL; default lifetime from `S3_SIGNED_URL_TTL`. */
  getSignedUrl(
    key: string,
    ttlSeconds = this.cfg.signedUrlTtl,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
    );
  }

  /** Throws when the bucket can't be reached (`/health`). */
  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.cfg.bucket }));
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }
}

/** RFC 6266 attachment header with an ASCII fallback for older clients. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
