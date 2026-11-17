import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.use(helmet());

  const allowedOrigins = configService
    .get<string>('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HadiMed API')
    .setDescription(
      'REST API documentation for the HadiMed medical appointment platform.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0');

  console.log(`HadiMed API running on port ${port}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
  console.log(`Health: http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start HadiMed API:', error);
  process.exitCode = 1;
});