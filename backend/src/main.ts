import { requestLogging, SafeExceptionFilter } from './logging/request-logging';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const started = performance.now();
  const app = await NestFactory.create(AppModule, { logger: process.env.LOG_LEVEL === 'debug' ? ['log', 'warn', 'error', 'debug'] : ['log', 'warn', 'error'] });

  app.use(requestLogging);
  app.useGlobalFilters(new SafeExceptionFilter(app.getHttpAdapter()));

  const config = app.get(ConfigService);
  const PORT = config.get("PORT") ?? 3000

  app.enableCors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  exposedHeaders: ['X-Request-ID'],
});

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }))

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(PORT);

  Logger.log(`request_id=- service=backend backend.started operation=startup status=completed duration_ms=${Math.floor(performance.now() - started)} port=${Number(PORT) || 3000}`, 'Bootstrap');

}
bootstrap();
