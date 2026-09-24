export const AuthRoles = {
  PUBLIC: "public",
  LOCAL: "local",
  ADMIN: "admin",
  AUTH: "auth",
  GOD: "god",
};

export const BackendModes = {
  BOOT: "boot",
  MAINTENANCE: "maintenance",
  NORMAL: "normal",
};

/**
 * Path of the SSE events API (for-nest events module): the stream itself plus
 * its `subscribe`/`unsubscribe` endpoints live under it.
 */
export const EVENTS_API_PATH = "/events";
