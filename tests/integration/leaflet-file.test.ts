import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { LeafletFile } from "@bagacito/lavajet-toolkit";
import { host, authenticate } from "./integration-env";
import { buildLeafletFilePayload } from "./payload-builders";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Leaflet File API", () => {
  const basePath = "/leaflet-file";
  let token = "";
  let created: LeafletFile;
  let createdRaw: any;
  let bulkFiles: LeafletFile[] = [];
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
    if (!created) response = await createLeafletFile();
  });

  const createLeafletFile = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/leafletId?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response.status).toBe(200);
    if (!response.data?.length) throw "No LeafletFiles found in database";
    createdRaw = response.data[0];
    created = new LeafletFile(createdRaw);
    return response;
  };

  const createBulkLeafletFiles = async () => {
    const response = await axios.get(
      `${host}${basePath}/listBy/leafletId?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(response?.status).toBe(200);
    bulkFiles = response.data
      .slice(0, 5)
      .map((item: any) => new LeafletFile(item));
    bulkIds = bulkFiles.map((s) => s.id as string);
    createdRaw = response.data;
    return { bulkFiles, bulkIds, response };
  };

  it("logs in", () => {
    expect(token).toBeDefined();
  });

  it(`LAVAJET-POST POST ${basePath}`, async () => {
    await expect(
      axios.post(`${host}${basePath}`, buildLeafletFilePayload(), {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-GET GET ${basePath}/{leafletId}/{fileName}`, async () => {
    const res = await axios.get(
      `${host}${basePath}/${created.leafletId}/${created.fileName}`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
    // expect({ ...res, body: res.data }).toSatisfyApiSpec();

    // await expect(
    //   axios.get(`${host}${basePath}/nonexistent/nonexistent1`, {
    //     headers: headers(),
    //   })
    // ).rejects.toThrow(/Request failed with status code 404/);
  });

  it(`LAVAJET-PUT PUT ${basePath}/{id}`, async () => {
    await expect(
      axios.put(
        `${host}${basePath}/${created.id}`,
        new LeafletFile({
          ...createdRaw,
          fileContent: `${(created as any).fileContent}-updated`,
        }),
        { headers: headers() }
      )
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  it(`LAVAJET-DELETE DELETE ${basePath}/{id}`, async () => {
    await expect(
      axios.delete(`${host}${basePath}/${created.id}`, {
        headers: headers(),
      })
    ).rejects.toThrow(/Request failed with status code 406/);
  });

  describe("Bulk Operations", () => {
    beforeEach(async () => {
      if (!bulkFiles?.length)
        ({ bulkFiles, bulkIds, response } = await createBulkLeafletFiles());
    });

    it(`POST ${basePath}/bulk`, async () => {
      const payload = [buildLeafletFilePayload(), buildLeafletFilePayload()];
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
      const payload = bulkFiles.map(
        (s) =>
          new LeafletFile({
            ...s,
            fileContent: `${(s as any).fileContent}-bulk`,
          })
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
      `${host}${basePath}/listBy/fileName?direction=asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
  });

  it(`GET ${basePath}/findBy/{key}/{value}`, async () => {
    if (!bulkFiles?.length) await createBulkLeafletFiles();
    const res = await axios.get(
      `${host}${basePath}/findBy/fileName/${encodeURIComponent(
        bulkFiles[0].fileName
      )}?direction=asc`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
  });

  it(`GET ${basePath}/paginateBy/{key}`, async () => {
    const key = "fileName";
    const page = 1;
    const response = await axios.get(
      `${host}${basePath}/paginateBy/${key}/${page}?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(response.status).toBe(200);
    const batches = response.data.data.map(
      (data: any) => new LeafletFile(data)
    );
    expect(batches.length >= 2 && batches.length <= 5).toBe(true);
    batches.every((ps: LeafletFile) => expect(ps).toBeInstanceOf(LeafletFile));
    expect(response.status).toBe(200);
  });

  it(`GET ${basePath}/statement/listBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/listBy/fileName/asc`,
      {
        headers: headers(),
      }
    );
    expect(res.status).toBe(200);
  });

  it(`GET ${basePath}/statement/paginateBy`, async () => {
    const res = await axios.get(
      `${host}${basePath}/statement/paginateBy/fileName?direction=asc&limit=5&offset=1`,
      { headers: headers() }
    );
    expect(res.status).toBe(200);
  });
});
