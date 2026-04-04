import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', { exclude: ['sub/:token'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.enableCors({ origin: true, credentials: true });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`HydraFlow Panel API running on port ${port}`);
}
bootstrap();
