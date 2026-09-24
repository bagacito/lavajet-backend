import path from "path";
import axios, { AxiosResponse } from "axios";
import jestOpenAPI from "jest-openapi";
import { CacheService, Batch, Product } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildBatchPayload, buildProductPayload } from "./payload-builders";
import { Model, ModelErrorDefinition } from "@decaf-ts/decorator-validation";
import { URLService } from "../../../toolkit/src/shared/helpers/URLService";
import {
  generateGtin,
  getBatch,
} from "../../../toolkit/tests/utils/gtin-generator";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Batch API", () => {
  const basePath = "/batch";
  let token = "";
  let created: Batch;
  let createdRaw: any;
  let bulkBatches: Batch[] = [];
  let bulkIds: string[] = [];
  let cacheService: CacheService;
  let urlService: URLService;
  let response: AxiosResponse;
  let productCode: string | undefined;
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
    if (!created) response = await createBatch();
  });

  const payload = buildBatchPayload({ productCode });
  const bulkPayload = [
    buildBatchPayload({ productCode }),
    buildBatchPayload({ productCode }),
  ];

  const createProduct: () => Promise<Product> = async () => {
    const response = await axios.post(
      `${host}/product`,
      buildProductPayload(),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response?.status).toBe(201);
    return response.data;
  };

  const createBatch = async () => {
    // Existing product is needed for the tests.
    if (!productCode) productCode = (await createProduct()).productCode;
    const response = await axios.post(
      `${host}${basePath}`,
      buildBatchPayload({ productCode }),
      {
        headers: headers(),
      }
    );
    createdRaw = response.data;
    created = new Batch(response.data);
    return response;
  };

  const createBulkBatches = async () => {
    // Existing product is needed for the tests.
    if (!productCode) productCode = (await createProduct()).productCode;
    const bulkPayload = [
      buildBatchPayload({ productCode }),
      buildBatchPayload({ productCode }),
    ];
    const response = await axios.post(`${host}${basePath}/bulk`, bulkPayload, {
      headers: headers(),
    });
    expect(response?.status).toBe(201);
    bulkBatches = response?.data?.map((batch: Batch) => new Batch(batch));
    bulkIds = bulkBatches?.map((batch) => batch[Model.pk(Batch)]) as string[];
    createdRaw = response?.data;
    return { bulkBatches, bulkIds, response };
  };

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  it(`LAVAJET-403 POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    expect(created.hasErrors()).toBeUndefined();
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const responseRead = await axios.get(
      `${host}${basePath}/${created.productCode}/${created.batchNumber}`,
      {
        headers: headers(),
      }
    );
    expect(responseRead.status).toBe(200);

    // Check that cached batch is equal to
    const cacheResult = await cacheService.read(
      urlService.createMetadataURL(
        created.productCode,
        created.batchNumber,
        undefined
      )
    );
    expect(cacheResult).toBeDefined();

    const invalidBatch = new Batch(
      Object.assign({}, created, {
        batchNumber: getBatch(),
        expiryDate: "invalid Date",
      })
    );

    expect(invalidBatch.hasErrors()).toEqual(
      new ModelErrorDefinition({
        expiryDate: { date: "Invalid value. not a valid Date" },
      })
    );

    await expect(
      axios.post(`${host}${basePath}`, invalidBatch, {
        headers: headers(),
      })
    ).rejects.toThrow(/422/);

    // attempting to recreate a batch with existing key should result to 409
    await expect(
      axios.post(`${host}${basePath}`, created, {
        headers: headers(),
      })
    ).rejects.toThrow(/409/);
  });

  it(`LAVAJET-405 GET ${basePath}/{productCode}/{batchNumber}`, async () => {
    const response = await axios.get(
      `${host}${basePath}/${created.productCode}/${created.batchNumber}`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    await expect(
      axios.get(`${host}${basePath}/${generateGtin()}/batch`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`LAVAJET-404 PUT ${basePath}/{productCode}/{batchNumber}`, async () => {
    const newBatch = new Batch({
      ...created,
      manufacturerName: `ProPharma B updated${created.version}`,
    });

    const response = await axios.put(
      `${host}${basePath}/${created.productCode}/${created.batchNumber}`,
      newBatch,
      {
        headers: headers(),
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.manufacturerName).toBe(
      `ProPharma B updated${created.version}`
    );
    const updated = new Batch(response.data);
    expect(updated.equals(created)).toBe(false);
    expect(updated.equals(newBatch, "updatedAt", "version")).toBe(true);
    expect(
      updated.equals(
        created,
        "version",
        "updatedAt",
        "updatedBy",
        "manufacturerName"
      )
    ).toBe(true);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.productCode}/${created.batchNumber}`,
      {
        headers: headers(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedBatch = new Batch(persistedResponse.data);
    expect(persistedBatch).toEqual(updated);

    await expect(
      axios.put(`${host}${basePath}/${generateGtin()}/batch`, newBatch, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it.skip(`LAVAJET-406 DELETE ${basePath}/{productCode}/{batchNumber}`, async () => {
    const response = await axios.delete(
      `${host}${basePath}/${created.productCode}/${created.batchNumber}`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);

    await expect(
      axios.delete(
        `${host}${basePath}/${created.productCode}/${created.batchNumber}`,
        {
          headers: headers(),
        }
      )
    ).rejects.toThrow(/Request failed with status code 404/);

    // Check that batch no longer exists in cache
    const cacheResult = await cacheService.read(
      urlService.createMetadataURL(
        created.productCode,
        created.batchNumber,
        undefined
      )
    );
    expect(cacheResult).toBeNull();
  });

  describe("LAVAJET-407 Bulk Operations", () => {
    beforeEach(async () => {
      // Existing product is needed for the tests.
      if (!bulkBatches?.length)
        ({ bulkBatches, bulkIds, response } = await createBulkBatches());
    });

    it(`POST ${basePath}/bulk`, async () => {
      expect(response.status).toBe(201);
      expect(bulkBatches.length).toBe(bulkPayload.length);
      expect(
        bulkBatches.every((batch) => batch.hasErrors() === undefined)
      ).toBe(true);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/bulk`, async () => {
      const response = await axios.get(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`PUT ${basePath}/bulk`, async () => {
      const payload = bulkBatches.map(
        (batch) =>
          new Batch({
            ...batch,
            manufacturerName: `${
              batch.manufacturerName ?? "Manufacturer"
            }-bulk`,
          })
      );
      const response = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        payload,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      const updated = response.data.map((data: any) => new Batch(data));
      updated.every((p: Batch, i: number) => {
        expect(p).not.toEqual(bulkBatches[i]);
        expect(p.manufacturerName).toBe(
          `${bulkBatches[i].manufacturerName ?? "Manufacturer"}-bulk`
        );
      });
      updated.every((p: Batch, i: number) => {
        expect(p.equals(bulkBatches[i])).toBe(false);
        expect(
          p.equals(bulkBatches[i], "version", "updatedAt", "manufacturerName")
        ).toBe(true);
      });
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it.skip("DELETE /product/bulk", async () => {
      const response = await axios.delete(
        `${host}/product/bulk?ids=${bulkIds.join("&ids=")}`,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  describe("Search and Pagination", () => {
    it(`GET ${basePath}/listBy/{key}`, async () => {
      const response = await axios.get(
        `${host}${basePath}/listBy/productCode?direction=asc`,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      const batches = response.data.map((data: any) => new Batch(data));
      batches.every((batch: Batch) => expect(batch).toBeInstanceOf(Batch));
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      if (!created) await createBatch();
      const response = await axios.get(
        `${host}${basePath}/findBy/productCode/${created.productCode}?direction=asc`,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      const batches = response.data.map((data: any) => new Batch(data));
      batches.every((batch: Batch) => expect(batch).toBeInstanceOf(Batch));
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}`, async () => {
      // Ensure batches exist in db
      if (!bulkBatches?.length) await createBulkBatches();
      const key = "batchNumber";
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      const batches = response.data.data.map((data: any) => new Batch(data));
      expect(batches.length >= 2 && batches.length <= 5).toBe(true);
      batches.every((product: Batch) => expect(product).toBeInstanceOf(Batch));
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/{method=listBy}/{args}`, async () => {
    // Ensure batches exist in db
    if (!bulkBatches?.length) await createBulkBatches();
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/productCode/asc`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    const batches = response.data.map((data: any) => new Batch(data));
    batches.every((batch: Batch) => expect(batch).toBeInstanceOf(Batch));
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/{method=paginateBy}/{args}`, async () => {
    // Ensure batches exist in db
    if (!bulkBatches?.length) await createBulkBatches();
    const key = "batchNumber";
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/${key}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const batches = response.data.data.map((data: any) => new Batch(data));
    batches.every((batch: Batch) => expect(batch).toBeInstanceOf(Batch));
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
