import path from "path";
import axios, { AxiosResponse } from "axios";
import jestOpenAPI from "jest-openapi";
import { KeycloakSetupConfig } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildKeycloakConfigPayload } from "./payload-builders";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Keycloak Config API", () => {
  const basePath = "/keycloak-config";
  let token = "";
  let created: KeycloakSetupConfig;
  let createdRaw: any;
  let bulkConfigs: KeycloakSetupConfig[] = [];
  let bulkIds: string[] = [];
  let response: AxiosResponse;
  const skipCreateTags = ["bulk", "logs in"];

  const headers = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    // no shared services for this entity at the moment
  });

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createConfig();
  });

  const createConfig = async () => {
    const payload = buildKeycloakConfigPayload();
    const resp = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(resp.status).toBe(201);
    created = new KeycloakSetupConfig(resp.data);
    createdRaw = resp.data;
    expect(created.hasErrors()).toBeUndefined();
    return resp;
  };

  const createBulkConfigs = async () => {
    const payload = [
      buildKeycloakConfigPayload(),
      buildKeycloakConfigPayload(),
    ];
    const resp = await axios.post(`${host}${basePath}/bulk`, payload, {
      headers: headers(),
    });
    expect(resp.status).toBe(201);
    bulkConfigs = resp.data.map((item: any) => new KeycloakSetupConfig(item));
    bulkIds = bulkConfigs.map((cfg) => cfg.id);
    return { bulkConfigs, bulkIds, response: resp };
  };

  it("logs in", async () => {
    expect(token).toBeDefined();
  });

  it(`POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    expect(created.hasErrors()).toBeUndefined();
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    // verify it can be retrieved explicitly
    const persisted = await axios.get(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(persisted.status).toBe(200);
    const persistedCfg = new KeycloakSetupConfig(persisted.data);
    expect(persistedCfg).toEqual(created);

    // invalid payload should fail validation
    const invalid = new KeycloakSetupConfig({ ...created, host: "" });
    expect(invalid.hasErrors()).toBeDefined();
    await expect(
      axios.post(`${host}${basePath}`, invalid, { headers: headers() })
    ).rejects.toThrow(/422/);

    // duplicate creation should return 409
    await expect(
      axios.post(`${host}${basePath}`, created, { headers: headers() })
    ).rejects.toThrow(/409/);
  });

  it(`GET ${basePath}/{id}`, async () => {
    const response = await axios.get(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    await expect(
      axios.get(`${host}${basePath}/nonexistent`, { headers: headers() })
    ).rejects.toThrow(/404/);
  });

  it(`PUT ${basePath}/{id}`, async () => {
    const updatedConfig = new KeycloakSetupConfig({
      ...createdRaw,
      host: `${created.host}-updated`,
    });
    const response = await axios.put(
      `${host}${basePath}/${created.id}`,
      updatedConfig,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    expect(response.data.host).toBe(`${created.host}-updated`);

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.id}`,
      { headers: headers() }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedConfig = new KeycloakSetupConfig(persistedResponse.data);
    expect(persistedConfig.host).toBe(updatedConfig.host);

    await expect(
      axios.put(`${host}${basePath}/nonexistent`, updatedConfig, {
        headers: headers(),
      })
    ).rejects.toThrow(/404/);
  });

  it(`DELETE ${basePath}/{id}`, async () => {
    const response = await axios.delete(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);

    await expect(
      axios.delete(`${host}${basePath}/${created.id}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/404/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkConfigs?.length) {
        ({ bulkConfigs, bulkIds, response } = await createBulkConfigs());
      }
    });

    it(`POST ${basePath}/bulk`, async () => {
      ({ bulkConfigs, bulkIds, response } = await createBulkConfigs());
      expect(bulkConfigs.every((cfg) => cfg.hasErrors() === undefined)).toBe(
        true
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/bulk`, async () => {
      const resp = await axios.get(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        { headers: headers() }
      );
      expect(resp.status).toBe(200);
      // expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
    });

    it(`PUT ${basePath}/bulk`, async () => {
      const updates = bulkConfigs.map(
        (cfg) =>
          new KeycloakSetupConfig({
            ...cfg,
            host: `${cfg.host}-bulk`,
          })
      );
      const resp = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        updates,
        { headers: headers() }
      );
      expect(resp.status).toBe(200);
      const updated = resp.data.map(
        (data: any) => new KeycloakSetupConfig(data)
      );

      updated.forEach((cfg: KeycloakSetupConfig, i: number) => {
        expect(cfg.host).toBe(bulkConfigs[i].host + "-bulk");
      });
      // expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
    });

    it(`DELETE ${basePath}/bulk`, async () => {
      const resp = await axios.delete(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        { headers: headers() }
      );
      expect(resp.status).toBe(200);

      for (const id of bulkIds) {
        await expect(
          axios.get(`${host}${basePath}/${id}`, { headers: headers() })
        ).rejects.toThrow(/404/);
      }
    });
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  describe("LAVAJET-xxx Search and Pagination", () => {
    it(`GET ${basePath}/listBy/{key}`, async () => {
      const response = await axios.get(
        `${host}${basePath}/listBy/host?direction=asc`,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      const key = "id";
      const value = created[key];
      const response = await axios.get(
        `${host}${basePath}/findBy/${key}/${value}?direction=asc`,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}`, async () => {
      const key = "host";
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/host/asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/id?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
