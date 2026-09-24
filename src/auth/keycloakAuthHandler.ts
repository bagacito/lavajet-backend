import {
  AuthorizationError,
  Context,
  ContextualArgs,
  PersistenceKeys,
  Service as DecafService,
} from "@decaf-ts/core";
import { NotFoundError } from "@decaf-ts/db-decorators";
import { Metadata } from "@decaf-ts/decoration";
import { Constructor } from "@decaf-ts/decoration";
import { Model } from "@decaf-ts/decorator-validation";
import { CA_ROLE, IKeyValueAttribute } from "@decaf-ts/for-fabric";
import type { AuthRequestLike } from "@decaf-ts/for-http/server";
import { DecafRequestContext } from "@decaf-ts/for-nest";
import {
  extractKeycloakRoles,
  getClientRoles,
  getRealmFromIssuer,
  KeycloakAuthData,
  KeycloakAuthHandler,
  type KeycloakAccessTokenPayload,
} from "@decaf-ts/integrations/nest";
import { Injectable, SetMetadata } from "@nestjs/common";
import {
  FabricIdentity,
  FabricIdentityService,
  IsReaderAllowedKey,
} from "@bagacito/lavajet-toolkit";
import crypto from "crypto";
import {
  getFabricAttributesFromCert,
  hasAnyAllowedLevel,
  haveDifferentContent,
  isPla,
  isPlaReader,
  isWriter,
} from "./utils";
import { Environment } from "../utils/environment";
import { EVENTS_API_PATH } from "../utils/constants";

type FabricAuthRequestLike = AuthRequestLike & {
  handler?: { name?: string };
  [SKIP_FABRIC_IDENTITY_KEY]?: boolean;
};

type FabricContextBindings = {
  keyCertOrDirectoryPath?: Buffer;
  certCertOrDirectoryPath?: Buffer;
  roles?: string[];
  user?: string;
  msp?: string;
  ip?: string;
};

/**
 * Metadata key for the `@SkipFabricIdentity()` decorator.
 */
export const SKIP_FABRIC_IDENTITY_KEY = "skipFabricIdentity";

/**
 * Method/class decorator: marks a route as "token-only" — the JWT is
 * validated and roles are checked, but the Fabric identity lookup and
 * re-enrollment are skipped.  Use for routes that don't submit Fabric
 * transactions (e.g. /account POST, /infrastructure/*, kibana proxy).
 */
export const SkipFabricIdentity = () =>
  SetMetadata(SKIP_FABRIC_IDENTITY_KEY, true);

/**
 * Fabric-aware Keycloak auth handler.
 *
 * Extends the framework-agnostic {@link KeycloakAuthHandler} from
 * `@decaf-ts/integrations/nest` and adds:
 * - JWKS token validation (delegated to {@link JwtService})
 * - Fabric identity lookup, re-enrollment, and credential binding to context
 * - PLA-specific role checks (reader/writer/admin levels, allowed operations)
 * - `@SkipFabricIdentity()` decorator support for routes that only need
 *   token validation without Fabric credentials
 *
 * Credentials (private key, certificate, roles, user, msp, ip) are accumulated
 * onto the request context as top-level keys, replacing the old
 * `DECAF_ADAPTER_OPTIONS` request-symbol pattern.
 *
 * Exception: write methods (POST/PUT/PATCH/DELETE) on the public leaflet
 * `external` route live under the `/public` prefix but still submit Fabric
 * transactions. They are re-routed through the authenticated path so JWT
 * roles and Fabric identity bindings are applied; public reads under
 * `/public` remain public.
 *
 * @mermaid
 * sequenceDiagram
 *     participant Client
 *     participant Handler as FabricKeycloakAuthHandler
 *     participant Base as KeycloakAuthHandler (base)
 *     participant Identity as FabricIdentityService
 *
 *     Client->>Handler: request (e.g. POST /public/leaflet/external)
 *     Handler->>Handler: isPublicLeafletExternalWrite(request)
 *     alt public leaflet external write
 *         Handler->>Handler: parseRequestAuthData(request) - isPublic: false
 *         Handler->>Handler: prime(request, ctx)
 *         Handler->>Identity: buildFabricBindings(data, request)
 *         Identity-->>Handler: key, cert, roles, user, msp, ip
 *         Handler->>Handler: ctx.accumulate(fabricBindings)
 *     else public read under /public
 *         Handler->>Base: isPublicRequest / parseFromRequest
 *         Base-->>Handler: isPublic: true (no Fabric bindings)
 *     else authenticated route
 *         Handler->>Base: isPublicRequest / parseFromRequest
 *         Base-->>Handler: isPublic: false
 *         Handler->>Handler: prime(request, ctx) + Fabric bindings
 *     end
 */
