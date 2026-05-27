import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SwaggerConfig } from './swagger.config';

export function setupSwagger(app: INestApplication): SwaggerConfig | null {
  const cfg = app.get(ConfigService).get<SwaggerConfig>('swagger');
  if (!cfg?.enabled) return null;

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(cfg.title)
      .setDescription(cfg.description)
      .setVersion(cfg.version)
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'platform-jwt',
      )
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'tenant-jwt',
      )
      .addApiKey(
        { type: 'apiKey', in: 'header', name: 'x-tenant-id' },
        'x-tenant-id',
      )
      .build(),
  );

  SwaggerModule.setup(cfg.path, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  return cfg;
}
