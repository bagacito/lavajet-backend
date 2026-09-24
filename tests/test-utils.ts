const pathParamDefaults: Record<string, string> = {
  account: "account-123",
  args: "test-args",
  batchNumber: "batch-123",
  epiMarket: "epi-market",
  epiType: "epi-type",
  field: "test-field",
  filename: "file.pdf",
  gtin: "4006381333931",
  id: "id-123",
  key: "test-key",
  lang: "en",
  leafletId: "leaflet-123",
  leafletType: "leaflet-type",
  logType: "log-type",
  marketId: "market-id",
  method: "test-method",
  module: "test-module",
  name: "test-name",
  number: "123",
  page: "1",
  productCode: "test-product-code",
  query: "test-query",
  sort: "asc",
  start: "0",
  value: "test-value",
};

export const fillPathParams = (template: string): string =>
  template.replace(/\{([^}]+)\}/g, (_, key) => pathParamDefaults[key] ?? `test-${key}`);

const queryParamDefaults: Record<string, unknown> = {
  account: "account-123",
  args: "test-args",
  batchNumber: "batch-123",
  direction: "asc",
  epiMarket: "epi-market",
  epiType: "epi-type",
  field: "test-field",
  filename: "file.pdf",
  gtin: "4006381333931",
  ids: ["id-123"],
  key: "test-key",
  lang: "en",
  leafletId: "leaflet-123",
  leafletType: "leaflet-type",
  limit: "10",
  logType: "log-type",
  marketId: "market-id",
  method: "test-method",
  module: "test-module",
  name: "test-name",
  number: "123",
  offset: "0",
  page: "1",
  productCode: "test-product-code",
  query: "test-query",
  sort: "asc",
  start: "0",
  value: "test-value",
};

export const getQueryParams = (names: string[]): Record<string, unknown> => {
  return names.reduce((query, name) => {
    query[name] = queryParamDefaults[name] ?? `test-${name}`;
    return query;
  }, {} as Record<string, unknown>);
};

const headerParamDefaults: Record<string, string> = {
  "x-auth-request-access-token": "test-token",
};

export const getHeaderParams = (names: string[]): Record<string, string> => {
  return names.reduce((headers, name) => {
    if (headerParamDefaults[name]) {
      headers[name] = headerParamDefaults[name];
    } else {
      headers[name] = "test-header";
    }
    return headers;
  }, {} as Record<string, string>);
};

type PayloadMethod = "post" | "put" | "patch";

const requestPayloads: Record<PayloadMethod, Record<string, unknown>> = {
  post: {
    data: "test-post",
  },
  put: {
    data: "test-put",
  },
  patch: {
    data: "test-patch",
  },
};

export const getRequestPayload = (method: PayloadMethod): Record<string, unknown> =>
  requestPayloads[method];
