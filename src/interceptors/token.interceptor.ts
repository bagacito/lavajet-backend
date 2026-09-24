import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { Token, TokenService } from "@bagacito/lavajet-toolkit";
import { Environment } from "../utils/environment";
import { Service } from "@decaf-ts/for-nest";

@Injectable()
export class TokenInterceptor implements NestInterceptor {
  constructor(@Service(Token) private readonly tokenService: TokenService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    const envToken = Environment.token;
    const token = request.body?.token ?? request.params?.token;

    const mspId = request.body?.mspId ?? request.params?.mspId;

    if (!token) {
      throw new UnauthorizedException("Invalid token");
    }

    if (!!envToken && envToken !== token) {
      throw new UnauthorizedException("Invalid token");
    }

    if (!!envToken && envToken === token) {
      return next.handle();
    }

    if (!mspId) {
      throw new UnauthorizedException("Invalid mspId");
    }

    const validatedToken = await this.tokenService.validate(token, mspId);

    if (!validatedToken) {
      throw new UnauthorizedException("Invalid token");
    }

    return next.handle();
  }
}
