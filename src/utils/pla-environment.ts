import {
  AdminLavajetConfig,
  DefaultAdminLavajetConfig,
  AdminEnvironment,
} from "@bagacito/lavajet-toolkit";
import { LoggingConfig } from "@decaf-ts/logging";
import type { AccumulatedEnvironment } from "@decaf-ts/logging";
import { VERSION } from "../version";

export type NestConfig = AdminLavajetConfig &
  LoggingConfig & {
  cors: {
    enabled: boolean;
    origins: string;
    verbs: string;
  };
  jwt: {
    secretKey: string;
    expiry: string;
  };
  swagger: {
    enabled: boolean;
    title: string;
    description: string;
    assetsPath: string;
    faviconPath: string;
    topbarIconPath: string;
    topbarBgColor: string;
  };
};

export const DefaultNestConfig: NestConfig = Object.assign(
  {},
  DefaultAdminLavajetConfig,
  {
    cors: {
      enabled: true,
      origins: "*",
      verbs: "POST,GET,PUT,DELETE,OPTIONS",
    },
    jwt: {
      secretKey: "",
      expiry: "5m",
    },
    swagger: {
      enabled: true,
      title: "Lavajet API",
      description:
        "Secure and scalable digital connection for product information.",
      version: VERSION,
      assetsPath: "../workdocs/assets",
      faviconPath: "Icon.png",
      topbarIconPath: "Banner.png",
      topbarBgColor: "#102c58",
    },
  }
);

export const PlaEnvironment: AccumulatedEnvironment<NestConfig> =
  AdminEnvironment.accumulate(DefaultNestConfig);
