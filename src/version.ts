/**
 * @module ew-backend/version
 * @description This module defines the version and package name for the ew-backend.
 * @summary It exports the version and package name of the application.
 * @category Application
 */

import { Metadata } from "@decaf-ts/decoration";

export const VERSION = "##VERSION##";
export const PACKAGE_NAME = "##PACKAGE##";

Metadata.registerLibrary(PACKAGE_NAME, VERSION);
