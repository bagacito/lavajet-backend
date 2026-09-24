import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { Audit } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildAuditPayload } from "./payload-builders";
import { Model } from "@decaf-ts/decorator-validation";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Audit API", () => {
  const basePath = "/audit";
  let token = "";
  let created: Audit;
  let createdRaw: any;
  let bulkRecords: Audit[] = [];
  let bulkIds: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let response: any;
  const skipCreateTags = ["bulk", "logs in", "post"];

  const headers = () => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {});

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createAudit();
  });

  const createAudit = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/id?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    if (!response.data?.length) throw "No Audits found in database";
    createdRaw = response.data[0];
    created = new Audit(response.data[0]);
    return response;
  };

  const createBulkAudits = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/id?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response?.status).toBe(200);
    bulkRecords = response.data.slice(0, 5).map((item: any) => new Audit(item));
    bulkIds = bulkRecords.map((r) => r.id);
    createdRaw = response.data;
    return { bulkRecords, bulkIds, response };
  };

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  it(`LAVAJET-POST POST ${basePath}`, async () => {
    await expect(
      axios.post(`${host}${basePath}`, buildAuditPayload(), {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-GET GET ${basePath}/{id}`, async () => {
    const res = await axios.get(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();

    // await expect(
    //   axios.get(
    //     `${host}${basePath}/${Model.pk(new Audit({ id: "nonexistent" }))}`,
    //     {
    //       headers: headers(),
    //     }
    //   )
    // ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`LAVAJET-PUT PUT ${basePath}/{id}`, async () => {
    await expect(
      axios.put(
        `${host}${basePath}/${created.id}`,
        new Audit({
          ...createdRaw,
          transaction: `${created.transaction}-updated`,
        }),
        { headers: headers() }
      )
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-DELETE DELETE ${basePath}/{id}`, async () => {
    await expect(
      axios.delete(`${host}${basePath}/${created.id}`, { headers: headers() })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkRecords?.length)
        ({ bulkRecords, bulkIds, response } = await createBulkAudits());
    });

    it(`POST ${basePath}/bulk`, async () => {
      const payload = [buildAuditPayload(), buildAuditPayload()];
      await expect(
        axios.post(`${host}${basePath}/bulk`, payload, { headers: headers() })
      ).rejects.toThrow(/Request failed with status code 406/);
    });

    it(`GET ${basePath}/bulk`, async () => {
      const res = await axios.get(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        { headers: headers() }
      );
      expect(res.status).toBe(200);
      // expect({ ...res, body: res.data }).toSatisfyApiSpec();
    });

    it(`PUT ${basePath}/bulk`, async () => {
      const payload = bulkRecords.map(
        (r) => new Audit({ ...r, transaction: `${r.transaction}-bulk` })
      );
      await expect(
        axios.put(
          `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
          payload,
          { headers: headers() }
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

  describe("Search and Pagination", () => {
    beforeEach(async () => {
      if (!bulkRecords?.length) await createBulkAudits();
    });
    it(`GET ${basePath}/listBy/{key}`, async () => {
      const res = await axios.get(
        `${host}${basePath}/listBy/id?direction=asc`,
        { headers: headers() }
      );
      expect(res.status).toBe(200);
      // expect({ ...res, body: res.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      const res = await axios.get(
        `${host}${basePath}/findBy/id/${bulkRecords[0].id}?direction=asc`,
        { headers: headers() }
      );
      expect(res.status).toBe(200);
      // expect({ ...res, body: res.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}`, async () => {
      const key = "id";
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      const batches = response.data.data.map((data: any) => new Audit(data));
      expect(batches.length >= 2 && batches.length <= 5).toBe(true);
      batches.every((a: Audit) => expect(a).toBeInstanceOf(Audit));
      expect(response.status).toBe(200);
      // expect({ ...res, body: res.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const res = await axios.get(`${host}${basePath}/statement/listBy/id/asc`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/paginateBy/id?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });
});
