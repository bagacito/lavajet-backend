import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { decodeJwt } from "jose";
import { Environment } from "../utils/environment";
import { AuthorizationError } from "@decaf-ts/core";
import { getClientRoles } from "@decaf-ts/integrations/nest";
import { isPlaAdmin, canShowQueryInput } from "../auth/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbedFlags {
  showTopMenu: boolean;
  showQueryInput: boolean;
  showTimeFilter: boolean;
}

// ---------------------------------------------------------------------------
// Module-level Kibana config (read once at startup)
// ---------------------------------------------------------------------------

const {
  realm,
  hostProtocol,
  host,
  realmApiPassword,
  realmApiUsername,
  topMenu,
  queryInput,
  refreshInterval,
} = JSON.parse(JSON.stringify(Environment.kibana));

// ---------------------------------------------------------------------------
// Pure helpers — exported so they can be unit-tested independently
// ---------------------------------------------------------------------------

/**
 * Returns true when the request path attempts to access a Kibana space other
 * than the one this backend is configured for.
 *
 * Uses the already-normalised req.path (Express strips query-string and
 * resolves dot segments), so path-traversal tricks like /s/org/../../s/other
 * cannot bypass the check.
 */
export function isSpaceEscapeAttempt(
  reqPath: string,
  orgRealm: string
): boolean {
  const match = /^\/s\/([^/]+)/.exec(reqPath);
  return match !== null && match[1] !== orgRealm;
}

/**
 * Derives the Kibana embed flags for a user from their roles.
 *
 * Rules (enforced regardless of environment variables):
 *  - show-top-menu   → true ONLY for pla-admin
 *  - show-query-input → true ONLY for epi-writer/admin or pla-writer/admin
 *  - show-time-filter → ALWAYS true
 */
export function computeEmbedFlags(roles: string[]): EmbedFlags {
  return {
    showTopMenu: isPlaAdmin(roles),
    showQueryInput: canShowQueryInput(roles),
    showTimeFilter: true,
  };
}

/**
 * Applies the enforced embed parameters to a raw Kibana dashboard URL.
 * Non-dashboard URLs are returned unchanged.
 *
 * @param rawUrl        The full URL string (path + query) coming from req.url.
 * @param flags         Role-derived embed flags for this request.
 * @param refreshMs     Kibana refresh interval in milliseconds.
 */
