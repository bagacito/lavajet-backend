import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "path";
import jestOpenAPI from "jest-openapi";
import axios, { AxiosResponse } from "axios";
import {
  Account,
  AccountType,
  KeycloakClientConfig,
  KeycloakClientRoleConfig,
  KeycloakIdentityProviderConfig,
  KeycloakSetupConfig,
  KeycloakUser,
  KibanaSetupConfig,
} from "@bagacito/lavajet-toolkit";
import { loginToKeycloakWithAzureSSO } from "./test-utils";
import { Environment } from "./environment";

const envPublicFile = path.join(__dirname, "../../../.env.local");
const envPrivateFile = path.join(__dirname, "../../../.env.secret");
const env = dotenv.config({ path: [envPublicFile, envPrivateFile] });
dotenvExpand.expand(env);

jestOpenAPI(
  path.join(__dirname, "../../@bagacito/lavajet-backend.json")
);

const testEnv = Environment;
const protocol = testEnv.orThrow().lavajet.protocol;
const envHost = testEnv.orThrow().lavajet.host;
const host =
  envHost && envHost.startsWith("http")
    ? envHost
    : envHost
      ? `${protocol}://${envHost}`
      : "";

let token = "";
const keycloakRealm = Environment.keycloak?.realm ?? "bagacito";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${token}`,
});

const buildKeycloakUser = (suffix: string) =>
  new KeycloakUser({
    realm: keycloakRealm,
    username: `kc-user-${suffix}`,
    password: "Test123!@#",
  });

const buildKeycloakClientConfig = (suffix: string) =>
  new KeycloakClientConfig({
    clientId: `client-${suffix}`,
    secret: "client-secret",
    redirectUris: ["https://localhost"],
    roles: [
      new KeycloakClientRoleConfig({
        roleName: "manage-account",
        claimValue: "manage-account",
        description: "Manages accounts",
      }),
    ],
  });

const buildKeycloakSetupConfig = (suffix: string) =>
  new KeycloakSetupConfig({
    id: `kc-${suffix}`,
    host: "keycloak.lavajet.internal",
    protocol: "https",
    adminApiUser: buildKeycloakUser(suffix),
    realmApiUser: buildKeycloakUser(`realm-${suffix}`),
    client: buildKeycloakClientConfig(suffix),
    identityProvider: new KeycloakIdentityProviderConfig({
      alias: "azure",
      displayName: "Azure",
      tenantId: "azure-tenant",
      clientId: "identity-client",
      clientSecret: "identity-secret",
      mapperClaimName: "groups",
    }),
  });

const buildAccountPayload = (overrides: Partial<Account> = {}): Account => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return new Account({
    id: overrides.id ?? `account-${suffix}`,
    mspId: overrides.mspId ?? `msp-${suffix}`,
    classification: overrides.classification ?? AccountType.MAH,
    token: overrides.token ?? `token-${suffix}`,
    onPrem: overrides.onPrem ?? true,
    claimed: overrides.claimed ?? false,
    endpoint: overrides.endpoint ?? `https://account-${suffix}.lavajet.internal`,
    keycloakSetupConfig:
      overrides.keycloakSetupConfig ?? buildKeycloakSetupConfig(suffix),
    kibanaSetupConfig:
      overrides.kibanaSetupConfig ??
      new KibanaSetupConfig({
        id: `kibana-${suffix}`,
        realm: keycloakRealm,
        host: "kibana.lavajet.internal",
        protocol: "https",
      }),
    ...overrides,
  });
};

