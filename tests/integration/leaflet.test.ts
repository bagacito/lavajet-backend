import path from "path";
import axios, { AxiosResponse } from "axios";
import jestOpenAPI from "jest-openapi";
import {
  Batch,
  CacheService,
  Leaflet,
  LeafletFile,
  LeafletType,
  Product,
} from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import {
  buildBatchPayload,
  buildLeafletPayload,
  buildProductPayload,
} from "./payload-builders";
import { Model } from "@decaf-ts/decorator-validation";
import { URLService } from "../../../toolkit/src/shared/helpers/URLService";
import { generateGtin } from "../../../toolkit/tests/utils/gtin-generator";

jest.setTimeout(90000);

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Leaflet API", () => {
  const basePath = "/leaflet";
  let token = "";
  let created: Leaflet;
  let bulkLeaflets: Leaflet[] = [];
  let bulkIds: string[] = [];
  let cacheService: CacheService;
  let urlService: URLService;
  let response: AxiosResponse;
  let productCode: string | undefined;
  let batchNumber: string | undefined;
  const skipCreateTags = ["bulk", "logs in"];

  const headers = () => ({ Authorization: `Bearer ${token}` });

  const getLeafletPath = (leaflet: Leaflet) =>
    `${basePath}/${leaflet.productCode}/${leaflet.batchNumber ?? "batch"}/${leaflet.leafletType}/${leaflet.lang}/${leaflet.epiMarket}`;

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
    if (!created) response = await createLeaflet();
  });

  // const payload = buildLeafletPayload({ productCode });
  const bulkPayload = [
    buildLeafletPayload(),
    buildLeafletPayload({ productCode }),
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

  const createBatch: () => Promise<Batch> = async () => {
    const response = await axios.post(
      `${host}/batch`,
      buildBatchPayload({ productCode }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response?.status).toBe(201);
    return response.data;
  };

  const createLeaflet = async () => {
    if (!productCode) productCode = (await createProduct()).productCode;
    if (!batchNumber) batchNumber = (await createBatch()).batchNumber;
    const payload = buildLeafletPayload({
      productCode,
      batchNumber,
    });

    payload.xmlFileContent = new LeafletFile(
      Object.assign(payload.xmlFileContent, {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        id: `${payload.id}:${(payload.xmlFileContent as LeafletFile).fileName}`,
      })
    );

    const response = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(response.status).toBe(201);
    created = new Leaflet(response.data);

    return response;
  };

  const createBulkLeaflets = async () => {
    if (!productCode) productCode = (await createProduct()).productCode;
    if (!batchNumber) batchNumber = (await createBatch()).batchNumber;
    const bulkPayload = [
      buildLeafletPayload({
        productCode,
        batchNumber,
        epiMarket: "BR",
        leafletType: LeafletType.leaflet,
      }),
      buildLeafletPayload({
        productCode,
        batchNumber,
        epiMarket: "EN",
        leafletType: LeafletType.prescribingInfo,
      }),
    ];
    const response = await axios.post(`${host}${basePath}/bulk`, bulkPayload, {
      headers: headers(),
    });

    expect(response?.status).toBe(201);
    bulkLeaflets = response?.data?.map(
      (leaflet: Leaflet) => new Leaflet(leaflet)
    );
    bulkIds = bulkLeaflets?.map(
      (leaflet) => leaflet[Model.pk(Leaflet)]
    ) as string[];
    return { bulkLeaflets, bulkIds, response };
  };

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  it(`POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    // expect(created.hasErrors()).toBeUndefined();
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const leafletId = getLeafletPath(created);
    const responseRead = await axios.get(`${host}${leafletId}`, {
      headers: headers(),
    });
    expect(responseRead.status).toBe(200);

    // Check that cached leaflet is equal to
    const cacheResult = await cacheService.read(
      urlService.createLeafletURL(created)
    );
    expect(cacheResult).toBeDefined();

    const invalidLeaflet = new Leaflet(
      Object.assign({}, created, {
        productCode: "invalidId",
      })
    );
    // expect(invalidLeaflet.hasErrors()).toEqual(
    //   new ModelErrorDefinition({
    //     productCode: { gtin: "Not a valid Gtin" },
    //   })
    // );

    await expect(
      axios.post(`${host}${basePath}`, invalidLeaflet, {
        headers: headers(),
      })
    ).rejects.toThrow(/422/);

    // attempting to recreate a leaflet with existing key should result to 409
    await expect(
      axios.post(`${host}${basePath}`, created, {
        headers: headers(),
      })
    ).rejects.toThrow(/409/);
  });

  it(`GET ${basePath}/{productCode}/{batchNumber}/{leafletType}/{lang}/{epiMarket}`, async () => {
    const leafletId = getLeafletPath(created);
    const response = await axios.get(`${host}${leafletId}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const fakeLeaflet = buildLeafletPayload({
      productCode: generateGtin(),
    });

    await expect(
      axios.get(`${host}${getLeafletPath(fakeLeaflet)}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);

    const responsePublic = await axios.get(`${host}/public/${leafletId}`, {
      headers: headers(),
    });
    expect(responsePublic.status).toBe(200);
  });

  it(`PUT ${basePath}/{productCode}/{batchNumber}/{leafletType}/{lang}/{epiMarket}`, async () => {
    const newFileContent = new LeafletFile(
      Object.assign(created.xmlFileContent, {
        filename: "newFilename",
      })
    );
    const newLeaflet = new Leaflet({
      ...created,
      xmlFileContent: newFileContent,
    });

    const response = await axios.put(
      `${host}${getLeafletPath(created)}`,
      newLeaflet,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    expect(new LeafletFile(response.data.xmlFileContent)).toStrictEqual(
      newFileContent
    );
    const updated = new Leaflet(response.data);
    expect(updated.equals(created)).toBe(false);
    expect(updated.equals(newLeaflet, "updatedAt", "version")).toBe(true);
    expect(
      updated.equals(
        created,
        "version",
        "updatedAt",
        "updatedBy",
        "xmlFileContent"
      )
    ).toBe(true);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${getLeafletPath(created)}`,
      {
        headers: headers(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    // const persistedLeaflet = new Leaflet(persistedResponse.data);
    // TODO Maybe: Fix backend changing xmlfilecontent to string
    // expect(persistedLeaflet).toEqual(updated);

    const fakeLeaflet = buildLeafletPayload();

    await expect(
      axios.put(`${host}${getLeafletPath(fakeLeaflet)}`, fakeLeaflet, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`DELETE ${basePath}/{productCode}/{batchNumber}/{leafletType}/{lang}/{epiMarket}`, async () => {
    const response = await axios.delete(`${host}${getLeafletPath(created)}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);

    await expect(
      axios.delete(`${host}${getLeafletPath(created)}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);

    // Check that leaflet no longer exists in cache
    const cacheResult = await cacheService.read(
      urlService.createLeafletURL(created)
    );
    expect(cacheResult).toBeNull();
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkLeaflets?.length)
        ({ bulkLeaflets, bulkIds, response } = await createBulkLeaflets());
    });

    it(`POST ${basePath}/bulk`, async () => {
      expect(response.status).toBe(201);
      expect(bulkLeaflets.length).toBe(bulkPayload.length);
      // expect(
      //   bulkLeaflets.every((leaflet) => leaflet.hasErrors() === undefined)
      // ).toBe(true);
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
      const updatedLeaflets = bulkLeaflets.map((leaflet, i) => {
        const newFileContent = new LeafletFile(
          Object.assign(leaflet.xmlFileContent, {
            filename: "newFilename" + i,
          })
        );
        return new Leaflet({
          ...leaflet,
          xmlFileContent: newFileContent,
        });
      });
      const response = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        updatedLeaflets,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      const updated = response.data.map((data: any) => new Leaflet(data));
      updated.every((p: Leaflet, i: number) => {
        const newFileContent = new LeafletFile(
          Object.assign(p.xmlFileContent, {
            filename: "newFilename" + i,
          })
        );
        expect(p).not.toEqual(bulkLeaflets[i]);
        expect(p.xmlFileContent).toStrictEqual(newFileContent);
      });
      updated.every((p: Leaflet, i: number) => {
        expect(p.equals(bulkLeaflets[i])).toBe(false);
        expect(
          p.equals(bulkLeaflets[i], "version", "updatedAt", "xmlFileContent")
        ).toBe(true);
      });
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`DELETE ${basePath}/bulk`, async () => {
      const response = await axios.delete(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        { headers: headers() }
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
      const leaflets = response.data.map((data: any) => new Leaflet(data));
      leaflets.every((leaflet: Leaflet) =>
        expect(leaflet).toBeInstanceOf(Leaflet)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      const response = await axios.get(
        `${host}${basePath}/findBy/productCode/${encodeURIComponent(
          created.productCode
        )}?direction=asc`,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      const leaflets = response.data.map((data: any) => new Leaflet(data));
      leaflets.every((leaflet: Leaflet) =>
        expect(leaflet).toBeInstanceOf(Leaflet)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}`, async () => {
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/productCode/${page}?direction=asc&limit=5&offset=1`,
        { headers: headers() }
      );

      expect(response.status).toBe(200);
      const leaflets = response.data.data.map((data: any) => new Leaflet(data));
      expect(leaflets.length >= 2 && leaflets.length <= 5).toBe(true);
      leaflets.every((leaflet: Leaflet) =>
        expect(leaflet).toBeInstanceOf(Leaflet)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/{method=listBy}/{args}`, async () => {
    // Ensure leaflets exist in db
    if (!bulkLeaflets?.length) await createBulkLeaflets();
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/productCode/asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leaflets = response.data.map((data: any) => new Leaflet(data));
    leaflets.every((leaflet: Leaflet) =>
      expect(leaflet).toBeInstanceOf(Leaflet)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/{method=paginateBy}/{args}`, async () => {
    // Ensure leaflets exist in db
    if (!bulkLeaflets?.length) await createBulkLeaflets();
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/productCode?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leaflets = response.data.data.map((data: any) => new Leaflet(data));
    leaflets.every((leaflet: Leaflet) =>
      expect(leaflet).toBeInstanceOf(Leaflet)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
