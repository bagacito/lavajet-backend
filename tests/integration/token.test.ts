import path from "path";
import axios, { AxiosResponse } from "axios";
import jestOpenAPI from "jest-openapi";
import { Token } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildTokenPayload } from "./payload-builders";

jestOpenAPI(
  path.join(__dirname, "../../@bagacito/lavajet-backend.json")
);

describe("Token API", () => {
  const basePath = "/token";
  let token = "";
  let created: Token;
  let createdRaw: any;
  let bulkTokens: Token[] = [];
  let bulkIds: string[] = [];
  let response: AxiosResponse;
  const skipCreateTags = ["bulk", "logs in"];

  const headers = () => ({ Authorization: `Bearer ${token}` });
  const resourcePath = (record: Token) => `${basePath}/${record.id}`;

  beforeEach(async () => {
    token = await authenticate();
    const running = expect.getState().currentTestName?.toLowerCase();
    if (skipCreateTags.some((t) => running?.includes(t))) return;
    if (!created) response = await createToken();
  });

  const createToken = async () => {
    const payload = buildTokenPayload();
    const resp = await axios.post(`${host}${basePath}`, payload, {
      headers: headers(),
    });
    expect(resp.status).toBe(201);
    created = new Token(resp.data);
    createdRaw = resp.data;
    expect(created.hasErrors()).toBeUndefined();
    return resp;
  };

  const createBulkTokens = async () => {
    const payload = [buildTokenPayload(), buildTokenPayload()];
    const resp = await axios.post(`${host}${basePath}/bulk`, payload, {
      headers: headers(),
    });
    expect(resp.status).toBe(201);
    bulkTokens = resp.data.map((item: any) => new Token(item));
    bulkIds = bulkTokens.map((record) => record.id);
    return { bulkTokens, bulkIds, response: resp };
  };

  it("logs in", async () => {
    expect(token).toBeDefined();
  });

  it(`POST ${basePath}`, async () => {
    expect(response.status).toBe(201);
    expect(created.hasErrors()).toBeUndefined();
    expect({ ...response, body: response.data }).toSatisfyApiSpec();

    // verify it can be retrieved
    const persisted = await axios.get(`${host}${resourcePath(created)}`, {
      headers: headers(),
    });
    expect(persisted.status).toBe(200);
    const persistedToken = new Token(persisted.data);
    expect(persistedToken).toEqual(created);

    // invalid payload should throw 422
    const invalid = new Token({
      ...created,
      id: "",
    });
    expect(invalid.hasErrors()).toBeDefined();
    await expect(
      axios.post(`${host}${basePath}`, invalid, { headers: headers() })
    ).rejects.toThrow(/422/);

    // duplicate creation should give 409
    await expect(
      axios.post(`${host}${basePath}`, created, { headers: headers() })
    ).rejects.toThrow(/409/);
  });

  it(`GET ${basePath}/{id}`, async () => {
    const response = await axios.get(`${host}${resourcePath(created)}`, {
      headers: headers(),
    });

    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`PUT ${basePath}/{id}`, async () => {
    const response = await axios.put(
      `${host}${resourcePath(created)}`,
      new Token({
        ...createdRaw,
        active: !created.active,
        claimed: !created.claimed,
      }),
      {
        headers: headers(),
      }
    );

    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();

    await expect(
      axios.put(`${host}${basePath}/doesnotexist`, {}, { headers: headers() })
    ).rejects.toThrow(/404/);
  });

  it(`DELETE ${basePath}/{id}`, async () => {
    const response = await axios.delete(`${host}${resourcePath(created)}`, {
      headers: headers(),
    });

    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();

    await expect(
      axios.delete(`${host}${resourcePath(created)}`, { headers: headers() })
    ).rejects.toThrow(/404/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkTokens?.length) {
        ({ bulkTokens, bulkIds, response } = await createBulkTokens());
      }
    });

    it(`POST ${basePath}/bulk`, async () => {
      ({ bulkTokens, bulkIds, response } = await createBulkTokens());
      expect(
        bulkTokens.every((record) => record.hasErrors() === undefined)
      ).toBe(true);
      expect({ ...response, body: response.data }).toSatisfyApiSpec();
    });

    it(`GET ${basePath}/bulk`, async () => {
      const resp = await axios.get(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        { headers: headers() }
      );

      expect(resp.status).toBe(200);
      const read = resp.data.map((item: any) => new Token(item));
      expect(read.length).toBe(bulkTokens.length);
      expect(
        read.every((entry, index) => entry.equals(bulkTokens[index]))
      ).toBe(true);
      expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
    });

    it(`PUT ${basePath}/bulk`, async () => {
      const payload = bulkTokens.map(
        (record) =>
          new Token({
            ...record,
            active: !record.active,
          })
      );
      const resp = await axios.put(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        payload,
        { headers: headers() }
      );

      expect(resp.status).toBe(200);
      expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
    });

    it(`DELETE ${basePath}/bulk`, async () => {
      const resp = await axios.delete(
        `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
        { headers: headers() }
      );
      expect(resp.status).toBe(200);
      expect({ ...resp, body: resp.data }).toSatisfyApiSpec();
    });
  });

  it(`GET ${basePath}/listBy/{key}`, async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/mspid?direction=asc`,
      { headers: headers() }
    );

    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    const value = encodeURIComponent(bulkTokens[0].mspid);
    const response = await axios.get(
      `${host}${basePath}/findBy/mspid/${value}?direction=asc`,
      { headers: headers() }
    );

    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/paginateBy/{key}`, async () => {
    const response = await axios.get(
      `${host}${basePath}/paginateBy/id?direction=asc&limit=5&offset=0`,
      { headers: headers() }
    );

    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const response = await axios.get(
      `${host}${basePath}/statement/listBy/mspid/asc`,
      { headers: headers() }
    );

    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const response = await axios.get(
      `${host}${basePath}/statement/paginateBy/id?direction=asc&limit=5&offset=0`,
      { headers: headers() }
    );

    expect(response.status).toBe(200);
    expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
