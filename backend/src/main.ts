import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
  // CSP is disabled here because the app serves Swagger UI; tune as needed.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Restrict CORS to the frontend origin(s) configured via env.
  // CSRF is NOT required because this API only accepts JWT Bearer tokens
  // in the Authorization header — there are no auth cookies to forge.
  // If a list of origins is provided (comma-separated), all are allowed.
  const corsOriginEnv = process.env['CORS_ORIGIN'];
  const allowedOrigins = corsOriginEnv
    ? corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:5173'];

  app.enableCors({
    origin: allowedOrigins,
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

  // Swagger / OpenAPI setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HydraFlow Panel API')
    .setDescription('Anti-censorship proxy management panel API')
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token from /api/auth/login',
      },
      'default',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'HydraFlow API Docs',
  });

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  console.log(`HydraFlow Panel backend running on port ${port}`);
  console.log(`API docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
