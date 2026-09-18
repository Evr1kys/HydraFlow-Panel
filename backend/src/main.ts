import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

function allowedOrigins(): string[] {
  const configured = process.env['CORS_ORIGIN']
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('CORS_ORIGIN is required in production');
  }
  return ['http://localhost:3000', 'http://localhost:5173'];
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const production = process.env['NODE_ENV'] === 'production';
  const swaggerEnabled = process.env['SWAGGER_ENABLED'] === 'true' || !production;

  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: allowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HydraFlow Panel API')
      .setDescription('HydraFlow Panel API')
      .setVersion('2.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT from /api/auth/login',
        },
        'default',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: false,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'HydraFlow API Docs',
    });
  }

  const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }

  await app.listen(port, '0.0.0.0');
  console.log(`HydraFlow Panel backend running on port ${port}`);
  if (swaggerEnabled) {
    console.log(`API docs enabled at /api/docs`);
  }
}

bootstrap().catch((error: unknown) => {
  console.error('HydraFlow Panel failed to start', error);
  process.exit(1);
});
