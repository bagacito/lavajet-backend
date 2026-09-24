import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { LavajetModuleFeature } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildModuleFeaturePayload } from "./payload-builders";
import { Model } from "@decaf-ts/decorator-validation";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Module Features API", () => {
  const basePath = "/module-features";
  let token = "";
  let created: LavajetModuleFeature;
  let createdRaw: any;
  let bulkFeatures: LavajetModuleFeature[] = [];
  let bulkIds: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let response: any;
  const skipCreateTags = ["bulk", "logs in", "post"];

  const headers = () => ({ Authorization: `Bearer ${token}` });

  const resourcePath = (feature: LavajetModuleFeature) =>
    `${basePath}/${feature.module}/${feature.name}`;

  beforeAll(async () => {});

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createModuleFeature();
  });

  const createModuleFeature = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/name?direction=asc`,
      {
        headers: headers(),
      }
    );

    expect(response.status).toBe(200);
    if (
      !response.data ||
      (Array.isArray(response.data) && !response.data.length)
    )
      throw "No ModuleFeatures found in database";
    createdRaw = Array.isArray(response.data)
      ? response.data[0]
      : response.data;
    created = new LavajetModuleFeature(createdRaw);
    return response;
  };

  const createBulkModuleFeature = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/module?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response?.status).toBe(200);
    bulkFeatures = response.data
      .slice(0, 5)
      .map((item: any) => new LavajetModuleFeature(item));
    bulkIds = bulkFeatures.map((s) => s.id as string);
    createdRaw = response.data;
    return { bulkFeatures, bulkIds, response };
  };

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  it(`LAVAJET-POST POST ${basePath}`, async () => {
    await expect(
      axios.post(`${host}${basePath}`, buildModuleFeaturePayload(), {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-GET GET ${basePath}/{module}/{name}`, async () => {
    const res = await axios.get(`${host}${resourcePath(created)}`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();

    await expect(
      axios.get(`${host}${basePath}/nonexistent/nonexistent`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`LAVAJET-PUT PUT ${basePath}/{module}/{name}`, async () => {
    await expect(
      axios.put(
        `${host}${resourcePath(created)}`,
        new LavajetModuleFeature({
          ...createdRaw,
          description: `${(created as any).description}-updated`,
        }),
        { headers: headers() }
      )
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-DELETE DELETE ${basePath}/{module}/{name}`, async () => {
    await expect(
      axios.delete(`${host}${resourcePath(created)}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkFeatures?.length)
        ({ bulkFeatures, bulkIds, response } = await createBulkModuleFeature());
    });

    it(`POST ${basePath}/bulk`, async () => {
      const payload = [
        buildModuleFeaturePayload(),
        buildModuleFeaturePayload(),
      ];
      await expect(
        axios.post(`${host}${basePath}/bulk`, payload, {
          headers: headers(),
        })
      ).rejects.toThrow(/Request failed with status code 406/);
    });

    it(`GET ${basePath}/bulk`, async () => {
      const res = await axios.get(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        {
          headers: headers(),
        }
      );
      expect(res.status).toBe(200);
      // expect({ ...res, body: res.data }).toSatisfyApiSpec();
    });

    it(`PUT ${basePath}/bulk`, async () => {
      const payload = bulkFeatures.map(
        (s) =>
          new LavajetModuleFeature({
            ...s,
            description: `${(s as any).description}-bulk`,
          })
      );
      await expect(
        axios.put(
          `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
          payload,
          {
            headers: headers(),
          }
        )
      ).rejects.toThrow(/Request failed with status code 406/);
    });

    it("DELETE /bulk", async () => {
      await expect(
        axios.delete(`${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`, {
          headers: headers(),
        })
      ).rejects.toThrow(/Request failed with status code 406/);
    });
  });

  it(`GET ${basePath}/listBy/{key}`, async () => {
    const res = await axios.get(
      `${host}${basePath}/listBy/module?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    if (!bulkFeatures?.length) await createBulkModuleFeature();
    const res = await axios.get(
      `${host}${basePath}/findBy/module/${encodeURIComponent(bulkFeatures[0].module)}?direction=asc`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/paginateBy/{key}`, async () => {
    const key = "module";
    const page = 1;
    const res = await axios.get(
      `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    const batches = res.data.data.map(
      (data: any) => new LavajetModuleFeature(data)
    );
    expect(batches.length >= 2 && batches.length <= 5).toBe(true);
    batches.every((ps: LavajetModuleFeature) =>
      expect(ps).toBeInstanceOf(LavajetModuleFeature)
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/listBy/module/asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/paginateBy/module?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });
});
