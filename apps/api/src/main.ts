import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppModule } from './modules/app.module';
import { HttpExceptionFilter } from './modules/observability/http-exception.filter';
import { ObservabilityService } from './modules/observability/observability.service';
import { StructuredLoggerService } from './modules/observability/structured-logger.service';

function normalizedOrigin(value: string) {
  return value.trim().replace(/\/$/, '');
}

function allowedCorsOrigins(config: ConfigService) {
  const webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:3000');
  const extraOrigins = config.get<string>('CORS_ALLOWED_ORIGINS', '');
  return [webAppUrl, ...extraOrigins.split(',')]
    .map((origin) => normalizedOrigin(origin))
    .filter(Boolean);
}

async function createApp() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = app.get(StructuredLoggerService);
  app.useLogger(logger);

  app.setGlobalPrefix('api');
  const allowedOrigins = allowedCorsOrigins(config);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(normalizedOrigin(origin))) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-request-id', 'authorization'],
    exposedHeaders: ['x-request-id'],
    optionsSuccessStatus: 204,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(app.get(ObservabilityService)));

  const openApi = new DocumentBuilder()
    .setTitle('Neara API')
    .setDescription('Multi-tenant appointment booking platform API')
    .setVersion('0.1.0')
    .addCookieAuth('neara.sid')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, openApi));

  return { app, config, logger };
}

async function bootstrap() {
  const { app, config, logger } = await createApp();
  const port = config.get<number>('API_PORT', 4000);
  await app.listen(port);
  logger.event('info', 'api.started', `Neara API listening on ${port}`, { port });
}

let server: ((request: Request, response: Response) => void) | undefined;

async function handler(request: Request, response: Response) {
  let requestHandler = server;
  if (!requestHandler) {
    const { app } = await createApp();
    await app.init();
    requestHandler = app.getHttpAdapter().getInstance() as (request: Request, response: Response) => void;
    server = requestHandler;
  }

  return requestHandler(request, response);
}

export { handler };
export default handler;

module.exports = handler;
module.exports.default = handler;
module.exports.handler = handler;

if (require.main === module) {
  void bootstrap();
}