export function rewriteDashboardUrl(
  rawUrl: string,
  flags: EmbedFlags,
  refreshMs: number
): string {
  const qIdx = rawUrl.indexOf("?");
  if (qIdx === -1 || !rawUrl.slice(0, qIdx).includes("/app/dashboards")) {
    return rawUrl;
  }

  const pathPart = rawUrl.slice(0, qIdx);

  const enforced: Record<string, string> = {
    "show-top-menu": String(flags.showTopMenu),
    "show-query-input": String(flags.showQueryInput),
    "show-time-filter": String(flags.showTimeFilter),
  };
  const enforcedKeys = Object.keys(enforced);

  // Strip any client-supplied values for the enforced keys.
  let segments = rawUrl
    .slice(qIdx + 1)
    .split("&")
    .filter((seg) => !enforcedKeys.some((k) => seg.startsWith(`${k}=`)));

  // Inject / update the refreshInterval inside the _g rison token.
  const pause = refreshMs > 0 ? "!f" : "!t";
  const riToken = `refreshInterval:(pause:${pause},value:${refreshMs})`;
  const gIdx = segments.findIndex((s) => s.startsWith("_g="));
  if (gIdx >= 0) {
    const gVal = segments[gIdx].slice(3);
    segments[gIdx] = `_g=${
      gVal.includes("refreshInterval:")
        ? gVal.replace(/refreshInterval:\(pause:![tf],value:\d+\)/, riToken)
        : gVal.replace(/^\(/, `(${riToken},`)
    }`;
  }

  const cleanQuery = segments
    .concat(Object.entries(enforced).map(([k, v]) => `${k}=${v}`))
    .join("&");

  return `${pathPart}?${cleanQuery}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildKibanaAuthHeader(): string {
  const token = Buffer.from(
    `${realmApiUsername as string}:${realmApiPassword as string}`
  ).toString("base64");
  return `Basic ${token}`;
}

/**
 * Decodes the JWT carried by the request (no signature verification — that
 * already happened in KeycloakAuthHandler / KibanaSessionGuard) and returns
 * the Keycloak client roles embedded in it.
 *
 * Returns undefined when token verification is disabled (dev/local mode) so
 * the caller can fall back to environment defaults.
 * Returns [] when a token is expected but absent or unparseable.
 */
function getRolesFromToken(req: Request): string[] | undefined {
  if (!Environment.verifyToken) {
    // Auth disabled in this environment — caller uses env defaults.
    return undefined;
  }

  const raw =
    (req.headers["x-auth-request-access-token"] as string | undefined) ||
    (req.headers["authorization"] as string | undefined);

  if (!raw) return [];

  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  try {
    const payload = decodeJwt(token) as any;
    return getClientRoles(payload);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Proxy service
// ---------------------------------------------------------------------------

@Injectable()
export class KibanaProxyService {
  private proxy = createProxyMiddleware({
    target: `${hostProtocol || "https"}://${host}`,
    changeOrigin: true,
    secure: false,
    ws: true,
    on: {
      proxyReq(proxyReq, req, _res) {
        proxyReq.setHeader("authorization", buildKibanaAuthHeader());
        proxyReq.setHeader("kbn-xsrf", "true");
        proxyReq.setHeader("x-elastic-internal-origin", "Kibana");
        proxyReq.removeHeader("cookie");

        // NestJS body-parser consumes the stream; re-serialise from req.body.
        const body = (req as any).body;
        if (body && Object.keys(body).length > 0) {
          const raw = JSON.stringify(body);
          proxyReq.setHeader("content-type", "application/json");
          proxyReq.setHeader("content-length", Buffer.byteLength(raw));
          proxyReq.write(raw);
        }
      },
      proxyRes(proxyRes, _req, res) {
        delete proxyRes.headers["x-frame-options"];
        (res as Response).removeHeader("X-Frame-Options");

        delete proxyRes.headers["cross-origin-resource-policy"];
        (res as Response).removeHeader("Cross-Origin-Resource-Policy");

        delete proxyRes.headers["cross-origin-opener-policy"];
        (res as Response).removeHeader("Cross-Origin-Opener-Policy");

        const cspHeader = proxyRes.headers["content-security-policy"];
        if (cspHeader) {
          const rewritten = Array.isArray(cspHeader)
            ? cspHeader.map((h) => h.replace(/frame-ancestors[^;]+;?/g, ""))
            : cspHeader.replace(/frame-ancestors[^;]+;?/g, "");
          proxyRes.headers["content-security-policy"] = rewritten;
        }

        const resCsp = (res as Response).getHeader("content-security-policy");
        if (resCsp && typeof resCsp === "string") {
          (res as Response).setHeader(
            "content-security-policy",
            resCsp.replace(/frame-ancestors[^;]+;?/g, "")
          );
        }

        delete proxyRes.headers["content-security-policy-report-only"];

        // Rewrite Kibana redirect Location headers so the browser follows
        // them through the proxy (where CSP is stripped) rather than directly
        // to Kibana's own origin.
        const kibanaOrigin = `${hostProtocol || "https"}://${host}`;
        const rawLoc = proxyRes.headers["location"];
        if (rawLoc) {
          const loc = Array.isArray(rawLoc) ? rawLoc[0] : rawLoc;
          let newLoc: string | undefined;
          if (loc.startsWith(kibanaOrigin)) {
            newLoc = "/kibana" + loc.slice(kibanaOrigin.length);
          } else if (loc.startsWith("/") && !loc.startsWith("/kibana")) {
            newLoc = "/kibana" + loc;
          }
          if (newLoc) {
            (proxyRes.headers as any)["location"] = Array.isArray(rawLoc)
              ? [newLoc, ...rawLoc.slice(1)]
              : newLoc;
          }
        }
      },
    },
    pathRewrite(_path, req) {
      // Read the flags that handle() pre-computed and attached to the request.
      const flags: EmbedFlags = (req as any)._kibanaEmbed ?? {
        showTopMenu: false,
        showQueryInput: false,
        showTimeFilter: true,
      };
      return rewriteDashboardUrl(
        req.url || "/",
        flags,
        refreshInterval as number
      );
    },
  });

  handle(req: Request, res: Response) {
    const reqPath = req.path || "/";

    // ── 1. Space-escape guard ──────────────────────────────────────────────
    // Block any attempt to access a Kibana space other than the org's own.
    // Uses the normalised req.path so URL-encoding/traversal tricks don't help.
    if (isSpaceEscapeAttempt(reqPath, realm as string)) {
      throw new AuthorizationError("Direct space access blocked");
    }

    // ── 2. Path allowlist within the org space ─────────────────────────────
    const spacePrefix = `/s/${realm}`;
    if (reqPath.startsWith(spacePrefix)) {
      const sub = reqPath.slice(spacePrefix.length) || "/";
      const allowed =
        sub.startsWith("/api") ||
        sub.startsWith("/internal") ||
        sub.startsWith("/built_assets") ||
        sub.startsWith("/plugins") ||
        sub.startsWith("/ui") ||
        sub.startsWith("/translations") ||
        sub.startsWith("/bootstrap") ||
        sub.startsWith("/login") ||
        sub.startsWith("/spaces") ||
        sub.startsWith("/status") ||
        sub.startsWith("/app/dashboards");

      if (!allowed) throw new AuthorizationError("Only dashboards are allowed");
    }
    // Global Kibana asset paths (/<hash>/ui/…, /translations/…) pass through.

    // ── 3. Role-based embed-flag computation ───────────────────────────────
    // When verifyToken is enabled, decode the JWT and enforce:
    //   show-top-menu   → pla-admin only
    //   show-query-input → epi/pla writer or admin only
    //   show-time-filter → always true
    //
    // In dev mode (verifyToken disabled) fall back to env-configured values
    // so developers can test UI variants locally without a real token.
    const roles = getRolesFromToken(req);
    (req as any)._kibanaEmbed =
      roles !== undefined
        ? computeEmbedFlags(roles)
        : {
            showTopMenu: topMenu as boolean,
            showQueryInput: queryInput as boolean,
            showTimeFilter: true,
          };

    return this.proxy(req, res);
  }
}
