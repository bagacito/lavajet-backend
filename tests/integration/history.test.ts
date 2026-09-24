import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { History } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { Model } from "@decaf-ts/decorator-validation";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("History API", () => {
  const basePath = "/history";
  let token = "";
  let created: History;
  let createdRaw: any;
  let bulkHistories: History[] = [];
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
    if (!created) response = await createHistory();
  });

  const createHistory = async () => {
    const response = await axios.get(`${host}${basePath}/listBy/table`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    if (!response.data?.length) throw "No History records found in database";
    createdRaw = response.data[0];
    created = new History(response.data[0]);
    return response;
  };

  const createBulkHistory = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/table?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response?.status).toBe(200);
    bulkHistories = response.data
      .slice(0, 5)
      .map((item: any) => new History(item));
    bulkIds = bulkHistories.map((h) => h.id as string);
    createdRaw = response.data;
    return { bulkHistories, bulkIds, response };
  };

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  it(`GET ${basePath}/{table}/{key}/{version}`, async () => {
    const res = await axios.get(`${host}${basePath}/${Model.pk(created)}`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();

    await expect(
      axios.get(
        `${host}${basePath}/${Model.pk(new History({ id: "nonexistent:nonexistent:0" }))}`,
        {
          headers: headers(),
        }
      )
    ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`POST ${basePath}`, async () => {
    await expect(
      axios.post(`${host}${basePath}`, createdRaw, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`PUT ${basePath}/{id}`, async () => {
    await expect(
      axios.put(
        `${host}${basePath}/${Model.pk(created)}`,
        new History(createdRaw),
        { headers: headers() }
      )
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`DELETE ${basePath}/{id}`, async () => {
    await expect(
      axios.delete(`${host}${basePath}/${Model.pk(created)}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkHistories?.length)
        ({ bulkHistories, bulkIds, response } = await createBulkHistory());
    });

    it(`POST ${basePath}/bulk`, async () => {
      await expect(
        axios.post(`${host}${basePath}/bulk`, [createdRaw, createdRaw], {
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
      await expect(
        axios.put(
          `${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`,
          bulkHistories,
          {
            headers: headers(),
          }
        )
      ).rejects.toThrow(/Request failed with status code 406/);
    });

    it(`DELETE ${basePath}/bulk`, async () => {
      await expect(
        axios.delete(`${host}${basePath}/bulk?ids=${bulkIds.join("&ids=")}`, {
          headers: headers(),
        })
      ).rejects.toThrow(/Request failed with status code 406/);
    });
  });

  it(`GET ${basePath}/listBy/{key}`, async () => {
    const res = await axios.get(
      `${host}${basePath}/listBy/table?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    if (!bulkHistories?.length) await createBulkHistory();
    const res = await axios.get(
      `${host}${basePath}/findBy/table/${encodeURIComponent(bulkHistories[0].table)}?direction=asc`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/paginateBy/{key}`, async () => {
    const key = "table";
    const page = 1;
    const response = await axios.get(
      `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const batches = response.data.data.map((data: any) => new History(data));
    expect(batches.length >= 2 && batches.length <= 5).toBe(true);
    batches.every((h: History) => expect(h).toBeInstanceOf(History));
    expect(response.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/listBy/table/asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/paginateBy/table?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();
  });
});
