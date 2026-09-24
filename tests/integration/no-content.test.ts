import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { host, authenticate } from "./integration-env";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("No Content API", () => {
  let token = "";

  beforeEach(async () => {
    token = await authenticate();
  });

  it("GET /no-content", async () => {
    const response = await axios.get(`${host}/no-content`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(204);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
