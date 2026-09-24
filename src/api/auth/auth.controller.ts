/**
 * @module ew-backend/api/auth
 * @description This module defines the authentication controller for the API.
 * @summary It provides endpoints for user authentication.
 * @category API
 */

import { Controller, Get, Req } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@Controller("auth")
@ApiTags("Auth")
export class AuthController {
  /**
   * @method login
   * @description Handles user login and returns an authentication token.
   * @summary Retrieves the access token from request headers and returns it.
   * @param {Request} req - The incoming request object.
   * @returns {Promise<{ token: string | string[] | undefined }>} An object containing the authentication token.
   */
  @Get("login")
  @ApiOperation({ summary: "User login endpoint" })
  @ApiResponse({
    status: 200,
    description: "Returns the authentication token.",
  })
  async login(@Req() req: Request) {
    const xAuthToken = req.headers["x-auth-request-access-token"];
    const xForwardToken = req.headers["x-forwarded-access-token"];
    const authToken = req.headers["authorization"];
    const token = xAuthToken || xForwardToken || authToken;
    return { token };
  }
}
