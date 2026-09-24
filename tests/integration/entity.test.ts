import path from "path";
import axios, { AxiosResponse } from "axios";
import jestOpenAPI from "jest-openapi";
import { Entity } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildEntityPayload } from "./payload-builders";
import { Model } from "@decaf-ts/decorator-validation";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Entity API", () => {
  const basePath = "/entity";
  let token = "";
  let created: Entity;
  let bulkEntities: Entity[] = [];
  let bulkIds: string[] = [];
  let response: AxiosResponse;
  const skipCreateTags = ["bulk", "logs in"];

  const headers = () => ({ Authorization: `Bearer ${token}` });

  beforeEach(async () => {
    token = await authenticate();
    const runningTestName = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => runningTestName?.includes(t))) return;
    if (!created) response = await createEntity();
  });

  const entity = buildEntityPayload();
  const requestEntities = [buildEntityPayload(), buildEntityPayload()];

  const createEntity = async () => {
    const response = await axios.post(`${host}${basePath}`, entity, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response?.status).toBe(201);
    created = new Entity(response.data);
    return response;
  };

  const createBulkEntities = async () => {
    const response = await axios.post(
      `${host}${basePath}/bulk`,
      requestEntities,
      {
        headers: headers(),
      }
    );

    expect(response?.status).toBe(201);
    bulkEntities = response?.data?.map((entity: Entity) => new Entity(entity));
    bulkIds = bulkEntities?.map(
      (entity) => entity[Model.pk(Entity)]
    ) as string[];
    return { bulkEntities, bulkIds, response };
  };

  it("logs in", async () => {
    expect(token).toBeDefined();
  });

  it(`POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    created = new Entity(response.data);
    expect(created.hasErrors()).toBeUndefined();
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.id}`,
      {
        headers: headers(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedEntity = new Entity(persistedResponse.data);
    expect(persistedEntity).toEqual(created);
  });

  it(`GET ${basePath}/{id}`, async () => {
    const response = await axios.get(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`PUT ${basePath}/{id}`, async () => {
    const newEntity = new Entity({
      ...created,
      endpoint: `${created.endpoint}.updated`,
    });

    const response = await axios.put(
      `${host}${basePath}/${created.id}`,
      newEntity,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    expect(response.data.endpoint).toBe(newEntity.endpoint);
    const updated = new Entity(response.data);
    expect(updated.equals(created)).toBe(false);
    expect(updated.equals(newEntity, "updatedAt", "version")).toBe(true);
    expect(
      updated.equals(created, "version", "updatedAt", "updatedBy", "endpoint")
    ).toBe(true);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();

    const persistedResponse = await axios.get(
      `${host}${basePath}/${created.id}`,
      {
        headers: headers(),
      }
    );
    expect(persistedResponse.status).toBe(200);
    const persistedEntity = new Entity(persistedResponse.data);
    expect(persistedEntity).toEqual(updated);
  });

  it(`DELETE ${basePath}/{id}`, async () => {
    const response = await axios.delete(`${host}${basePath}/${created.id}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkEntities?.length)
        ({ bulkEntities, bulkIds, response } = await createBulkEntities());
    });

    it(`POST ${basePath}/bulk`, async () => {
      expect(response.status).toBe(201);
      expect(bulkEntities.length).toBe(requestEntities.length);
      expect(bulkEntities.every((e) => e.hasErrors() === undefined)).toBe(true);
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
      const updates = bulkEntities.map(
        (existing) =>
          new Entity({
            ...existing,
            endpoint: `${existing.endpoint}.bulk`,
          })
      );
      const response = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        updates,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      const updated = response.data.map((data: any) => new Entity(data));

      updated.every((e: Entity, i: number) => {
        expect(e).not.toEqual(bulkEntities[i]);
        expect(e.endpoint).toBe(bulkEntities[i].endpoint + ".bulk");
      });
      updated.every((e: Entity, i: number) => {
        expect(e.equals(bulkEntities[i])).toBe(false);
        expect(
          e.equals(bulkEntities[i], "version", "updatedAt", "endpoint")
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
    beforeEach(async () => {
      if (!bulkEntities?.length) await createBulkEntities();
    });

    it(`GET ${basePath}/listBy/{key}`, async () => {
      const response = await axios.get(
        `${host}${basePath}/listBy/id?direction=asc`,
        {
          headers: headers(),
        }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
      const response = await axios.get(
        `${host}${basePath}/findBy/id/${bulkEntities[0].id}?direction=asc`,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/paginateBy/{key}`, async () => {
      const key = "id";
      const page = 1;
      const response = await axios.get(
        `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
        { headers: headers() }
      );
      expect(response.status).toBe(200);
      // expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/id/asc`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const key = "id";
    const page = 1;
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