@Injectable()
export class FabricKeycloakAuthHandler extends KeycloakAuthHandler {
  private readonly identityService: FabricIdentityService;

  constructor(identityService?: FabricIdentityService) {
    super();
    this.identityService =
      identityService ??
      (DecafService.get(FabricIdentity as any) as FabricIdentityService);
  }

  /**
   * Public leaflet `external` routes serve public reads only. The write methods
   * (POST/PUT/PATCH/DELETE) still submit a Fabric transaction that needs the
   * submitter's roles/namespaces bound to the request context, so they must be
   * treated as authenticated (not public). The same user/token that drives
   * `PUT /leaflet` already works, so only the `/public` path short-circuit was
   * incorrectly dropping the bindings.
   *
   * @override
   * @param {AuthRequestLike} request - The incoming request to classify.
   * @returns {boolean} `false` for public leaflet `external` writes (they are
   * authenticated); otherwise the base {@link KeycloakAuthHandler.isPublicRequest}
   * decision (`true` only for `/public`-prefixed paths).
   */
  protected override isPublicRequest(request: AuthRequestLike): boolean {
    if (this.isPublicLeafletExternalWrite(request)) return false;
    return super.isPublicRequest(request);
  }

  /**
   * Extracts authentication data from the request, honouring the
   * {@link FabricKeycloakAuthHandler.isPublicRequest} routing decision.
   *
   * Public leaflet `external` writes are parsed here as authenticated
   * requests (see {@link FabricKeycloakAuthHandler.parseRequestAuthData});
   * every other request is delegated to the base
   * {@link KeycloakAuthHandler.parseFromRequest}, which returns public data
   * for `/public` routes and token-derived data otherwise.
   *
   * @override
   * @param {AuthRequestLike} request - The incoming request to extract the token from.
   * @returns {KeycloakAuthData} The extracted authentication data. For a
   * public leaflet `external` write, `isPublic` is always `false` so the
   * downstream `prime()`/`buildFabricBindings()` path still runs.
   * @throws {AuthorizationError} When the request carries no token, or the
   * token cannot be decoded.
   */
  protected override parseFromRequest(request: AuthRequestLike): KeycloakAuthData {
    if (this.isPublicLeafletExternalWrite(request)) {
      return this.parseRequestAuthData(request);
    }
    return super.parseFromRequest(request);
  }

  public override async prime(
    request: AuthRequestLike,
    ctx: DecafRequestContext
  ): Promise<KeycloakAuthData> {
    const fabricRequest = request as FabricAuthRequestLike;
    const data = await super.prime(request, ctx);
    if (data.isPublic) return data;

    const jwtPayload =
      this.jwtService!.getTokenPayload<KeycloakAccessTokenPayload>(
        data.token
      ) ?? null;
    if (jwtPayload) {
      ctx.accumulate({
        jwtPayload: {
          ...jwtPayload,
          realm: data.organization,
        },
      } as any);
    }

    const handlerName = this.resolveHandlerName(fabricRequest);
    const skipFabric =
      fabricRequest[SKIP_FABRIC_IDENTITY_KEY] === true ||
      this.isEventsApiRequest(fabricRequest);
    const fabricBindings =
      handlerName === "proxy" || skipFabric
        ? { roles: data.roles }
        : await this.buildFabricBindings(data, fabricRequest);

    ctx.accumulate(fabricBindings);
    return data;
  }

