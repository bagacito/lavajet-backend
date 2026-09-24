import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import { decodeJwt } from "jose";
import { AuthorizationError } from "@decaf-ts/core";
import { Environment } from "../utils/environment";

const COOKIE_NAME = "kibana_proxy";
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function getCookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Bridges cookie-based auth (used by iframe sub-requests) back into the
 * x-auth-request-access-token header so KeycloakAuthHandler can process it
 * normally — including role extraction into DecafRequestContext.
 *
 * On the first authenticated request (Bearer token present) it sets the
 * session cookie so subsequent iframe requests don't need auth headers.
 *
 * Must run before KeycloakAuthHandler in the guard chain:
 *   @UseGuards(KibanaSessionGuard, KeycloakAuthHandler)
 */
@Injectable()
export class KibanaSessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // DEV MODE: when verifyToken is not set, auth is disabled end-to-end.
    // KeycloakAuthHandler.authorize is also a no-op in this mode.
    // Swap variable: set VERIFY_TOKEN in .env.local to enable full auth.
    if (!Environment.verifyToken) return true;

    const cookie = getCookieValue(req, COOKIE_NAME);
    if (cookie) {
      // Verify the stored JWT has not expired before injecting it.
      // If it has, clear the cookie and fall through to Bearer-token auth
      // so the frontend's proactive refresh can set a fresh cookie.
      try {
        const { exp } = decodeJwt(cookie);
        if (!exp || exp > Math.floor(Date.now() / 1000)) {
          req.headers["x-auth-request-access-token"] = cookie;
          return true;
        }
      } catch { /* unparseable — fall through */ }
      res.clearCookie(COOKIE_NAME, { path: "/kibana" });
    }

    // No cookie — require a Bearer token or OAuth2-Proxy header.
    const raw =
      (req.headers["x-auth-request-access-token"] as string) ||
      (req.headers["x-forwarded-access-token"] as string) ||
      (req.headers["authorization"] as string);
    if (!raw) throw new AuthorizationError("Token not found");

    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

    // Exchange for a session cookie so subsequent iframe requests are
    // authenticated without needing Authorization headers.
    const isSecure = req.secure || req.protocol === "https";
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: isSecure ? "none" : "lax",
      secure: isSecure,
      maxAge: COOKIE_MAX_AGE_MS,
      path: "/kibana",
    });

    return true;
  }
}
