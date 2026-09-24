import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "path";
import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

const envPublicFile = path.join(__dirname, "../../../.env.local");
const envPrivateFile = path.join(__dirname, "../../../.env.secret");
const envSsoFile = path.join(__dirname, "../../../.env.sso");
const env = dotenv.config({
  path: [envSsoFile, envPrivateFile, envPublicFile],
});
dotenvExpand.expand(env);

let applicationInstance: INestApplication | null = null;
let AppModule: any;

/**
 * Boots ew-backend through the AppModule entry point.
 */
export async function getApp(): Promise<INestApplication> {
  if (!applicationInstance) {
    if (!AppModule) {
      AppModule = require("../../src/app.module").AppModule;
    }
    applicationInstance = await NestFactory.create(AppModule, {
      logger: process.env.NODE_ENV === "test" ? false : undefined,
    });

    process.env = { ...process.env };

    await applicationInstance.init();
  }

  return applicationInstance;
}

export async function closeApp(): Promise<void> {
  if (applicationInstance) {
    await applicationInstance.close();
    applicationInstance = null;
  }
}