describe("Account API", () => {
  const basePath = "/account";
  let created: Account;
  let bulkAccounts: Account[] = [];
  let bulkIds: string[] = [];
  let response: AxiosResponse;
  const skipCreateTags = ["bulk", "logs in"];

  const requestAccounts = [buildAccountPayload(), buildAccountPayload()];

  const createAccount = async () => {
    const response = await axios.post(
      `${host}${basePath}`,
      buildAccountPayload(),
      {
        headers: getAuthHeaders(),
      }
    );
    expect(response?.status).toBe(201);
    created = new Account(response.data);
    return response;
  };

  const createBulkAccounts = async () => {
    const response = await axios.post(
      `${host}${basePath}/bulk`,
      requestAccounts,
      {
        headers: getAuthHeaders(),
      }
    );

    expect(response?.status).toBe(201);
    bulkAccounts = response?.data?.map(
      (account: Account) => new Account(account)
    );
    bulkIds = bulkAccounts?.map((account) => account.id) as string[];
    return { bulkAccounts, bulkIds, response };
  };

  beforeAll(async () => {
    // Setup phase - add any initialization if needed
  });

  beforeEach(async () => {
    const loginResponse = await loginToKeycloakWithAzureSSO(
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
    token = loginResponse.accessToken;

    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createAccount();
  });

  it("logs in", async () => {
    expect(token).toBeDefined();
  });

  it(`POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    expect(created.hasErrors()).toBeUndefined();
    expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.id}`,
      {
        headers: getAuthHeaders(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedAccount = new Account(persistedResponse.data);
    expect(persistedAccount).toEqual(created);

    // attempting to recreate an account with existing id should result to 409
    await expect(
      axios.post(`${host}${basePath}`, persistedAccount, {
        headers: getAuthHeaders(),
      })
    ).rejects.toThrow(/409/);
  });

  it(`GET ${basePath}/{id}`, async () => {
    const response = await axios.get(`${host}${basePath}/${created.id}`, {
      headers: getAuthHeaders(),
    });
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();

    await expect(
      axios.get(`${host}${basePath}/nonexistent-id`, {
        headers: getAuthHeaders(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`PUT ${basePath}/{id}`, async () => {
    const newAccount = new Account(
      Object.assign({}, created, {
        token: `${created.token}-updated`,
        endpoint: `${created.endpoint}/updated`,
      })
    );
    const response = await axios.put(
      `${host}${basePath}/${created.id}`,
      newAccount,
      {
        headers: getAuthHeaders(),
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.token).toBe(`${created.token}-updated`);
    const updated = new Account(response.data);
    expect(updated.equals(created)).toBe(false);
    expect(updated.equals(newAccount, "updatedAt", "version")).toBe(true);
    expect(
      updated.equals(
        created,
        "version",
        "updatedAt",
        "updatedBy",
        "token",
        "endpoint"
      )
    ).toBe(true);

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.id}`,
      {
        headers: getAuthHeaders(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedAccount = new Account(persistedResponse.data);
    expect(persistedAccount).toEqual(updated);

    await expect(
      axios.put(`${host}${basePath}/nonexistent-id`, newAccount, {
        headers: getAuthHeaders(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it.skip(`DELETE ${basePath}/{id}`, async () => {
    if (!created) await createAccount();
    const response = await axios.delete(`${host}${basePath}/${created.id}`, {
      headers: getAuthHeaders(),
    });
    expect(response.status).toBe(200);

    await expect(
      axios.delete(`${host}${basePath}/${created.id}`, {
        headers: getAuthHeaders(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkAccounts?.length)
        ({ bulkAccounts, bulkIds, response } = await createBulkAccounts());
    });

    it(`POST ${basePath}/bulk`, async () => {
      expect(response.status).toBe(201);
      expect(bulkAccounts.length).toBe(requestAccounts.length);
      expect(bulkAccounts.every((a) => a.hasErrors() === undefined)).toBe(true);
      expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/bulk`, async () => {
      const response = await axios.get(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        {
          headers: getAuthHeaders(),
        }
      );

      expect(response.status).toBe(200);
      expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`PUT ${basePath}/bulk`, async () => {
      const updates = bulkAccounts.map(
        (existing) =>
          new Account({
            ...existing,
            token: `${existing.token}-bulk`,
          })
      );

      const response = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        updates,
        {
          headers: getAuthHeaders(),
        }
      );

      expect(response.status).toBe(200);
      const updated = response.data.map((data: any) => new Account(data));

      updated.every((a: Account, i: number) => {
        expect(a).not.toEqual(bulkAccounts[i]);
        expect(a.token).toBe(bulkAccounts[i].token + "-bulk");
      });
      updated.every((a: Account, i: number) => {
        expect(a.equals(bulkAccounts[i])).toBe(false);
        expect(a.equals(bulkAccounts[i], "version", "updatedAt", "token")).toBe(
          true
        );
      });
      expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it.skip(`DELETE ${basePath}/bulk`, async () => {
      const response = await axios.delete(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        {
          headers: getAuthHeaders(),
        }
      );
      expect(response.status).toBe(200);
      expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  describe("Search and Pagination", () => {
    it(`GET ${basePath}/listBy/{key}?direction=asc`, async () => {
      const key = "mspId";
      const response = await axios.get(
        `${host}${basePath}/listBy/${key}?direction=asc`,
        {
          headers: getAuthHeaders(),
        }
      );

      expect(response.status).toBe(200);
      const accounts = response.data.map((data: any) => new Account(data));
      accounts.every((account: Account) =>
        expect(account).toBeInstanceOf(Account)
      );
      expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      const key = "mspId";
      const value = encodeURIComponent(created.mspId);
      const response = await axios.get(
        `${host}${basePath}/findBy/${key}/${value}?direction=asc`,
        {
          headers: getAuthHeaders(),
        }
      );

      expect(response.status).toBe(200);
      const accounts = response.data.map((data: any) => new Account(data));
      accounts.every((account: Account) =>
        expect(account).toBeInstanceOf(Account)
      );
      expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}/{page}`, async () => {
      // Ensure accounts exist in db
      if (!bulkAccounts?.length) await createBulkAccounts();
      const key = "id";
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=0`,
        {
          headers: getAuthHeaders(),
        }
      );

      expect(response.status).toBe(200);
      const accounts = response.data.data.map((data: any) => new Account(data));
      expect(accounts.length >= 1 && accounts.length <= 5).toBe(true);
      accounts.every((account: Account) =>
        expect(account).toBeInstanceOf(Account)
      );
      expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/{method=listBy}/{args}`, async () => {
    // Ensure accounts exist in db
    if (!bulkAccounts?.length) await createBulkAccounts();
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/mspId?offset=0&limit=5&direction=asc`,
      {
        headers: getAuthHeaders(),
      }
    );
    expect(response.status).toBe(200);
    const accounts = response.data.map((data: any) => new Account(data));
    accounts.every((account: Account) =>
      expect(account).toBeInstanceOf(Account)
    );
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/{method=paginateBy}/{args}`, async () => {
    // Ensure accounts exist in db
    if (!bulkAccounts?.length) await createBulkAccounts();
    const key = "mspId";
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/${key}?direction=asc&limit=5&offset=0`,
      {
        headers: getAuthHeaders(),
      }
    );

    expect(response.status).toBe(200);
    const accounts = response.data.data.map((data: any) => new Account(data));
    accounts.every((account: Account) =>
      expect(account).toBeInstanceOf(Account)
    );
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
