import {
  AdminEnvironment,
  AdminLavajetConfig,
} from "@bagacito/lavajet-toolkit";

export type EwTestConfig = AdminLavajetConfig & {
  evaluateSpec: boolean;
};

const defaultConfig: EwTestConfig = {
  evaluateSpec: false,
} as EwTestConfig;

export const Environment = AdminEnvironment.accumulate(defaultConfig);
