/**
 * @module ew-backend/api/account
 * @description This module defines the account controller for the API.
 * @summary It provides endpoints for retrieving account information.
 * @category API
 */

import { InternalError } from "@decaf-ts/db-decorators";
import { Controller, Get } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  AccountConfigService,
  AccountConfig,
} from "@bagacito/lavajet-toolkit";
import { Auth, Service, DecafRequestContext } from "@decaf-ts/for-nest";
import {
  getClientRoles,
  type KeycloakAccessTokenPayload,
} from "@decaf-ts/integrations/nest";

@Controller("account")
@ApiTags("AccountInfo")
export class AccountController {
  constructor(
    private readonly clientContext: DecafRequestContext,
    @Service(AccountConfig)
    private readonly accountConfigService: AccountConfigService
  ) {}

  /**
   * @method accountInfo
   * @description Retrieves account information.
   * @summary This endpoint returns account information based on the provided JWT.
   * @param {Request} req - The incoming request object.
   * @returns {Promise<AccountInfo>} An object containing account information.
   * @throws {InternalError} If no request object or JWT is provided, or if account/user information is not found.
   */
  @Get("info")
  @ApiOperation({
    summary: "get account information needed",
    description: `This endpoint returns account information needed. `,
    deprecated: false,
  })
  @ApiOkResponse({ description: "Object with account information needed" })
  @Auth(AccountConfig)
  @ApiHeader({
    name: "x-auth-request-access-token",
    description: "JWT injected by oauth2-proxy / Keycloak",
    required: false,
  })
  async accountInfo() {
    const jwtPayload = (this.clientContext as any).getOrUndefined(
      "jwtPayload"
    ) as KeycloakAccessTokenPayload | undefined;
    if (!jwtPayload) {
      throw new InternalError("JWT payload not found in request context");
    }

    const issuer = jwtPayload.iss;
    if (!issuer) throw new InternalError("Issuer (iss) not found in request context");
    let realm: string;
    try {
      const url = new URL(issuer);
      const parts = url.pathname.split("/").filter(Boolean);
      const realmsIndex = parts.indexOf("realms");
      if (realmsIndex === -1 || !parts[realmsIndex + 1]) {
        throw new Error("Cannot extract realm from issuer");
      }
      realm = parts[realmsIndex + 1];
    } catch {
      throw new InternalError(`Invalid issuer URL: ${issuer}`);
    }

    const config = await this.accountConfigService.read(realm);

    const user = {
      preferred_username: jwtPayload.preferred_username,
      email: jwtPayload.email,
      email_verified: jwtPayload.email_verified,
      name: jwtPayload.name,
      given_name: jwtPayload.given_name,
      family_name: jwtPayload.family_name,
    };

    const accountInfo = {
      accountConfig: config,
      user,
      roles: getClientRoles(jwtPayload),
    } as unknown as AccountConfig;
    return accountInfo;
  }
}