  protected override async validate(
    data: KeycloakAuthData,
    routeRoles: string[] | undefined,
    routeNamespaces: string[] | undefined,
    skipModelNamespaces: boolean | undefined,
    model: string | Constructor,
    ...args: ContextualArgs<Context>
  ): Promise<void> {
    if (data.isPublic) return;

    const requestContext = args[args.length - 1] as DecafRequestContext;
    const request = requestContext.request as unknown as AuthRequestLike;

    const tokenPayload =
      this.jwtService!.getTokenPayload<KeycloakAccessTokenPayload>(
        data.token
      ) ?? null;
    const roles = getClientRoles(tokenPayload);
    const log = requestContext.logger
      .for(this.validate)
      .for({
        organization: data.organization,
        sessionId: (tokenPayload as (KeycloakAccessTokenPayload & { sid?: string }) | null)
          ?.sid,
      });
    log.debug(`Validating token for ${request.method} ${request.url}`);
    log.debug(
      `Token accepted for user ${data.user ?? "unknown"} with roles ${roles.join(", ") || "none"}`
    );

    // PLA-specific role enforcement
    const modelCtor = typeof model === "string" ? Model.get(model) : model;
    const allowedRoles = modelCtor
      ? (Metadata.get(modelCtor, PersistenceKeys.AUTH_ROLE) as string[])
      : [];
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.some((r: string) => roles.includes(r))) {
        if (request && request.method !== "GET" && isPla(roles)) {
          throw new AuthorizationError("Insufficient roles");
        }
      }
      if (!hasAnyAllowedLevel(roles)) {
        throw new AuthorizationError("No allowed level access role");
      }
      if (!isWriter(roles) && isPlaReader(roles)) {
        const allowedReaderOps = modelCtor
          ? Metadata.get(modelCtor, IsReaderAllowedKey)
          : undefined;
        const handlerName = this.resolveHandlerName(request);
        if (
          allowedReaderOps &&
          handlerName &&
          !allowedReaderOps.includes(handlerName)
        ) {
          throw new AuthorizationError("Insufficient permissions");
        }
      }
    }

    await super.validate(
      data,
      routeRoles,
      routeNamespaces,
      skipModelNamespaces,
      model,
      ...args
    );
  }

  protected override async validateAuth(
    data: KeycloakAuthData,
    request: AuthRequestLike
  ): Promise<void> {
    if (!Environment.verifyToken) return;
    await super.validateAuth(data, request);
  }

  /**
   * Builds the Fabric credentials bound to the request context for an
   * authenticated, non-skipped request.
   *
   * Before any Fabric CA side effect, the enrollment payload is
   * signature-verified via
   * {@link FabricKeycloakAuthHandler.verifyAndExtractEnrollmentPayload};
   * all subsequent decisions (user identity, organization, roles) are taken
   * from that verified payload instead of the raw, unverified
   * `KeycloakAuthData` fields.
   *
   * When the verified payload carries no user, only the verified roles are
   * returned (no Fabric identity is looked up or created). Otherwise the
   * existing credentials for the user are retrieved and, when the
   * certificate's `roles` attribute differs from the verified token roles,
   * the identity is re-enrolled with the verified roles; a missing identity
   * (`NotFoundError`) triggers a fresh `registerAndEnroll` with those roles.
   * Any other failure is logged and re-thrown.
   *
   * @mermaid
   * sequenceDiagram
   *     participant Handler as FabricKeycloakAuthHandler
   *     participant Verify as verifyAndExtractEnrollmentPayload
   *     participant Identity as FabricIdentityService
   *
   *     Handler->>Verify: data (raw token + decoded fields)
   *     Verify-->>Handler: verified user/organization/roles
   *     Handler->>Identity: getUserCredentials(email)
   *     alt credentials found, roles differ from certificate
   *         Handler->>Identity: reenroll(email, verified roles)
   *         Identity-->>Handler: updated credentials
   *     else no credentials (NotFoundError)
   *         Handler->>Identity: registerAndEnroll(email, verified roles)
   *         Identity-->>Handler: new credentials
   *     end
   *
   * @param {KeycloakAuthData} data - The authentication data extracted for the
   * request; its token is signature-verified here and its `user`/`organization`
   * are only used as fallbacks when the verified payload omits them.
   * @param {AuthRequestLike} request - The incoming request, used to resolve
   * the client IP bound to the returned credentials.
   * @returns {Promise<FabricContextBindings>} The Fabric bindings to accumulate
   * onto the request context: private key and certificate buffers, the verified
   * roles, user, organization (as `msp`) and client IP. When the verified
   * payload has no user, only the verified `roles` are returned.
   * @throws {AuthorizationError} When the token fails signature verification
   * (see {@link FabricKeycloakAuthHandler.verifyAndExtractEnrollmentPayload}),
   * when there is no token, or when JWT verification is not configured and
   * enrollment is refused (decode-only mode, see
   * {@link FabricKeycloakAuthHandler.refuseEnrollmentInDecodeOnlyMode}).
   * @throws {Error} Re-throws any non-`NotFoundError` failure from the
   * identity service (credential lookup or re-enrollment), and any enrollment
   * failure during `registerAndEnroll`.
   */
  private async buildFabricBindings(
    data: KeycloakAuthData,
    request: AuthRequestLike
  ): Promise<FabricContextBindings> {
    const enrollment = await this.verifyAndExtractEnrollmentPayload(data);

    this.refuseEnrollmentInDecodeOnlyMode(request);

    const email = enrollment.user;
    if (!email) {
      return { roles: enrollment.roles };
    }

    const ip = this.requestIpOf(request);
    const organization = enrollment.organization ?? "";

    let creds: FabricIdentity;
    try {
      creds = await this.identityService.getUserCredentials(email, request);
      const attr = getFabricAttributesFromCert(creds.certificate);
      if (haveDifferentContent(enrollment.roles || [], attr.roles || [])) {
        const rolesAttr: IKeyValueAttribute[] = [
          {
            name: "roles",
            value: JSON.stringify(enrollment.roles || []),
            ecert: true,
          },
        ];
        await this.identityService.reenroll(email, rolesAttr, request);
        creds = await this.identityService.getUserCredentials(email, request);
      }
    } catch (e: unknown) {
      const logError = (message: string, error: unknown) => {
        const logger = (
          this.identityService as unknown as {
            log?: {
              for?: (meta: Record<string, unknown>) =>
                | { error?: (message: string, error?: Error) => void }
                | undefined;
              error?: (message: string, error?: Error) => void;
            };
          }
        ).log;
        (ip ? logger?.for?.({ ip }) : logger)?.error?.(
          message,
          error as Error
        );
      };

      if (!(e instanceof NotFoundError)) {
        logError(`ACCESS FAIL`, e);
        throw e;
      }

      const attrs: IKeyValueAttribute = {
        name: "roles",
        value: JSON.stringify(enrollment.roles || []),
        ecert: true,
      };
      const pass = crypto.randomBytes(24).toString("hex");
      try {
        (this.identityService as any).log?.info?.(
          `Creating Fabric identity for ${email} in organization ${organization}`
        );
        await this.identityService.registerAndEnroll(
          { userName: email, password: pass },
          false,
          undefined,
          CA_ROLE.USER,
          attrs,
          -1,
          request
        );
      } catch (error: unknown) {
        logError(`ACCESS FAIL - enrollment failed`, error);
        throw error;
      }
      creds = await this.identityService.getUserCredentials(email, request);
    }

    return {
      keyCertOrDirectoryPath: Buffer.isBuffer(creds.privateKey)
        ? creds.privateKey
        : Buffer.from(creds.privateKey, "utf-8"),
      certCertOrDirectoryPath: Buffer.isBuffer(creds.certificate)
        ? creds.certificate
        : Buffer.from(creds.certificate, "utf-8"),
      roles: enrollment.roles,
      user: email,
      msp: organization,
      ip,
    };
  }

  /**
   * Refuses any Fabric CA side effect when JWT verification is not configured.
   *
   * With `Environment.verifyToken` falsy (e.g. `VERIFY_TOKEN=false`),
   * `decodeAuthToken` runs in decode-only mode: it base64-decodes the claims
   * without checking the signature, so the signature-verification remediation in
   * {@link FabricKeycloakAuthHandler.verifyAndExtractEnrollmentPayload} is inert
   * and a forged token could still drive `registerAndEnroll`/`reenroll`. To keep
   * the authenticated-request path fail-secure, enrollment is refused with a
   * loud error-level warning and `AuthorizationError`; the Fabric CA is never
   * contacted in this state.
   *
   * @param {AuthRequestLike} request - The incoming request, used to resolve
   * the client IP bound to the emitted error-level log.
   * @returns {void}
   * @throws {AuthorizationError} Always, when `Environment.verifyToken` is
   * falsy ("Token verification is not configured; refusing Fabric enrollment").
   */
  private refuseEnrollmentInDecodeOnlyMode(request: AuthRequestLike): void {
    if (Environment.verifyToken) return;
    const ip = this.requestIpOf(request);
    const logger = (this.identityService as unknown as {
      log?: {
        for?: (meta: Record<string, unknown>) =>
          | { error?: (message: string, error?: Error) => void }
          | undefined;
        error?: (message: string, error?: Error) => void;
      };
    }).log;
    (ip ? logger?.for?.({ ip }) : logger)?.error?.(
      `DECODE-ONLY REFUSAL: JWT verification not configured (verifyToken falsy); ` +
        `refusing Fabric enrollment side effects for ${request?.method ?? "?"} ${request?.url ?? request?.path ?? "?"}`
    );
    throw new AuthorizationError(
      "Token verification is not configured; refusing Fabric enrollment"
    );
  }

  /**
   * Signature-verifies the request token and extracts the enrollment payload
   * from the verified claims.
   *
   * Security: `KeycloakAuthData.user`/`roles`/`organization` are produced by an
   * unverified base64 decode of the token, so they must never drive Fabric CA
   * side effects (`registerAndEnroll`/`reenroll`) — a forged token could
   * otherwise mint or rewrite a Fabric identity. When a token is present, the
   * payload returned here is rebuilt exclusively from `decodeAuthToken`
   * (jose `jwtVerify`) output: the user from the verified `email`/
   * `preferred_username`, the organization from the verified `aud`/`azp` (with
   * the issuer realm and the raw data as fallbacks), and roles re-extracted
   * from the verified payload. Without a token there is nothing to verify, so
   * the enrollment gate fails closed rather than passing unverified claims.
   *
   * @param {KeycloakAuthData} data - The authentication data carrying the raw
   * token and its unverified decoded fields.
   * @returns {Promise<{user?: string; organization: string; roles: string[]}>}
   * The user, organization and roles taken from the signature-verified payload.
   * @throws {AuthorizationError} "Token not found" when the request carries no
   * token, or when the token is present but fails signature/claim verification
   * ("Invalid token: ..."), or verification is not configured and the token
   * cannot be decoded.
   */
  private async verifyAndExtractEnrollmentPayload(data: KeycloakAuthData): Promise<{
    user?: string;
    organization: string;
    roles: string[];
  }> {
    // `data.roles`/`data.user` come from an unverified base64 decode; re-verify
    // the signature so a forged token can never reach registerAndEnroll/reenroll.
    const token = data.token;
    if (!token) {
      // Fail-closed: without a token there is nothing to verify, so the
      // enrollment gate must never pass unverified claims. This branch is
      // currently unreachable via authorize -> prime (both base
      // parseFromRequest/parseRequestAuthData throw without a token), but it is
      // fail-open by construction and must never degrade into a pass-through.
      throw new AuthorizationError("Token not found");
    }
    const verifiedPayload =
      await this.jwtService!.decodeAuthToken<KeycloakAccessTokenPayload>(token);
    return {
      user:
        verifiedPayload?.email ??
        verifiedPayload?.preferred_username ??
        data.user,
      organization:
        verifiedPayload?.aud ??
        verifiedPayload?.azp ??
        getRealmFromIssuer(token) ??
        data.organization ??
        "",
      roles: extractKeycloakRoles(verifiedPayload),
    };
  }

  /**
   * Detects a write request against the public leaflet `external` route.
   *
   * These requests sit under the `/public` path prefix, so the base handler
   * would classify them as public and skip Fabric identity binding — but they
   * still submit a Fabric transaction that needs the submitter's roles bound
   * to the request context. Matching requests are therefore re-routed through
   * the authenticated path by {@link FabricKeycloakAuthHandler.isPublicRequest}
   * and {@link FabricKeycloakAuthHandler.parseFromRequest}.
   *
   * @param {AuthRequestLike} request - The incoming request to classify.
   * @returns {boolean} `true` when the HTTP method is a write method
   * (POST, PUT, PATCH or DELETE) and the query-stripped path contains
   * `/public/leaflet/external`; `false` otherwise (including public reads).
   */
  /**
   * Whether the request targets the SSE events API (the stream or its
   * `subscribe`/`unsubscribe` endpoints), with or without the URI version
   * prefix. Those requests never submit Fabric transactions, so they are
   * token-only: the JWT is validated and the user bound to the context, but the
   * Fabric identity lookup/re-enrollment is skipped — otherwise every stream
   * (re)connection would hit the CA and a CA hiccup would cut users off events.
   *
   * @param {AuthRequestLike} request - The incoming request to classify.
   * @returns {boolean} `true` for `/events` and `/events/...` (optionally `/v<n>`-prefixed).
   */
  private isEventsApiRequest(request: AuthRequestLike): boolean {
    const path = (request.path ?? request.url ?? "").split("?")[0];
    const events = EVENTS_API_PATH.replace(/\/$/, "");
    return new RegExp(`^(?:/v\\d+)?${events}(?:/|$)`).test(path);
  }

  private isPublicLeafletExternalWrite(request: AuthRequestLike): boolean {
    const method = (request.method ?? "").toUpperCase();
    const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
    const path = (request.path ?? request.url ?? "").split("?")[0];
    return (
      writeMethods.includes(method) &&
      path.includes("/public/leaflet/external")
    );
  }

  /**
   * Parses authenticated {@link KeycloakAuthData} from the request token.
   *
   * Mirrors the base {@link KeycloakAuthHandler.parseFromRequest} extraction
   * logic, but is used for public leaflet `external` writes so they are
   * returned as authenticated (`isPublic: false`) instead of public. The
   * returned roles/organization/user feed `prime()`, which binds the JWT
   * payload and Fabric credentials to the request context.
   *
   * @param {AuthRequestLike} request - The incoming request carrying the token.
   * @returns {KeycloakAuthData} Authentication data with `isPublic` forced to
   * `false`: user (email or preferred username), organization (audience,
   * authorized party or issuer realm), extracted Keycloak roles, and the raw token.
   * @throws {AuthorizationError} When no token is present
   * ("Token not found") or the token cannot be decoded ("Invalid token").
   */
  private parseRequestAuthData(request: AuthRequestLike): KeycloakAuthData {
    const token = this.tokenOf(request);
    if (!token) throw new AuthorizationError("Token not found");
    const payload =
      this.jwt().decodePayload<KeycloakAccessTokenPayload>(token) ?? null;
    if (!payload) throw new AuthorizationError("Invalid token");
    const roles = extractKeycloakRoles(payload);
    const organization = payload.aud || payload.azp || getRealmFromIssuer(token);
    const user = payload?.email ?? payload?.preferred_username;
    return { user, organization, roles, token, isPublic: false };
  }

  /**
   * Extracts the raw access token from the request headers.
   *
   * Accepts the `x-auth-request-access-token` header (set by the auth proxy)
   * with fallback to the standard `authorization` header, stripping the
   * `Bearer ` prefix when present.
   *
   * @param {AuthRequestLike} request - The incoming request to read headers from.
   * @returns {string | undefined} The bare token string, or `undefined` when
   * neither header is present or carries a non-empty string value.
   */
  private tokenOf(request: AuthRequestLike): string | undefined {
    const token =
      request.headers?.["x-auth-request-access-token"] ??
      request.headers?.["authorization"];
    if (typeof token !== "string" || !token) return undefined;
    return token.startsWith("Bearer ") ? token.slice("Bearer ".length) : token;
  }

  private resolveHandlerName(request: AuthRequestLike): string | undefined {
    return (request as FabricAuthRequestLike).handler?.name;
  }
}
