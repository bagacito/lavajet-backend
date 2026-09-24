import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Environment } from "./environment";

@Injectable()
export class JWTUtils {
  constructor(private jwtService: JwtService) {}

  extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] =
      (request.headers as any).authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  async verify(token: string) {
    return await this.jwtService.verifyAsync(token, {
      secret: Environment.jwt.secretKey,
    });
  }

  async createJwt(tokenInfo: Record<string, any>) {
    return {
      access_token: await this.jwtService.signAsync(tokenInfo, {
        secret: Environment.jwt.secretKey,
      }),
    };
  }

  async decodeJwt(token: string): Promise<Record<string, any>> {
    return await this.jwtService.verifyAsync(token, {
      secret: Environment.jwt.secretKey,
    });
  }
}
