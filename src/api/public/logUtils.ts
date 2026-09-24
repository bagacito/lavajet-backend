import { Environment } from "../../utils/environment";
import { Logger } from "@decaf-ts/logging";
import {
  EventResolutionStatus,
  PlaEvents,
} from "@bagacito/lavajet-toolkit";

function emitResolverLog(
  kind: PlaEvents,
  resolver: string,
  requestUri: string,
  isHit: boolean,
  clientIp: string,
  log: Logger
) {
  const suffix = isHit ? "" : ` ${EventResolutionStatus.FAIL}`;
  log
    .for({ ip: clientIp })
    .info(`${kind}${suffix} - RESOLVER ${resolver} - ${requestUri}`);
}

export function logPublicFallbackEvent(
  requestUri: string,
  isHit: boolean,
  clientIp: string,
  log: Logger
) {
  try {
    const lavajetPort = Environment.lavajet.port;
    const { pathname } = new URL(
      requestUri,
      `${Environment.lavajet.protocol}://${Environment.lavajet.host}${lavajetPort ? `:${lavajetPort}` : ""}`
    );

    if (pathname.startsWith("/public/owner")) {
      emitResolverLog(
        PlaEvents.OWNER,
        "pharmaledger",
        requestUri,
        isHit,
        clientIp,
        log
      );
      return;
    }

    if (pathname.startsWith("/public/metadata")) {
      emitResolverLog(
        PlaEvents.METADATA,
        "pharmaledger",
        requestUri,
        isHit,
        clientIp,
        log
      );
      return;
    }

    if (pathname.startsWith("/public/leaflet")) {
      emitResolverLog(
        PlaEvents.SCAN,
        "pharmaledger",
        requestUri,
        isHit,
        clientIp,
        log
      );
      return;
    }
  } catch (e: unknown) {
    log
      .for(logPublicFallbackEvent)
      .error(`Failed to log public api fallback event for ${requestUri}: ${e}`);
  }
}
