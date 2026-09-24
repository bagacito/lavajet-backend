import { X509Certificate } from "@peculiar/x509";

/**
 * Hyperledger Fabric CA embeds user attributes as a custom X.509 extension.
 * The extension value is UTF-8 JSON like: { "attrs": { ... } }.
 */
const FABRIC_ATTR_OID = "1.2.3.4.5.6.7.8.1";

export type FabricAttrs = Record<string, unknown> & {
  roles?: string[];
};

function safeJsonParse<T>(value: string): T | undefined {
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function getFabricAttributesFromCert(pem: string): FabricAttrs {
  const cert = new X509Certificate(pem);

  // Read the Fabric attributes extension by OID.
  const ext = cert.getExtension(FABRIC_ATTR_OID);
  if (!ext) return {};

  const rawJson = new TextDecoder("utf-8")
    .decode(new Uint8Array(ext.value as ArrayBuffer))
    .trim();

  const parsed = safeJsonParse<{ attrs?: Record<string, unknown> }>(rawJson);
  if (!parsed?.attrs || typeof parsed.attrs !== "object") return {};

  const attrs: FabricAttrs = { ...parsed.attrs };

  // Normalize `roles` if it is a JSON-encoded string.
  attrs.roles = parseStringArray(attrs.roles);

  return attrs;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value;
  }

  if (typeof value !== "string") return undefined;

  const parsed = safeJsonParse<any>(value);
  if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
    return parsed as string[];
  }

  return undefined;
}

export function haveDifferentContent(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;

  const setA = new Set(a);
  const setB = new Set(b);

  if (setA.size !== setB.size) return true;

  for (const value of setA) {
    if (!setB.has(value)) return true;
  }

  return false;
}

type AccessLevel = "reader" | "writer" | "admin";

type ParsedRole = {
  prefix: string;
  level: AccessLevel;
};

const ROLE_RE = /^(.+?)-(reader|writer|admin)$/i;

function parseRoles(rawRoles: string[]): ParsedRole[] {
  return rawRoles
    .map((role) => {
      const match = ROLE_RE.exec(role);
      if (!match) return null;

      return {
        prefix: match[1].toLowerCase(),
        level: match[2].toLowerCase() as AccessLevel,
      };
    })
    .filter(Boolean) as ParsedRole[];
}

function hasRole(
  rawRoles: string[],
  prefix: string,
  level: AccessLevel
): boolean {
  const roles = parseRoles(rawRoles);
  return roles.some(
    (r) => r.prefix === prefix.toLowerCase() && r.level === level
  );
}

function hasLevel(rawRoles: string[], level: AccessLevel): boolean {
  const roles = parseRoles(rawRoles);
  return roles.some((r) => r.level === level);
}

export function hasPrefix(rawRoles: string[], prefix: string): boolean {
  const roles = parseRoles(rawRoles);
  return roles.some((r) => r.prefix === prefix.toLowerCase());
}

export function hasAnyAllowedLevel(rawRoles: string[]): boolean {
  return parseRoles(rawRoles).length > 0;
}

export const isReader = (roles: string[]) => hasLevel(roles, "reader");

export const isWriter = (roles: string[]) => hasLevel(roles, "writer");

export const isAdmin = (roles: string[]) => hasLevel(roles, "admin");

export const isPlaReader = (roles: string[]) => hasRole(roles, "pla", "reader");

/** True only for users with the pla-admin role (controls top-menu visibility). */
export const isPlaAdmin = (roles: string[]) => hasRole(roles, "pla", "admin");

export const isPla = (roles: string[]) => hasPrefix(roles, "pla");

/**
 * True for users that may use the Kibana query bar:
 * epi-writer, epi-admin, pla-writer, or pla-admin.
 */
export function canShowQueryInput(roles: string[]): boolean {
  return (
    hasRole(roles, "epi", "writer") ||
    hasRole(roles, "epi", "admin") ||
    hasRole(roles, "pla", "writer") ||
    hasRole(roles, "pla", "admin")
  );
}
