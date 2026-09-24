import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { GtinOwner } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildGtinOwnerPayload } from "./payload-builders";
import { Model } from "@decaf-ts/decorator-validation";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Gtin Owner API", () => {
  const basePath = "/gtin-owner";
  let token = "";
  let created: GtinOwner;
  let createdRaw: any;
  let bulkOwners: GtinOwner[] = [];
  let bulkIds: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let response: any;
  const skipCreateTags = ["bulk", "logs in", "post"];

  const headers = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {});

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createGtinOwner();
  });

  const createGtinOwner = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/productCode?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    if (!response.data?.length) throw "No GtinOwners found in database";
    createdRaw = response.data[0];
    created = new GtinOwner(response.data[0]);
    return response;
  };

  const createBulkOwners = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/productCode?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response?.status).toBe(200);
    bulkOwners = response.data
      .slice(0, 5)
      .map((item: any) => new GtinOwner(item));
    bulkIds = bulkOwners.map((owner) => owner.productCode);
    createdRaw = response.data;
    return { bulkOwners, bulkIds, response };
  };

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  it(`LAVAJET-POST POST ${basePath}`, async () => {
    await expect(
      axios.post(`${host}${basePath}`, buildGtinOwnerPayload(), {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-GET GET ${basePath}/{productCode}`, async () => {
    const res = await axios.get(`${host}${basePath}/${created.productCode}`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();

    await expect(
      axios.get(
        `${host}${basePath}/${Model.pk(new GtinOwner({ productCode: "nonexistent" }))}`,
        {
          headers: headers(),
        }
      )
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`LAVAJET-PUT PUT ${basePath}/{productCode}`, async () => {
    await expect(
      axios.put(
        `${host}${basePath}/${created.productCode}`,
        new GtinOwner({ ...createdRaw, ownedBy: `${created.ownedBy}-updated` }),
        { headers: headers() }
      )
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-DELETE DELETE ${basePath}/{productCode}`, async () => {
    await expect(
      axios.delete(`${host}${basePath}/${created.productCode}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkOwners?.length)
        ({ bulkOwners, bulkIds, response } = await createBulkOwners());
    });

    it(`POST ${basePath}/bulk`, async () => {
      const payload = [buildGtinOwnerPayload(), buildGtinOwnerPayload()];
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
      const payload = bulkOwners.map(
        (owner) => new GtinOwner({ ...owner, ownedBy: `${owner.ownedBy}-bulk` })
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
      `${host}${basePath}/listBy/ownedBy?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    if (!bulkOwners?.length) await createBulkOwners();
    const res = await axios.get(
      `${host}${basePath}/findBy/ownedBy/${encodeURIComponent(bulkOwners[0].ownedBy)}?direction=asc`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/paginateBy/{key}`, async () => {
    const key = "productCode";
    const page = 1;
    const response = await axios.get(
      `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const batches = response.data.data.map((data: any) => new GtinOwner(data));
    expect(batches.length >= 2 && batches.length <= 5).toBe(true);
    batches.every((gtinOwner: GtinOwner) =>
      expect(gtinOwner).toBeInstanceOf(GtinOwner)
    );
    expect(response.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/listBy/productCode/asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/paginateBy/productCode?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });
});
