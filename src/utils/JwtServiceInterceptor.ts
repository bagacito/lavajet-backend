import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { JWTUtils } from "./JwtUtils";

@Injectable()
export class JwtServiceInterceptor implements NestInterceptor {
  constructor(private jwtUtils: JWTUtils) {}
  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const request: Request = ctx.getRequest();
    const token = this.jwtUtils.extractTokenFromHeader(request);
    if (!token) return next.handle();

    const response: any = ctx.getResponse();
    let data: Record<string, any>;
    try {
      data = await this.jwtUtils.decodeJwt(token);
    } catch (e: any) {
      throw new UnauthorizedException(e);
    }
    try {
      // response.setHeader('authorization', (await this.jwtUtils.createJwt(data)).access_token)
    } catch (e: any) {
      throw new UnauthorizedException(e);
    }
    return next.handle();
  }
}
