import {
  PatternFilter,
  LoggingMode,
  Logging,
  Logger,
  logParameterRegistry,
  type LogParameterDescriptor,
} from "@decaf-ts/logging";
import { Context } from "@decaf-ts/core";
import { InternalError } from "@decaf-ts/db-decorators";

export class PasswordFilter extends PatternFilter {
  constructor() {
    super(
      /["'](password)["']\s?[:=]\s?["'](.+?)["']/gms,
      (substring: string, type: string, content: string) => {
        return `"${type}": ${new Array(content.length).fill("*").join("")}`;
      }
    );
  }
}

export class CertificateFilter extends PatternFilter {
  constructor() {
    super(
      /-----BEGIN (CERTIFICATE|KEY|PRIVATE KEY)-----(.+?)-----END \1-----$/gms,
      (substring: string, type: string, content: string) =>
        `${type}: ${content.substring(0, 5)}...${content.substring(content.length - 6)}`
    );
  }
}

export class FileContentFilter extends PatternFilter {
  constructor() {
    super(
      /(["'])(xmlContent|fileContent|content)\1(\s?[:=]\s?)(["'])(.+?)\4/gm,
      (match: string, ...groups: string[]) => {
        const [quote, key, equality, otherQuote, content] = groups;
        return `${quote}${key}${quote}${equality}${otherQuote}${content.substring(0, 5)}...${content.substring(content.length - 6)}${otherQuote}`;
      }
    );
  }
}

/**
 * The identity/request properties available for binding onto a logger, mirroring
 * the custom log parameters registered by `@decaf-ts/for-http/server`
 * (`ip`, `sessionId`, `sessionType`), `@decaf-ts/integrations` (`user`,
 * `organization`), plus the Lavajet/Fabric-specific `msp` and `roles`.
 */
export type IdentifiedLogDetails = {
  ip?: string;
  user?: string;
  msp?: string;
  roles?: string[];
  organization?: string;
  sessionId?: string;
  sessionType?: string;
};

const registered = new Set<string>();

function registerLogParameter(
  key: string,
  style: "id" | "app"
): LogParameterDescriptor {
  return {
    key,
    shouldInclude(payload) {
      const value = (payload.config as Record<string, unknown>)[key];
      if (value === undefined || value === null) return false;
      return Array.isArray(value) ? value.length > 0 : value !== "";
    },
    render(payload) {
      const value = (payload.config as Record<string, unknown>)[key];
      return Array.isArray(value) ? value.join(";") : String(value);
    },
    style(rendered, payload) {
      return payload.applyTheme(rendered, style);
    },
  };
}

/**
 * Registers every logging custom property ew-backend can bind onto a logger,
 * consistent with the reference implementations. Idempotent, so it is safe to
 * call on every startup (and harmless when the underlying packages have
 * already registered the shared `ip`/`user`/`organization`/`sessionId`/
 * `sessionType` parameters).
 */
export function registerEwLogParameters(): void {
  const descriptors: Record<string, "id" | "app"> = {
    ip: "id",
    sessionId: "id",
    sessionType: "app",
    user: "app",
    organization: "app",
    msp: "app",
    roles: "app",
  };
  Object.entries(descriptors).forEach(([key, style]) => {
    if (registered.has(key)) return;
    registered.add(key);
    logParameterRegistry.register(registerLogParameter(key, style));
  });
}

/**
 * Derives the identity/request properties available for logger binding.
 */
function detailsOf(
  optsOrContext: Context<any> | IdentifiedLogDetails
): IdentifiedLogDetails {
  if (optsOrContext instanceof Context) {
    const overrides = optsOrContext.toOverrides() as IdentifiedLogDetails;
    return {
      ip: overrides.ip,
      user: overrides.user,
      msp: overrides.msp,
      roles: overrides.roles,
      organization: overrides.organization,
      sessionId: overrides.sessionId,
      sessionType: overrides.sessionType,
    };
  }
  return optsOrContext;
}

/**
 * Binds every available identity/request property onto the logger as custom
 * log parameters (see {@link registerEwLogParameters}), instead of embedding
 * them into the message string. Returns the receiver unchanged when no
 * property is available.
 */
export function getLoggerFor(
  log: Logger,
  optsOrContext: Context<any> | IdentifiedLogDetails
): Logger {
  try {
    const details = detailsOf(optsOrContext);
    const meta: Record<string, unknown> = {};
    if (details.ip) meta.ip = details.ip;
    if (details.user) meta.user = details.user;
    if (details.msp) meta.msp = details.msp;
    if (details.roles && details.roles.length) meta.roles = details.roles;
    if (details.organization) meta.organization = details.organization;
    if (details.sessionId) meta.sessionId = details.sessionId;
    if (details.sessionType) meta.sessionType = details.sessionType;
    return Object.keys(meta).length ? log.for(meta as any) : log;
  } catch (e: unknown) {
    throw new InternalError(`Failed to bind logging properties: ${e}`);
  }
}

const EW_LOG_PATTERN =
  "{level} [{timestamp}] {app} {context} {separator} {message} [{ip}] [{user}] [{organization}] [{msp}] [{roles}] [{sessionId}] [{sessionType}] {stack}";

/**
 * Enforces the registered logging custom properties by including them in the
 * global logging pattern (RAW mode renders each only when available), so every
 * bound property shows up in log output instead of being dropped.
 */
export function configureEwLogging(): void {
  registerEwLogParameters();
  const config = Logging.getConfig() as unknown as Record<string, unknown>;
  if (config.format === LoggingMode.RAW) {
    Logging.setConfig({ pattern: EW_LOG_PATTERN } as any);
  }
}
