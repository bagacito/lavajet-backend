import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { ProductMarket } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildMarketPayload } from "./payload-builders";
import { Model } from "@decaf-ts/decorator-validation";


describe("Market API", () => {
  const basePath = "/market";
  let token = "";
  let created: ProductMarket;
  let createdRaw: any;
  let bulkMarkets: ProductMarket[] = [];
  let bulkIds: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let response: any;
  const skipCreateTags = ["bulk", "logs in", "post"];

  const headers = () => ({ Authorization: `Bearer ${token}` });

  const resourcePath = (market: ProductMarket) =>
    `${basePath}/${market.productCode}/${market.marketId}`;

  beforeAll(async () => {});

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createMarket();
  });

  const createMarket = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/productCode?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    if (
      !response.data ||
      (Array.isArray(response.data) && !response.data.length)
    )
      throw "No Markets found in database";
    createdRaw = Array.isArray(response.data)
      ? response.data[0]
      : response.data;
    created = new ProductMarket(createdRaw);
    return response;
  };

  const createBulkMarket = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/productCode?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response?.status).toBe(200);
    if (
      !response.data ||
      (Array.isArray(response.data) && !response.data.length)
    )
      throw "No Markets found in database";
    bulkMarkets = response.data
      .slice(0, 5)
      .map((item: any) => new ProductMarket(item));
    bulkIds = bulkMarkets.map((s) => s.id as string);
    createdRaw = response.data;
    return { bulkMarkets, bulkIds, response };
  };

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  it(`LAVAJET-POST POST ${basePath}`, async () => {
    await expect(
      axios.post(`${host}${basePath}`, buildMarketPayload(), {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-GET GET ${basePath}/{productCode}/{marketId}`, async () => {
    const res = await axios.get(`${host}${resourcePath(created)}`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();

    // await expect(
    //   axios.get(`${host}${basePath}/nonexistent/nonexistent`, {
    //     headers: headers(),
    //   })
    // ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`LAVAJET-PUT PUT ${basePath}/{productCode}/{marketId}`, async () => {
    await expect(
      axios.put(
        `${host}${resourcePath(created)}`,
        new ProductMarket({
          ...createdRaw,
          mahName: `${(created as any).mahName}-updated`,
        }),
        { headers: headers() }
      )
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-DELETE DELETE ${basePath}/{productCode}/{marketId}`, async () => {
    await expect(
      axios.delete(`${host}${resourcePath(created)}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      const skipCreateTags = ["post"];
      const runningTestName = expect.getState().currentTestName?.toLowerCase();
      if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
      if (!bulkMarkets?.length)
        ({ bulkMarkets, bulkIds, response } = await createBulkMarket());
    });

    it(`POST ${basePath}/bulk`, async () => {
      const payload = [buildMarketPayload(), buildMarketPayload()];
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
      const payload = bulkMarkets.map(
        (s) =>
          new ProductMarket({ ...s, mahName: `${(s as any).mahName}-bulk` })
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
      `${host}${basePath}/listBy/productCode?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    if (!bulkMarkets?.length) await createBulkMarket();
    const res = await axios.get(
      `${host}${basePath}/findBy/productCode/${encodeURIComponent(bulkMarkets[0].productCode)}?direction=asc`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/paginateBy/{key}`, async () => {
    const key = "productCode";
    const page = 1;
    const res = await axios.get(
      `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    const batches = res.data.data.map((data: any) => new ProductMarket(data));
    expect(batches.length >= 2 && batches.length <= 5).toBe(true);
    batches.every((ps: ProductMarket) =>
      expect(ps).toBeInstanceOf(ProductMarket)
    );
    expect(res.status).toBe(200);
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
