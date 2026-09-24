import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "path";
import { loginToKeycloakWithAzureSSO } from "./test-utils";

const envPublicFile = path.join(__dirname, "../../../.env.local");
const envPrivateFile = path.join(__dirname, "../../../.env.secret");
const envSsoFile = path.join(__dirname, "../../../.env.sso");
const env = dotenv.config({
  path: [envSsoFile, envPrivateFile, envPublicFile],
});
dotenvExpand.expand(env);

// Load the environment wrapper only after dotenv has populated process.env.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Environment } = require("./environment");
const testEnv = Environment;
const protocol = testEnv.orThrow().lavajet.protocol;
const envHost = testEnv.orThrow().lavajet.host;

export const host =
  envHost && envHost.startsWith("http")
    ? envHost
    : envHost
      ? `${protocol}://${envHost}`
      : "";

export async function authenticate(): Promise<string> {
  const response = await loginToKeycloakWithAzureSSO(
    {
      username: "test-user",
      password: "test123",
    },
    {
      host: "keycloak.lavajet.internal",
      protocol: "https",
      realm: "bagacito",
      clientId: Environment.keycloak.clientId,
      clientSecret: Environment.keycloak.clientSecret,
      identityProviderAlias: `pdm OAuth`,
    }
  );

  return response.accessToken;
}
