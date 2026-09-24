import {
  DefaultLavajetConfig,
  Environment as Env,
  LavajetConfig,
} from "@bagacito/lavajet-toolkit";
import type { AccumulatedEnvironment } from "@decaf-ts/logging";
import { VERSION } from "../version";
import {
  FileContentFilter,
  PasswordFilter,
} from "./logging";
import { LoggingConfig } from "@decaf-ts/logging";

export type NestConfig = LavajetConfig &
  LoggingConfig & {
    lavajet: LavajetConfig["lavajet"] & {
      port?: number | string;
    };
    throttling: {
      enabled: boolean;
      defaultTtlMs: number;
      defaultLimit: number;
    };
    cors: {
      enabled: boolean;
      origins: string;
      verbs: string;
      headers: string;
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
    limits: {
      bodyParserJson: string;
      bodyParserUrlencoded: string;
    };
    verifyToken: string;
    verifyUrl: string;
    scans: {
      allowMissingBatch: boolean;
    };
    mode: string;
    automaticContractUpdate: boolean;
    versionWhiteList: string;
    versionWhiteListSeperator: string;
    resolver: {
      cronTime: {
        long: string;
        short: string;
      };
    };
  };

export const DefaultNestConfig: NestConfig = Object.assign(
  {},
  DefaultLavajetConfig,
  {
    filters: [
      new PasswordFilter(),
      new FileContentFilter(),
    ],
  },
  {
    throttling: {
      enabled: true,
      defaultTtlMs: 60000,
      defaultLimit: 100,
      publicTtlMs: 60000,
      publicLimit: 20,
    },
    cors: {
      enabled: true,
      origins: "*",
      verbs: "POST,GET,PUT,DELETE,OPTIONS",
      headers:
        "Authorization,Content-Type,Cache-Control,Pragma,X-Requested-With,x-auth-request-access-token,x-forwarded-access-token,x-correlation-id,x-pending-task",
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
    limits: {
      bodyParserJson: "30mb",
      bodyParserUrlencoded: "5mb",
    },
    verifyToken: "",
    verifyUrl: "",
    scans: {
      allowMissingBatch: false,
    },
    mode: "",
    automaticContractUpdate: false,
    versionWhiteList: "api|api-json",
    versionWhiteListSeperator: "|",
    resolver: {
      cronTime: {
        long: "0 */20 * * * *",
        short: "0 */10 * * * *",
      },
    },
  }
);

export const Environment: AccumulatedEnvironment<NestConfig> = Env.accumulate(
  DefaultNestConfig
) as unknown as AccumulatedEnvironment<NestConfig>;
