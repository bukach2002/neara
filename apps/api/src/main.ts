import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('WEB_APP_URL', 'http://localhost:3000'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const openApi = new DocumentBuilder()
    .setTitle('Neara API')
    .setDescription('Multi-tenant appointment booking platform API')
    .setVersion('0.1.0')
    .addCookieAuth('neara.sid')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, openApi));

  await app.listen(config.get<number>('API_PORT', 4000));
}

void bootstrap();
