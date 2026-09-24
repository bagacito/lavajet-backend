/**
 * @module ew-backend/app-controller
 * @description This module defines the main application controller for the ew-backend.
 * @summary It provides basic health check and no-content routes.
 * @category Controllers
 */

import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

@Controller()
@ApiTags("Root")
export class AppController {
  constructor() {}

  /**
   * @method health
   * @description Provides a basic health check for the service.
   * @summary Returns a status of "ok" and the current timestamp if the service is reachable and operating.
   * @returns {object} An object containing the status and timestamp.
   */
  @Get("health")
  @ApiOperation({ summary: "Basic health check for the service." })
  @ApiOkResponse({ description: "Service is reachable and operating." })
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  /**
   * @method noContent
   * @description Provides a basic no content route.
   * @summary Returns an empty array.
   * @returns {Array<any>} An empty array.
   */
  @Get("no-content")
  @ApiOperation({ summary: "Basic no content route." })
  @ApiOkResponse({ description: "No content array." })
  noContent() {
    return [];
  }
}
