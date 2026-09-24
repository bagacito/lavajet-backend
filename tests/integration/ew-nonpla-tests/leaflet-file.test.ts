import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { LeafletFile } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "../integration-env";
import { buildLeafletFilePayload } from "../payload-builders";

jestOpenAPI(
  path.join(__dirname, "../../@bagacito/lavajet-backend.json")
);

describe("Leaflet File API", () => {
  const basePath = "/leaflet-file";
  let token = "";
  let created: LeafletFile;
  let createdRaw: any;
  let bulkFiles: LeafletFile[] = [];
  let bulkIds: string[] = [];

  const headers = () => ({ Authorization: `Bearer ${token}` });

  beforeEach(async () => {
    token = await authenticate();
  });

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  const payload = buildLeafletFilePayload();
  const bulkPayload = [buildLeafletFilePayload(), buildLeafletFilePayload()];

  const createLeafletFile = async () => {
    const response = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(response.status).toBe(201);
    createdRaw = response.data;
    return new LeafletFile(response.data);
  };
  const createBulkLeafletFiles = async () => {
    const response = (
      await axios.post(`${host}${basePath}/bulk`, bulkPayload, {
        headers: headers(),
      })
    )?.data;
    bulkFiles = response?.map((file: LeafletFile) => new LeafletFile(file));
    bulkIds = bulkFiles?.map((file) => file.id) as string[];
    createdRaw = response;
    return { bulkFiles, bulkIds };
  };

  it(`POST ${basePath}`, async () => {
    const response = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(response.status).toBe(201);
    created = new LeafletFile(response.data);
    createdRaw = response.data;
    expect(created.hasErrors()).toBeUndefined();
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/{leafletId}/{fileName}`, async () => {
    if (!created) created = await createLeafletFile();
    const response = await axios.get(
      `${host}${basePath}/${created.leafletId}/${created.fileName}`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`PUT ${basePath}/{id}`, async () => {
    if (!created) created = await createLeafletFile();
    const newResolver = new LeafletFile({
      ...createdRaw,
      fileContent: `${created.fileContent}-updated`,
    });
    await expect(
      axios.put(`${host}${basePath}/${created.id}`, newResolver, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 500/);

    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`DELETE ${basePath}/{id}`, async () => {
    if (!created) created = await createLeafletFile();
    await expect(
      axios.delete(`${host}${basePath}/${created.id}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 500/);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`POST ${basePath}/bulk`, async () => {
    const response = await axios.post(`${host}${basePath}/bulk`, bulkPayload, {
      headers: headers(),
    });
    expect(response.status).toBe(201);
    bulkFiles = response.data.map((item: any) => new LeafletFile(item));
    expect(bulkFiles.every((file) => file.hasErrors() === undefined)).toBe(
      true
    );
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/bulk`, async () => {
    if (!bulkFiles?.length || !bulkIds?.length)
      ({ bulkFiles, bulkIds } = await createBulkLeafletFiles());
    const response = await axios.get(
      `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`PUT ${basePath}/bulk`, async () => {
    if (!bulkIds || bulkFiles)
      ({ bulkFiles, bulkIds } = await createBulkLeafletFiles());
    const updatedLeaflets = bulkFiles.map(
      (leaflet, i) =>
        new LeafletFile({
          ...leaflet,
          fileContent: `${leaflet.fileContent}-bulk${i}-updated`,
        })
    );
    await expect(
      axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        updatedLeaflets,
        { headers: headers() }
      )
    ).rejects.toThrow(/Request failed with status code 500/);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`DELETE ${basePath}/bulk`, async () => {
    if (!bulkIds) ({ bulkIds } = await createBulkLeafletFiles());
    await expect(
      axios.delete(`${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 500/);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/listBy/{key}`, async () => {
    // Ensure products exist in db
    if (!bulkFiles?.length) await createBulkLeafletFiles();
    const response = await axios.get(
      `${host}${basePath}/listBy/fileName?direction=asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletFiles = response.data.map(
      (data: any) => new LeafletFile(data)
    );
    leafletFiles.every((file: LeafletFile) =>
      expect(file).toBeInstanceOf(LeafletFile)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    if (!created) created = await createLeafletFile();
    const response = await axios.get(
      `${host}${basePath}/findBy/fileName/${encodeURIComponent(
        created.fileName
      )}?direction=asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletFiles = response.data.map(
      (data: any) => new LeafletFile(data)
    );
    leafletFiles.every((file: LeafletFile) =>
      expect(file).toBeInstanceOf(LeafletFile)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/paginateBy/{key}`, async () => {
    // Ensure products exist in db
    if (!bulkFiles?.length) await createBulkLeafletFiles();
    let page = 1;
    const response = await axios.get(
      `${host}${basePath}/paginateBy/id/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletFiles = response.data.data.map(
      (data: any) => new LeafletFile(data)
    );
    leafletFiles.every((file: LeafletFile) =>
      expect(file).toBeInstanceOf(LeafletFile)
    );
    if (response.data.count <= 5) return;
    page++;
    const nextResponse = await axios.get(
      `${host}${basePath}/paginateBy/id/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(nextResponse.status).toBe(200);
    const nextLeafletFiles = nextResponse.data.data.map(
      (data: any) => new LeafletFile(data)
    );
    nextLeafletFiles.every((file: LeafletFile) =>
      expect(file).toBeInstanceOf(LeafletFile)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    // Ensure products exist in db
    if (!bulkFiles?.length) await createBulkLeafletFiles();
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/fileName/asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletFiles = response.data.map(
      (data: any) => new LeafletFile(data)
    );
    leafletFiles.every((file: LeafletFile) =>
      expect(file).toBeInstanceOf(LeafletFile)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    // Ensure products exist in db
    if (!bulkFiles?.length) await createBulkLeafletFiles();
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/id?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletFiles = response.data.data.map(
      (data: any) => new LeafletFile(data)
    );
    leafletFiles.every((file: LeafletFile) =>
      expect(file).toBeInstanceOf(LeafletFile)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
