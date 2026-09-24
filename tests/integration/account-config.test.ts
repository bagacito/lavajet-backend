import path from "path";
import { Model, ModelErrorDefinition } from "@decaf-ts/decorator-validation";
import jestOpenAPI from "jest-openapi";
import { CacheService, AccountConfig } from "@bagacito/lavajet-toolkit";
import axios, { AxiosResponse } from "axios";
import { buildAccountConfigPayload } from "./payload-builders";
import { host, authenticate } from "./integration-env";
import { URLService } from "../../../toolkit/src/shared/helpers/URLService";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Account Config API", () => {
  const basePath = "/account-config";
  let token = "";
  let created: AccountConfig;
  let createdRaw: any;
  let bulkConfigs: AccountConfig[] = [];
  let bulkIds: string[] = [];
  let cacheService: CacheService;
  let urlService: URLService;
  let response: AxiosResponse;
  const skipCreateTags = ["bulk", "logs in"];

  const headers = () => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    cacheService = new CacheService();
    await cacheService.boot();
    urlService = new URLService();
    await urlService.boot();
  });

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createAccountConfig();
  });

  const createAccountConfig = async () => {
    const payload = buildAccountConfigPayload();
    const resp = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(resp?.status).toBe(201);
    created = new AccountConfig(resp.data);
    createdRaw = resp.data;
    return resp;
  };

  const createBulkConfigs = async () => {
    const requestPayload = [
      buildAccountConfigPayload(),
      buildAccountConfigPayload(),
    ];
    const resp = await axios.post(`${host}${basePath}/bulk`, requestPayload, {
      headers: headers(),
    });
    expect(resp?.status).toBe(201);
    bulkConfigs = resp.data.map((item: any) => new AccountConfig(item));
    bulkIds = bulkConfigs.map((cfg) => cfg.account);
    return { bulkConfigs, bulkIds, response: resp };
  };

  it("logs in", async () => {
    expect(token).toBeDefined();
  });

  it(`LAVAJET-XXX POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    expect(created.hasErrors()).toBeUndefined();
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.account}`,
      { headers: headers() }
    );
    expect(persistedResponse.status).toBe(200);
    const persisted = new AccountConfig(persistedResponse.data);
    expect(persisted).toEqual(created);

    const invalid = new AccountConfig(
      Object.assign({}, created, { account: "" })
    );
    expect(invalid.hasErrors()).toBeDefined();

    await expect(
      axios.post(`${host}${basePath}`, invalid, {
        headers: headers(),
      })
    ).rejects.toThrow(/422/);

    await expect(
      axios.post(`${host}${basePath}`, persisted, {
        headers: headers(),
      })
    ).rejects.toThrow(/409/);
  });

  it(`LAVAJET-XXX GET ${basePath}/{account}`, async () => {
    const resp = await axios.get(`${host}${basePath}/${created.account}`, {
      headers: headers(),
    });
    expect(resp.status).toBe(200);
    // expect({ ...resp, body: resp.data }).toSatisfyApiSpec();

    await expect(
      axios.get(`${host}${basePath}/nonexistent`, { headers: headers() })
    ).rejects.toThrow(/404/);
  });

  it(`LAVAJET-XXX PUT ${basePath}/{account}`, async () => {
    const updatedPayload = new AccountConfig({
      ...createdRaw,
      modules: [...(createdRaw?.modules ?? []), ...created.modules],
    });
    const resp = await axios.put(
      `${host}${basePath}/${created.account}`,
      updatedPayload,
      {
        headers: headers(),
      }
    );
    expect(resp.status).toBe(200);
    expect(resp.data.modules.length).toEqual(created.modules.length);
    const updated = new AccountConfig(resp.data);
    expect(updated.equals(created)).toBe(false);
    expect(updated.equals(created, "version", "updatedAt", "modules")).toBe(
      true
    );

    const persistedResp = await axios.get(
      `${host}${basePath}/${created.account}`,
      { headers: headers() }
    );
    expect(persistedResp.status).toBe(200);
    const persisted = new AccountConfig(persistedResp.data);
    expect(persisted).toEqual(updated);

    await expect(
      axios.put(`${host}${basePath}/nonexistent`, updatedPayload, {
        headers: headers(),
      })
    ).rejects.toThrow(/404/);
  });

  it(`LAVAJET-XXX DELETE ${basePath}/{account}`, async () => {
    const resp = await axios.delete(`${host}${basePath}/${created.account}`, {
      headers: headers(),
    });
    expect(resp.status).toBe(200);

    await expect(
      axios.delete(`${host}${basePath}/${created.account}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/404/);

    const cacheResult = await cacheService.read(
      urlService.createOwnerURL(created.account)
    );
    expect(cacheResult).toBeNull();
  });

  describe("LAVAJET-XXX Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkConfigs?.length) {
        ({ bulkConfigs, bulkIds, response } = await createBulkConfigs());
      }
    });

    it(`POST ${basePath}/bulk`, async () => {
      expect(response.status).toBe(201);
      expect(bulkConfigs.length).toBe(2);
      expect(bulkConfigs.every((c) => c.hasErrors() === undefined)).toBe(true);
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
        (existing) =>
          new AccountConfig({
            ...existing,
            modules: existing.modules,
          })
      );
      const resp = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        updates,
        { headers: headers() }
      );
      expect(resp.status).toBe(200);
      const updated = resp.data.map((d: any) => new AccountConfig(d));
      updated.forEach((u: AccountConfig, i: number) => {
        expect(u.equals(bulkConfigs[i])).toBe(false);
        expect(
          u.equals(bulkConfigs[i], "version", "updatedAt", "modules")
        ).toBe(true);
      });
    });

    it(`DELETE ${basePath}/bulk`, async () => {
      const resp = await axios.delete(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        { headers: headers() }
      );
      expect(resp.status).toBe(200);
    });
  });

  describe("LAVAJET-XXX Search and Pagination", () => {
    it(`GET ${basePath}/listBy/{key}`, async () => {
      const resp = await axios.get(
        `${host}${basePath}/listBy/account?direction=asc`,
        { headers: headers() }
      );
      expect(resp.status).toBe(200);
      // expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      const key = "account";
      const value = encodeURIComponent(created.account);
      const resp = await axios.get(
        `${host}${basePath}/findBy/${key}/${value}?direction=asc`,
        { headers: headers() }
      );
      expect(resp.status).toBe(200);
      // expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}/{page}`, async () => {
      const key = "account";
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      // expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const resp = await axios.get(
      `${host}${basePath}/statement/listBy/account/asc`,
      { headers: headers() }
    );
    expect(resp.status).toBe(200);
    // expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const resp = await axios.get(
      `${host}${basePath}/statement/paginateBy/account?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(resp.status).toBe(200);
    // expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
  });
});
