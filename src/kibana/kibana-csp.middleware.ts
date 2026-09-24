import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

const stripFrameAncestors = (h: string) =>
  h.replace(/frame-ancestors[^;]*(;|$)/g, "").trim();

/** Headers that block iframe embedding — remove them entirely. */
const FRAME_BLOCK_HEADERS = new Set([
  "x-frame-options",
  "cross-origin-resource-policy",
  "cross-origin-opener-policy",
]);

/**
 * Removes iframe-blocking headers (X-Frame-Options, CORP, COOP) and strips
 * `frame-ancestors` from Content-Security-Policy for all /kibana responses,
 * so the dashboard iframe can load inside the frontend.
 *
 * Helmet sets these before our middleware runs, so we:
 *   1. Clean Helmet's already-set values immediately.
 *   2. Wrap res.setHeader so any future writes (proxy, error handlers) are
 *      also cleaned before they reach the browser.
 */
@Injectable()
export class KibanaCspMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction) {
    // 1. Helmet has already called res.setHeader — clean what it wrote
    for (const header of FRAME_BLOCK_HEADERS) {
      res.removeHeader(header);
    }
    const existing = res.getHeader("content-security-policy");
    if (existing) {
      res.setHeader(
        "content-security-policy",
        Array.isArray(existing)
          ? existing.map((v) => stripFrameAncestors(String(v)))
          : stripFrameAncestors(String(existing))
      );
    }

    // 2. Intercept all future setHeader calls (proxy response, error filters)
    const origSetHeader = res.setHeader.bind(res);
    (res.setHeader as any) = (name: string, value: any) => {
      const lower = name.toLowerCase();
      if (FRAME_BLOCK_HEADERS.has(lower)) return res; // drop entirely
      if (lower === "content-security-policy") {
        value = Array.isArray(value)
          ? value.map((v: unknown) => stripFrameAncestors(String(v)))
          : stripFrameAncestors(String(value));
      }
      return origSetHeader(name, value);
    };

    next();
  }
}
