import path from "path";
import { Model, ModelErrorDefinition } from "@decaf-ts/decorator-validation";
import jestOpenAPI from "jest-openapi";
import { CacheService, Product } from "@bagacito/lavajet-toolkit";
import axios, { AxiosResponse } from "axios";
import { buildProductPayload } from "./payload-builders";
import { host, authenticate } from "./integration-env";
import { URLService } from "../../../toolkit/src/shared/helpers/URLService";
import { generateGtin } from "../../../toolkit/tests/utils/gtin-generator";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Product API", () => {
  const basePath = "/product";
  let token = "";
  let created: Product;
  let bulkProducts: Product[] = [];
  let bulkProductCodes: string[] = [];
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
    if (!created) response = await createProduct();
  });

  const product = buildProductPayload();
  const requestProducts = [buildProductPayload(), buildProductPayload()];

  const createProduct = async () => {
    const response = await axios.post(`${host}${basePath}`, product, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response?.status).toBe(201);
    created = new Product(response.data);
    return response;
  };

  const createBulkProducts = async () => {
    const response = await axios.post(
      `${host}${basePath}/bulk`,
      requestProducts,
      {
        headers: headers(),
      }
    );

    expect(response?.status).toBe(201);
    bulkProducts = response?.data?.map(
      (product: Product) => new Product(product)
    );
    bulkProductCodes = bulkProducts?.map(
      (product) => product[Model.pk(Product)]
    ) as string[];
    return { bulkProducts, bulkProductCodes, response };
  };

  it("logs in", async () => {
    expect(token).toBeDefined();
  });

  it(`LAVAJET-308 POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    expect(created.hasErrors()).toBeUndefined();
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.productCode}`,
      {
        headers: headers(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedProduct = new Product(persistedResponse.data);
    // TODO fix the productStrength order issue
    expect(persistedProduct).toEqual(created);

    // Check that cached product is equal to
    const cacheResult = await cacheService.read(
      urlService.createOwnerURL(created.productCode)
    );
    expect(cacheResult).toBeDefined();

    const invalidProduct = new Product(
      Object.assign({}, created, {
        productCode: "invalidId",
      })
    );
    expect(invalidProduct.hasErrors()).toEqual(
      new ModelErrorDefinition({
        productCode: { gtin: "Not a valid Gtin" },
      })
    );

    // Confirm invalid product fails to 422
    await expect(
      axios.post(`${host}${basePath}`, invalidProduct, {
        headers: headers(),
      })
    ).rejects.toThrow(/422/);

    // attempting to recreate a product with existing gtin should result to 409
    await expect(
      axios.post(`${host}${basePath}`, persistedProduct, {
        headers: headers(),
      })
    ).rejects.toThrow(/409/);
  });

  it(`Lavajet 310 GET ${basePath}/{productCode}`, async () => {
    const response = await axios.get(
      `${host}${basePath}/${created.productCode}`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    await expect(
      axios.get(`${host}${basePath}/${generateGtin()}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`LAVAJET-309 PUT ${basePath}/{productCode}`, async () => {
    const newProduct = new Product(
      Object.assign({}, created, {
        inventedName: "new name",
      })
    );
    const response = await axios.put(
      `${host}${basePath}/${created.productCode}`,
      newProduct,
      {
        headers: headers(),
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.inventedName).toBe("new name");
    const updated = new Product(response.data);
    expect(updated.equals(created)).toBe(false);
    expect(updated.equals(newProduct, "updatedAt", "version")).toBe(true);
    expect(
      updated.equals(
        created,
        "version",
        "updatedAt",
        "updatedBy",
        "inventedName"
      )
    ).toBe(true);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.productCode}`,
      {
        headers: headers(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedProduct = new Product(persistedResponse.data);
    expect(persistedProduct).toEqual(updated);

    await expect(
      axios.put(`${host}${basePath}/${generateGtin()}`, newProduct, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it.skip(`Lavajet 311 DELETE ${basePath}/{productCode}`, async () => {
    if (!created) await createProduct();
    const response = await axios.delete(
      `${host}${basePath}/${created.productCode}`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);

    await expect(
      axios.delete(`${host}${basePath}/${created.productCode}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 404/);

    // Check that product no longer exists in cache
    const cacheResult = await cacheService.read(
      urlService.createOwnerURL(created.productCode)
    );
    expect(cacheResult).toBeNull();
  });

  describe("LAVAJET-307 Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkProducts?.length)
        ({ bulkProducts, bulkProductCodes, response } =
          await createBulkProducts());
    });

    it(`POST ${basePath}/bulk`, async () => {
      expect(response.status).toBe(201);
      expect(bulkProducts.length).toBe(requestProducts.length);
      expect(bulkProducts.every((p) => p.hasErrors() === undefined)).toBe(true);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/bulk`, async () => {
      const response = await axios.get(
        `${host}${basePath}/bulk?ids=${bulkProductCodes.join("&ids=")}`,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`PUT ${basePath}/bulk`, async () => {
      const updates = bulkProducts.map(
        (existing) =>
          new Product({
            productCode: existing.productCode,
            inventedName: `${existing.inventedName} updated`,
            nameMedicinalProduct: existing.nameMedicinalProduct,
            markets: existing.markets,
          })
      );

      const response = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkProductCodes.join("&ids=")}`,
        updates,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      const updated = response.data.map((data: any) => new Product(data));

      updated.every((p: Product, i: number) => {
        expect(p).not.toEqual(bulkProducts[i]);
        expect(p.inventedName).toBe(bulkProducts[i].inventedName + " updated");
      });
      updated.every((p: Product, i: number) => {
        expect(p.equals(bulkProducts[i])).toBe(false);
        expect(
          p.equals(bulkProducts[i], "version", "updatedAt", "inventedName")
        ).toBe(true);
      });
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it.skip("DELETE ${basePath}/bulk", async () => {
      const response = await axios.delete(
        `${host}${basePath}/bulk?ids=${bulkProductCodes.join("&ids=")}`,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  describe("LAVAJET-312 Search and Pagination", () => {
    it(`GET ${basePath}/listBy/{key}?direction=asc`, async () => {
      const key = "inventedName";
      const response = await axios.get(
        `${host}${basePath}/listBy/${key}?direction=asc`,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      const products = response.data.map((data: any) => new Product(data));
      products.every((product: Product) =>
        expect(product).toBeInstanceOf(Product)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      const key = "inventedName";
      const value = encodeURIComponent(created.inventedName);
      const response = await axios.get(
        `${host}${basePath}/findBy/${key}/${value}?direction=asc`,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      const products = response.data.map((data: any) => new Product(data));
      products.every((product: Product) =>
        expect(product).toBeInstanceOf(Product)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}/{page}`, async () => {
      // Ensure products exist in db
      if (!bulkProducts?.length) await createBulkProducts();
      const key = "productCode";
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
        {
          headers: headers(),
        }
      );

      expect(response.status).toBe(200);
      const products = response.data.data.map((data: any) => new Product(data));
      expect(products.length >= 2 && products.length <= 5).toBe(true);
      products.every((product: Product) =>
        expect(product).toBeInstanceOf(Product)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/{method=listBy}/{args}`, async () => {
    // Ensure products exist in db
    if (!bulkProducts?.length) await createBulkProducts();
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/inventedName?offset=1&limit=5&direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    const products = response.data.map((data: any) => new Product(data));
    products.every((product: Product) =>
      expect(product).toBeInstanceOf(Product)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/{method=paginateBy}/{args}`, async () => {
    // Ensure products exist in db
    if (!bulkProducts?.length) await createBulkProducts();
    const key = "inventedName";
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/${key}?direction=asc&limit=5&offset=1`,
      {
        headers: headers(),
      }
    );

    expect(response.status).toBe(200);
    const products = response.data.data.map((data: any) => new Product(data));
    products.every((product: Product) =>
      expect(product).toBeInstanceOf(Product)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
