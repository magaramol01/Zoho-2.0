import "reflect-metadata";
import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AppConfigService } from "./common/env";

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(AppConfigService);

  app.use(cookieParser());
  app.enableCors({
    origin: config.appUrl,
    credentials: true,
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${config.port}/api`);
};

bootstrap();
