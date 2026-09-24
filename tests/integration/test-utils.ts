import { Buffer } from "buffer";
import http from "http";
import https from "https";
import { Environment } from "@bagacito/lavajet-toolkit";

type KeycloakLoginOptions = {
  host?: string;
  protocol?: string;
  realm?: string;
  clientId?: string;
  clientSecret?: string;
  identityProviderAlias?: string;
};

export type KeycloakCredentials = {
  username: string;
  password: string;
};

export type KeycloakTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
};

const DEFAULT_SCOPE = "openid";

const ensureValue = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Missing Keycloak configuration value: ${name}`);
  }

  return value;
};

export async function loginToKeycloakWithAzureSSO(
  credentials: KeycloakCredentials,
  overrides: Partial<KeycloakLoginOptions> = {}
): Promise<KeycloakTokenResponse> {
  const host = ensureValue(
    "KEYCLOAK__HOST",
    overrides.host ?? process.env.KEYCLOAK__HOST
  );
  const protocol =
    overrides.protocol ??
    process.env.KEYCLOAK__HOST_PROTOCOL ??
    process.env.KEYCLOAK__HOST_URL_PROTOCOL ??
    "http";
  const realm = ensureValue(
    "KEYCLOAK__REALM",
    overrides.realm ?? process.env.KEYCLOAK__REALM
  );
  const clientId = ensureValue(
    "KEYCLOAK__CLIENT_ID",
    overrides.clientId ?? process.env.KEYCLOAK__CLIENT_ID
  );
  const clientSecret =
    overrides.clientSecret ?? process.env.KEYCLOAK__CLIENT_SECRET;
  const identityProviderAlias =
    overrides.identityProviderAlias ??
    process.env.KEYCLOAK__IDENTITY_PROVIDER_ALIAS;

  const tokenEndpoint = `${protocol}://${host.replace(/\/+$/, "")}/realms/${realm}/protocol/openid-connect/token`;

  const params = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    username: credentials.username,
    password: credentials.password,
    scope: DEFAULT_SCOPE,
  });

  if (clientSecret) {
    params.append("client_secret", clientSecret);
  }

  if (identityProviderAlias) {
    params.append("kc_idp_hint", identityProviderAlias);
  }

  const response = await postForm(tokenEndpoint, params);

  if (response.status >= 400) {
    throw new Error(
      `Failed to obtain Keycloak token (${response.status}): ${response.body}`
    );
  }

  const payload = JSON.parse(response.body);

  if (!payload.access_token) {
    throw new Error(
      `Keycloak token response did not include access_token: ${response.body}`
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    idToken: payload.id_token,
    expiresIn: payload.expires_in,
    tokenType: payload.token_type,
    scope: payload.scope,
  };
}

async function postForm(
  urlString: string,
  params: URLSearchParams
): Promise<{ status: number; body: string }> {
  const url = new URL(urlString);
  const transport = url.protocol === "https:" ? https : http;
  const body = params.toString();

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": Buffer.byteLength(body),
          accept: "application/json",
        },
        rejectUnauthorized: Environment.env === "production",
      },
      (res) => {
        let data = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: data,
          });
        });
      }
    );

    req.on("error", reject);
    req.end(body);
  });
}
