import path from "path";
import { Model } from "@decaf-ts/decorator-validation";
import jestOpenAPI from "jest-openapi";
import { LavajetModule } from "@bagacito/lavajet-toolkit";
import axios, { AxiosResponse } from "axios";
import { buildModulePayload } from "./payload-builders";
import { host, authenticate } from "./integration-env";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Lavajet Module API", () => {
  const basePath = "/lavajet-module";
  let token = "";
  let created: LavajetModule;
  let bulkModules: LavajetModule[] = [];
  let bulkModuleIds: string[] = [];
  let response: AxiosResponse;
  const skipCreateTags = ["bulk", "logs in"];

  const headers = () => ({
    Authorization: `Bearer ${token}`,
  });

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createModule();
  });

  const modulePayload = buildModulePayload();
  const requestModules = [buildModulePayload(), buildModulePayload()];

  const createModule = async () => {
    const response = await axios.post(`${host}${basePath}`, modulePayload, {
      headers: headers(),
    });
    expect(response?.status).toBe(201);
    created = new LavajetModule(response.data);
    return response;
  };

  const createBulkModules = async () => {
    const response = await axios.post(
      `${host}${basePath}/bulk`,
      requestModules,
      {
        headers: headers(),
      }
    );

    expect(response?.status).toBe(201);
    bulkModules = response?.data?.map((m: any) => new LavajetModule(m));
    bulkModuleIds = bulkModules?.map((m) => m[Model.pk(LavajetModule)]) as string[];
    return { bulkModules, bulkModuleIds, response };
  };

  it("logs in", async () => {
    expect(token).toBeDefined();
  });

  it(`POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    expect(created.hasErrors()).toBeUndefined();
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.id}`,
      {
        headers: headers(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedModule = new LavajetModule(persistedResponse.data);
    expect(persistedModule).toEqual(created);

    // attempting to recreate a product with existing id should result to 409
    await expect(
      axios.post(`${host}${basePath}`, persistedModule, {
        headers: headers(),
      })
    ).rejects.toThrow(/409/);
  });

  it(`GET ${basePath}/{id}`, async () => {
    const response = await axios.get(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    await expect(
      axios.get(`${host}${basePath}/invalid-id-that-does-not-exist`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`PUT ${basePath}/{id}`, async () => {
    const newModule = new LavajetModule(
      Object.assign({}, created, {
        features: [], // update features
      })
    );
    const response = await axios.put(
      `${host}${basePath}/${created.id}`,
      newModule,
      {
        headers: headers(),
      }
    );

    expect(response.status).toBe(200);
    const updated = new LavajetModule(response.data);
    expect(updated.equals(created)).toBe(false);
    expect(updated.equals(newModule, "updatedAt", "version")).toBe(true);
    expect(
      updated.equals(created, "version", "updatedAt", "updatedBy", "features")
    ).toBe(true);

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.id}`,
      {
        headers: headers(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedModule = new LavajetModule(persistedResponse.data);
    expect(persistedModule).toEqual(updated);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    await expect(
      axios.put(
        `${host}${basePath}/invalid-id-that-does-not-exist`,
        newModule,
        {
          headers: headers(),
        }
      )
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`DELETE ${basePath}/{id}`, async () => {
    if (!created) await createModule();
    const response = await axios.delete(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);

    await expect(
      axios.delete(`${host}${basePath}/${created.id}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkModules?.length)
        ({ bulkModules, bulkModuleIds, response } = await createBulkModules());
    });

    it(`POST ${basePath}/bulk`, async () => {
      expect(response.status).toBe(201);
      expect(bulkModules.length).toBe(requestModules.length);
      expect(bulkModules.every((m) => m.hasErrors() === undefined)).toBe(true);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/bulk`, async () => {
      const response = await axios.get(
        `${host}${basePath}/bulk?ids=${bulkModuleIds.join("&ids=")}`,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`PUT ${basePath}/bulk`, async () => {
      const updates = bulkModules.map(
        (existing) =>
          new LavajetModule({
            ...existing,
            features: [],
          })
      );

      const response = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkModuleIds.join("&ids=")}`,
        updates,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      const updated = response.data.map((data: any) => new LavajetModule(data));

      updated.every((m: LavajetModule, i: number) => {
        expect(m).not.toEqual(bulkModules[i]);
      });
      updated.every((m: LavajetModule, i: number) => {
        expect(m.equals(bulkModules[i])).toBe(false);
        expect(
          m.equals(bulkModules[i], "version", "updatedAt", "features")
        ).toBe(true);
      });
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`DELETE ${basePath}/bulk`, async () => {
      const response = await axios.delete(
        `${host}${basePath}/bulk?ids=${bulkModuleIds.join("&ids=")}`,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  describe("Search and Pagination", () => {
    it(`GET ${basePath}/listBy/{key}?direction=asc`, async () => {
      const key = "id";
      const response = await axios.get(
        `${host}${basePath}/listBy/${key}?direction=asc`,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      const modules = response.data.map((data: any) => new LavajetModule(data));
      modules.every((module: LavajetModule) =>
        expect(module).toBeInstanceOf(LavajetModule)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      const key = "id";
      const value = encodeURIComponent(created.id);
      const response = await axios.get(
        `${host}${basePath}/findBy/${key}/${value}?direction=asc`,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      const modules = response.data.map((data: any) => new LavajetModule(data));
      modules.every((module: LavajetModule) =>
        expect(module).toBeInstanceOf(LavajetModule)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}/{page}`, async () => {
      // Ensure modules exist in db
      if (!bulkModules?.length) await createBulkModules();
      const key = "id";
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      const modules = response.data.data.map(
        (data: any) => new LavajetModule(data)
      );
      modules.every((module: LavajetModule) =>
        expect(module).toBeInstanceOf(LavajetModule)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/{method=listBy}/{args}`, async () => {
    // Ensure modules exist in db
    if (!bulkModules?.length) await createBulkModules();
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/id?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    const modules = response.data.map((data: any) => new LavajetModule(data));
    modules.every((module: LavajetModule) =>
      expect(module).toBeInstanceOf(LavajetModule)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/{method=paginateBy}/{args}`, async () => {
    // Ensure modules exist in db
    if (!bulkModules?.length) await createBulkModules();
    const key = "id";
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/${key}?direction=asc&limit=5&offset=1`,
      {
        headers: headers(),
      }
    );

    expect(response.status).toBe(200);
    const modules = response.data.data.map((data: any) => new LavajetModule(data));
    modules.every((module: LavajetModule) =>
      expect(module).toBeInstanceOf(LavajetModule)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
