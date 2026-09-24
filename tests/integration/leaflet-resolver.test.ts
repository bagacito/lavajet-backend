import path from "path";
import axios, { AxiosResponse } from "axios";
import jestOpenAPI from "jest-openapi";
import { LeafletResolver } from "@bagacito/lavajet-toolkit";
import { host } from "./integration-env";
import { buildLeafletResolverPayload } from "./payload-builders";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Leaflet Resolver API", () => {
  const basePath = "/leaflet-resolver";
  const token = process.env.EW_BACKEND_TEST_TOKEN;
  let tokenEmail = "";
  let created: LeafletResolver;
  let createdRaw: any;
  let bulkResolvers: LeafletResolver[] = [];
  let bulkIds: string[] = [];
  let response: AxiosResponse;

  const headers = () => ({ Authorization: `Bearer ${token}` });

  const decodeJwtPayload = (jwt: string): Record<string, any> => {
    const payload = jwt.split(".")[1];
    if (!payload) throw new Error("Invalid JWT");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  };

  beforeEach(async () => {
    if (!token) {
      throw new Error("Missing EW_BACKEND_TEST_TOKEN");
    }
    const payload = decodeJwtPayload(token);
    if (!payload.email) {
      throw new Error("Expected JWT to include an email claim");
    }
    tokenEmail = payload.email;
  });

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  const payload = buildLeafletResolverPayload();
  const bulkPayload = [
    buildLeafletResolverPayload(),
    buildLeafletResolverPayload(),
  ];

  const createLeafletResolver = async () => {
    const response = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(response.status).toBe(201);
    createdRaw = response.data;
    return new LeafletResolver(response.data);
  };
  const createBulkLeafletResolvers = async () => {
    const response = await axios.post(`${host}${basePath}/bulk`, bulkPayload, {
      headers: headers(),
    });
    bulkResolvers = response?.data?.map(
      (resolver: LeafletResolver) => new LeafletResolver(resolver)
    );
    bulkIds = bulkResolvers?.map((file) => file.id) as string[];
    createdRaw = response?.data;
    return { bulkResolvers, bulkIds, response };
  };

  it(`POST ${basePath}`, async () => {
    const response = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(response.status).toBe(201);
    created = new LeafletResolver(response.data);
    createdRaw = response.data;
    expect(created.hasErrors()).toBeUndefined();
    expect(created.createdBy).toBe(tokenEmail);
    expect(created.updatedBy).toBe(tokenEmail);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/{id}`, async () => {
    if (!created) created = await createLeafletResolver();
    const response = await axios.get(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`PUT ${basePath}/{id}`, async () => {
    if (!created) created = await createLeafletResolver();
    const newResolver = new LeafletResolver({
      ...createdRaw,
      urlString: `${created.urlString}-updated`,
    });
    const response = await axios.put(
      `${host}${basePath}/${created.id}`,
      newResolver,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    expect(response.data.urlString).toBe(`${created.urlString}-updated`);
    const updated = new LeafletResolver(response.data);
    expect(updated.equals(created)).toBe(false);
    expect(updated.equals(newResolver, "updatedAt", "version")).toBe(true);
    expect(
      updated.equals(created, "version", "updatedAt", "updatedBy", "urlString")
    ).toBe(true);
    expect(updated.createdBy).toBe(tokenEmail);
    expect(updated.updatedBy).toBe(tokenEmail);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`DELETE ${basePath}/{id}`, async () => {
    if (!created) created = await createLeafletResolver();
    const response = await axios.delete(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    await expect(
      axios.get(`${host}${basePath}/${created.id}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/404/);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkResolvers?.length)
        ({ bulkResolvers, bulkIds, response } =
          await createBulkLeafletResolvers());
    });

    it(`POST ${basePath}/bulk`, async () => {
      expect(response.status).toBe(201);
      bulkResolvers = response.data.map(
        (item: any) => new LeafletResolver(item)
      );
      expect(
        bulkResolvers.every((resolver) => resolver.hasErrors() === undefined)
      ).toBe(true);
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
      const payload = bulkResolvers.map(
        (resolver, i) =>
          new LeafletResolver({
            ...resolver,
            urlString: `${resolver.urlString}-bulk${i}-updated`,
          })
      );
      const response = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        payload,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      const updated = response.data.map(
        (data: any) => new LeafletResolver(data)
      );
      updated.every((p: LeafletResolver, i: number) => {
        expect(p).not.toEqual(bulkResolvers[i]);
        expect(p.urlString).toBe(
          `${bulkResolvers[i].urlString}-bulk${i}-updated`
        );
      });
      updated.every((p: LeafletResolver, i: number) => {
        expect(p.equals(bulkResolvers[i])).toBe(false);
        expect(
          p.equals(bulkResolvers[i], "version", "updatedAt", "urlString")
        ).toBe(true);
      });
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`DELETE ${basePath}/bulk`, async () => {
      const response = await axios.delete(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        { headers: headers() }
      );

      const deleted = response.data.map(
        (data: any) => new LeafletResolver(data)
      );
      deleted.every(
        async (deleted: LeafletResolver) =>
          await expect(
            axios.get(`${host}${basePath}/${deleted.id}`, {
              headers: headers(),
            })
          ).rejects.toThrow(/404/)
      );
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/listBy/{key}`, async () => {
    // Ensure products exist in db
    if (!bulkResolvers?.length) await createBulkLeafletResolvers();
    const response = await axios.get(
      `${host}${basePath}/listBy/updatedBy?direction=asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletResolvers = response.data.map(
      (data: any) => new LeafletResolver(data)
    );
    leafletResolvers.every((resolver: LeafletResolver) =>
      expect(resolver).toBeInstanceOf(LeafletResolver)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    created = await createLeafletResolver();
    const response = await axios.get(
      `${host}${basePath}/findBy/urlString/${encodeURIComponent(
        created.urlString
      )}?direction=asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletResolvers = response.data.map(
      (data: any) => new LeafletResolver(data)
    );
    leafletResolvers.every((resolver: LeafletResolver) =>
      expect(resolver).toBeInstanceOf(LeafletResolver)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/paginateBy/{key}`, async () => {
    // Ensure products exist in db
    if (!bulkResolvers?.length) await createBulkLeafletResolvers();
    let page = 1;
    const response = await axios.get(
      `${host}${basePath}/paginateBy/id/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);

    const leafletResolvers = response.data.data.map(
      (data: any) => new LeafletResolver(data)
    );
    leafletResolvers.every((resolver: LeafletResolver) =>
      expect(resolver).toBeInstanceOf(LeafletResolver)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    // Ensure products exist in db
    if (!bulkResolvers?.length) await createBulkLeafletResolvers();
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/updatedBy/asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletResolvers = response.data.map(
      (data: any) => new LeafletResolver(data)
    );
    leafletResolvers.every((resolver: LeafletResolver) =>
      expect(resolver).toBeInstanceOf(LeafletResolver)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    // Ensure products exist in db
    if (!bulkResolvers?.length) await createBulkLeafletResolvers();
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/id?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const leafletResolvers = response.data.data.map(
      (data: any) => new LeafletResolver(data)
    );
    leafletResolvers.every((resolver: LeafletResolver) =>
      expect(resolver).toBeInstanceOf(LeafletResolver)
    );
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
