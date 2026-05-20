import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AppConfig, SwaggerConfig } from './config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      skipUndefinedProperties: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      enableImplicitConversion: true,
    }),
  );

  app.use(helmet());

  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });
  app.use(RequestIdMiddleware);

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app');
  if (!appConfig) {
    throw new Error('App config not found');
  }

  const swaggerCfg = configService.get<SwaggerConfig>('swagger');
  if (swaggerCfg?.enabled) {
    const builder = new DocumentBuilder()
      .setTitle(swaggerCfg.title)
      .setDescription(swaggerCfg.description)
      .setVersion(swaggerCfg.version)
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
      );

    const document = SwaggerModule.createDocument(app, builder.build());
    SwaggerModule.setup(swaggerCfg.path, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(appConfig.port);

  console.log(
    `🚀 Multi-tenant SaaS application running on http://${appConfig.host}:${appConfig.port}`,
  );
  console.log(`📊 Architecture: Schema-per-tenant (Cost-effective)`);
  if (swaggerCfg?.enabled) {
    console.log(
      `📚 Swagger docs available at http://${appConfig.host}:${appConfig.port}/${swaggerCfg.path}`,
    );
  }
}

bootstrap();
