import { MaybeContextualArg, service } from "@decaf-ts/core";
import { JwtService as CryptoJwtService } from "@decaf-ts/crypto/integration/services/jwt";
import { JwtOptions } from "@decaf-ts/crypto/jwt";
import { Environment } from "../utils/environment";

@service("jwt")
export class JwtService extends CryptoJwtService {
  override async initialize(...args: MaybeContextualArg<any>): Promise<{
    config: {
      secret?: string;
      expiry?: string;
      verifyUrl?: string;
      clockToleranceSeconds?: number;
    };
    client: void;
  }> {
    const config: JwtOptions = {
      secret: Environment.orThrow().jwt.secretKey,
      expiry: Environment.orThrow().jwt.expiry,
      verifyUrl: Environment.verifyToken ? Environment.verifyUrl : undefined,
      clockToleranceSeconds: 2,
    };

    return super.initialize(config, ...args);
  }
}
