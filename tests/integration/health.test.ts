import path from "path";
import axios from "axios";
import jestOpenAPI from "jest-openapi";
import { host, authenticate } from "./integration-env";

// jestOpenAPI(
//   path.join(__dirname, "../../@bagacito/lavajet-backend.json")
// );

describe("Health API", () => {
  let token = "";

  beforeEach(async () => {
    token = await authenticate();
  });

  it("GET /health", async () => {
    const response = await axios.get(`${host}/health`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(200);
    // expect({ ...response, body: response.data }).toSatisfyApiSpec();
  });
});
