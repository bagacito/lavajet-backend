import { Buffer } from "buffer";
import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import {
  Batch,
  LeafletType,
  Product,
} from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import {
  buildBatchPayload,
  buildLeafletPayload,
  buildProductPayload,
} from "./payload-builders";

jestOpenAPI(path.join(__dirname, "../../@bagacito/lavajet-backend.json"));

const authHeaders = (token: string, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${token}`,
  "x-auth-request-access-token": token,
  ...extra,
});

describe("Integration Legacy API", () => {
  let token = "";
  let sharedProduct: Product;
  let sharedBatch: Batch;
  let createdBatch: Batch;
  let createdProduct: Product;
  const lang = "en";
  const epiType = "leaflet";
  const epiMarket = "BR";

  beforeAll(async () => {
    token = await authenticate();
    sharedProduct = buildProductPayload();
    await axios.post(`${host}/integration/product`, sharedProduct, {
      headers: authHeaders(token),
    });

    sharedBatch = buildBatchPayload({
      productCode: sharedProduct.productCode,
    });
    await axios.post(
      `${host}/integration/batch/${sharedProduct.productCode}/${sharedBatch.batchNumber}`,
      sharedBatch,
      { headers: authHeaders(token) }
    );

    await axios.post(
      `${host}/integration/epi/${sharedProduct.productCode}/${lang}/${epiType}`,
      buildLeafletPayload({
        productCode: sharedProduct.productCode,
        leafletType: LeafletType.leaflet,
        lang,
        epiMarket,
      }),
      { headers: authHeaders(token) }
    );

    await axios.post(
      `${host}/integration/epi/${sharedProduct.productCode}/${sharedBatch.batchNumber}/${lang}/${epiType}`,
      buildLeafletPayload({
        productCode: sharedProduct.productCode,
        batchNumber: sharedBatch.batchNumber,
        leafletType: LeafletType.leaflet,
        lang,
        epiMarket,
      }),
      { headers: authHeaders(token) }
    );
  });

  it("GET /integration/account/info", async () => {
    const response = await axios.get(`${host}/integration/account/info`, {
      headers: authHeaders(token),
    });
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it.skip("GET /integration/audit/{logType}", async () => {
    const response = await axios.get(
      `${host}/integration/audit/log-type`,
      {
        headers: authHeaders(token),
        params: {
          query: "test",
          start: 0,
          sort: "asc",
          number: 10,
        },
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it.skip("POST /integration/audit/{logType}", async () => {
    const response = await axios.post(
      `${host}/integration/audit/log-type`,
      { message: "test" },
      { headers: authHeaders(token) }
    );
    expect(response.status).toBe(201);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("GET /integration/batch/batch/listBatchLangs/{gtin}/{batchNumber}/{epiType}", async () => {
    const response = await axios.get(
      `${host}/integration/batch/batch/listBatchLangs/${sharedProduct.productCode}/${sharedBatch.batchNumber}/${epiType}`,
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("GET /integration/batch/batch/listBatches", async () => {
    const response = await axios.get(`${host}/integration/batch/batch/listBatches`, {
      headers: authHeaders(token),
    });
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("GET /integration/batch/{productCode}/{batchNumber}", async () => {
    const response = await axios.get(
      `${host}/integration/batch/${sharedProduct.productCode}/${sharedBatch.batchNumber}`,
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("POST /integration/batch/{productCode}/{batchNumber}", async () => {
    const payload = buildBatchPayload({
      productCode: sharedProduct.productCode,
    });
    const response = await axios.post(
      `${host}/integration/batch/${payload.productCode}/${payload.batchNumber}`,
      payload,
      { headers: authHeaders(token) }
    );
    expect(response.status).toBe(201);
    createdBatch =
      response.data && typeof response.data === "object"
        ? new Batch(response.data)
        : payload;
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("PUT /integration/batch/{productCode}/{batchNumber}", async () => {
    const payload = new Batch({
      ...createdBatch,
      manufacturerName: `${createdBatch.manufacturerName ?? "Updated"}-updated`,
    });
    const response = await axios.put(
      `${host}/integration/batch/${payload.productCode}/${payload.batchNumber}`,
      payload,
      { headers: authHeaders(token) }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("GET /integration/product", async () => {
    const response = await axios.get(`${host}/integration/product`, {
      headers: authHeaders(token),
    });
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("POST /integration/product", async () => {
    const payload = buildProductPayload();
    const response = await axios.post(`${host}/integration/product`, payload, {
      headers: authHeaders(token),
    });
    expect(response.status).toBe(201);
    createdProduct =
      response.data && typeof response.data === "object"
        ? new Product(response.data)
        : payload;
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("GET /integration/product/{productCode}", async () => {
    const response = await axios.get(
      `${host}/integration/product/${createdProduct.productCode}`,
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("PUT /integration/product/{productCode}", async () => {
    const payload = new Product({
      ...createdProduct,
      inventedName: `${createdProduct.inventedName}-updated`,
    });
    const response = await axios.put(
      `${host}/integration/product/${payload.productCode}`,
      payload,
      { headers: authHeaders(token) }
    );
    createdProduct = new Product(response.data);
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("GET /integration/product/{productCode}/langs/{epiType}", async () => {
    const response = await axios.get(
      `${host}/integration/product/${sharedProduct.productCode}/langs/${epiType}`,
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("GET /integration/product/{productCode}/markets/{epiType}", async () => {
    const response = await axios.get(
      `${host}/integration/product/${sharedProduct.productCode}/markets/${epiType}`,
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("POST /integration/epi/{gtin}/{lang}/{epiType}", async () => {
    const response = await axios.post(
      `${host}/integration/epi/${createdProduct.productCode}/${lang}/${epiType}`,
      buildLeafletPayload({
        productCode: createdProduct.productCode,
        leafletType: LeafletType.leaflet,
        lang,
        epiMarket,
      }),
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(201);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("PUT /integration/epi/{gtin}/{lang}/{epiType}", async () => {
    const payload = buildLeafletPayload({
      productCode: createdProduct.productCode,
      leafletType: LeafletType.leaflet,
      lang,
      epiMarket,
      xmlFileContent: Buffer.from("updated").toString("base64"),
    });
    const response = await axios.put(
      `${host}/integration/epi/${createdProduct.productCode}/${lang}/${epiType}`,
      payload,
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("POST /integration/epi/{gtin}/{batchNumber}/{lang}/{epiType}", async () => {
    const response = await axios.post(
      `${host}/integration/epi/${createdProduct.productCode}/${createdBatch.batchNumber}/${lang}/${epiType}`,
      buildLeafletPayload({
        productCode: createdProduct.productCode,
        batchNumber: createdBatch.batchNumber,
        leafletType: LeafletType.leaflet,
        lang,
        epiMarket,
      }),
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(201);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("PUT /integration/epi/{gtin}/{batchNumber}/{lang}/{epiType}", async () => {
    const payload = buildLeafletPayload({
      productCode: createdProduct.productCode,
      batchNumber: createdBatch.batchNumber,
      leafletType: LeafletType.leaflet,
      lang,
      epiMarket,
      xmlFileContent: Buffer.from("updated-batch").toString("base64"),
    });
    const response = await axios.put(
      `${host}/integration/epi/${createdProduct.productCode}/${createdBatch.batchNumber}/${lang}/${epiType}`,
      payload,
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("POST /integration/epi/{gtin}/{lang}/{epiType}/{epiMarket}", async () => {
    const response = await axios.post(
      `${host}/integration/epi/${createdProduct.productCode}/${lang}/${epiType}/${epiMarket}`,
      buildLeafletPayload({
        productCode: createdProduct.productCode,
        leafletType: LeafletType.leaflet,
        lang,
        epiMarket,
        xmlFileContent: Buffer.from("market").toString("base64"),
      }),
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(201);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it("PUT /integration/epi/{gtin}/{lang}/{epiType}/{epiMarket}", async () => {
    const payload = buildLeafletPayload({
      productCode: createdProduct.productCode,
      leafletType: LeafletType.leaflet,
      lang,
      epiMarket,
      xmlFileContent: Buffer.from("market-updated").toString("base64"),
    });
    const response = await axios.put(
      `${host}/integration/epi/${createdProduct.productCode}/${lang}/${epiType}/${epiMarket}`,
      payload,
      {
        headers: authHeaders(token),
      }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
