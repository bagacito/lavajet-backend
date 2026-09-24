import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { Environment } from "../utils/environment";

@Injectable()
export class ServerStateInterceptor implements NestInterceptor {
  constructor(private readonly mode: string) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    if (!(Environment.mode === this.mode)) {
      throw new UnauthorizedException(`Server must be in ${this.mode} mode`);
    }

    return next.handle();
  }
}
