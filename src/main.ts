/**
 * @module ew-backend
 * @description This is the main entry point for the ew-backend application.
 * @summary It initializes the NestJS application, configures middleware, and starts the server.
 * @category Application
 */

import "@decaf-ts/decoration";
import "@decaf-ts/logging";
import "@decaf-ts/decorator-validation";
import "@decaf-ts/db-decorators";
import "@decaf-ts/injectable-decorators";
import "@decaf-ts/transactional-decorators";
import "@decaf-ts/core";
import "@decaf-ts/for-couchdb";
import "@decaf-ts/for-fabric";
import "@decaf-ts/for-nano";
import "@decaf-ts/for-typeorm";
import "@bagacito/lavajet-toolkit";
import { NestBootstraper } from "@decaf-ts/for-nest";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Environment } from "./utils/environment";
import { configureEwLogging } from "./utils/logging";

import path from "node:path";
import * as bodyParser from "body-parser";
import { ArrayNoContentInterceptor } from "./handlers/ArrayNoContent.interceptor";
import { VERSION } from "./version";
import { type CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { VersioningType } from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

const whiteListSeperator = Environment.orThrow().versionWhiteListSeperator;

const whiteList =
  Environment.orThrow().versionWhiteList.split(whiteListSeperator);

function isDocumentationPath(path: string) {
  return whiteList.some(
    (endpoint) => path === `/${endpoint}` || path.startsWith(`/${endpoint}/`)
  );
}
(async () => {
  configureEwLogging();
  const app = await NestFactory.create(AppModule);

  app.use(
    bodyParser.json({ limit: Environment.orThrow().limits.bodyParserJson })
  );
  app.use(
    bodyParser.urlencoded({
      limit: Environment.orThrow().limits.bodyParserUrlencoded,
      extended: true,
    })
  );

  const useSwagger = Environment.orThrow().swagger.enabled;
  const origins = Environment.orThrow().cors.origins;
  const allowedOrigins =
    typeof origins === "string" &&
    Environment.cors.origins.trim() !== "" &&
    Environment.cors.origins.trim() !== "*"
      ? Environment.cors.origins.split(",").map((o) => o.trim())
      : "*";

  const verbs = Environment.orThrow().cors.verbs;
  const corsVerbs = (typeof verbs === "string" &&
    verbs.split(",").map((v) => v.trim().toUpperCase())) || [
    "POST",
    "GET",
    "PUT",
    "DELETE",
    "OPTIONS",
  ];

  const corsHeadersEnv = Environment.orThrow().cors.headers;
  const corsHeaders = (typeof corsHeadersEnv === "string" &&
    corsHeadersEnv
      .split(",")
      .map((header) => header.trim())
      .filter((header) => header.length > 0)) || [
    "Authorization",
    "Content-Type",
    "Cache-Control",
  ];

  const normalizedOrigins = Array.isArray(allowedOrigins)
    ? allowedOrigins.map((origin) => origin.toLowerCase())
    : allowedOrigins;

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        normalizedOrigins === "*" ||
        (Array.isArray(normalizedOrigins) &&
          normalizedOrigins.includes(origin.toLowerCase()))
      ) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: corsVerbs.join(","),
    allowedHeaders: corsHeaders,
  };

  app.enableCors(corsOptions);
  app.use((request: Request, _response: Response, next: NextFunction) => {
    const path = request.url.split("?")[0];
    const isVersionedPath = /^\/v\d+(\/|$)/.test(path);

    if (!isVersionedPath && !isDocumentationPath(path) && path !== "/") {
      request.url = `/v1${request.url}`;
    }

    next();
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  const assetsPath =
    Environment.orThrow().swagger.assetsPath || "../workdocs/assets";

  let nest = await NestBootstraper.initialize(app as any)
    .useHelmet()
    .useGlobalFilters()
    .useGlobalInterceptors(new ArrayNoContentInterceptor());
  if (useSwagger)
    nest = nest.setupSwagger({
      title: Environment.orThrow().swagger.title,
      description: Environment.orThrow().swagger.description,
      version: VERSION,
      path: "api",
      openApiJsonPath: "api-json",
      assetsPath: path.join(__dirname, assetsPath),
      faviconPath: Environment.orThrow().swagger.faviconPath,
      topbarIconPath: Environment.orThrow().swagger.topbarIconPath,
      topbarBgColor: Environment.orThrow().swagger.topbarBgColor,
    });

  nest.start(
    process.env.LOCAL_NEST_PORT ? parseInt(process.env.LOCAL_NEST_PORT) : 3000,
    "0.0.0.0"
  );
})();
