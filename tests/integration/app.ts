import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule as AppPlaModule } from "../../src/app-pla.module";

let applicationInstance: INestApplication | null = null;

/**
 * Boots the real application the same way the Nest entry point does.
 * Adjust this logic (mock out modules, override providers, etc.) if you want
 * faster or isolated integration tests.
 */
export async function getApp(): Promise<INestApplication> {
  if (!applicationInstance) {
    applicationInstance = await NestFactory.create(AppPlaModule, {
      logger: process.env.NODE_ENV === "test" ? false : undefined,
    });

    // Ensure the app uses the current process environment
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
