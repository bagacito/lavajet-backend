import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { KibanaSetupConfig } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildKibanaConfigPayload } from "./payload-builders";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Kibana Config API", () => {
  const basePath = "/kibana-config";
  let token = "";
  let created: KibanaSetupConfig;
  let createdRaw: any;
  let bulkConfigs: KibanaSetupConfig[] = [];
  let bulkIds: string[] = [];
  let response: any;
  const skipCreateTags = ["bulk", "logs in"];

  const headers = () => ({ Authorization: `Bearer ${token}` });

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createConfig();
  });

  const createConfig = async () => {
    const payload = buildKibanaConfigPayload();
    const response = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(response.status).toBe(201);
    created = new KibanaSetupConfig(response.data);
    createdRaw = response.data;
    expect(created.hasErrors()).toBeUndefined();
    return response;
  };

  const createBulkConfigs = async () => {
    const payload = [buildKibanaConfigPayload(), buildKibanaConfigPayload()];
    const resp = await axios.post(`${host}${basePath}/bulk`, payload, {
      headers: headers(),
    });
    expect(resp.status).toBe(201);
    bulkConfigs = resp.data.map((item: any) => new KibanaSetupConfig(item));
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
  });

  it(`GET ${basePath}/{id}`, async () => {
    const response = await axios.get(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`PUT ${basePath}/{id}`, async () => {
    const updatedConfig = new KibanaSetupConfig({
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
    const persistedConfig = new KibanaSetupConfig(persistedResponse.data);
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

  it(`POST ${basePath}/bulk`, async () => {
    const payload = [buildKibanaConfigPayload(), buildKibanaConfigPayload()];
    const response = await axios.post(`${host}${basePath}/bulk`, payload, {
      headers: headers(),
    });
    expect(response.status).toBe(201);
    bulkConfigs = response.data.map((item: any) => new KibanaSetupConfig(item));
    bulkIds = bulkConfigs.map((cfg) => cfg.id);
    expect(bulkConfigs.every((cfg) => cfg.hasErrors() === undefined)).toBe(
      true
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/bulk`, async () => {
    const response = await axios.get(
      `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`PUT ${basePath}/bulk`, async () => {
    const updates = bulkConfigs.map(
      (cfg) =>
        new KibanaSetupConfig({
          ...cfg,
          host: `${cfg.host}-bulk`,
        })
    );
    const response = await axios.put(
      `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
      updates,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const updated = response.data.map(
      (data: any) => new KibanaSetupConfig(data)
    );

    updated.forEach((cfg: KibanaSetupConfig, i: number) => {
      expect(cfg.host).toBe(bulkConfigs[i].host + "-bulk");
    });
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/listBy/{key}`, async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/host?direction=asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    const key = "host";
    const value = encodeURIComponent(created[key]);
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

  it(`DELETE ${basePath}/bulk`, async () => {
    if (!bulkConfigs?.length) {
      await createBulkConfigs();
    }
    const response = await axios.delete(
      `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);

    for (const id of bulkIds) {
      await expect(
        axios.get(`${host}${basePath}/${id}`, { headers: headers() })
      ).rejects.toThrow(/404/);
    }
  });
});
