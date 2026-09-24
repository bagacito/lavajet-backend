import { SetMetadata, UseInterceptors } from "@nestjs/common";
import { AuthRoles } from "./constants";
import { applyDecorators } from "@nestjs/common";
import { JwtServiceInterceptor } from "./JwtServiceInterceptor";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";

export const Public = () => SetMetadata(AuthRoles.PUBLIC, true);
export const Local = () => SetMetadata(AuthRoles.LOCAL, true);

export const Admin = () => {
  return applyDecorators(
    SetMetadata(AuthRoles.ADMIN, true),
    UseInterceptors(JwtServiceInterceptor)
  );
};

export const Auth = () => {
  return applyDecorators(
    SetMetadata(AuthRoles.AUTH, true),
    UseInterceptors(JwtServiceInterceptor)
  );
};

// export type HttpMethod =
//   | "GET"
//   | "POST"
//   | "PUT"
//   | "PATCH"
//   | "DELETE"
//   | "OPTIONS"
//   | "HEAD"
//   | "ALL";

// const methodMap: Record<HttpMethod, RequestMethod> = {
//   GET: RequestMethod.GET,
//   POST: RequestMethod.POST,
//   PUT: RequestMethod.PUT,
//   PATCH: RequestMethod.PATCH,
//   DELETE: RequestMethod.DELETE,
//   OPTIONS: RequestMethod.OPTIONS,
//   HEAD: RequestMethod.HEAD,
//   ALL: RequestMethod.ALL,
// };

// export function ConditionalRoute(
//   enabled: boolean,
//   method: HttpMethod,
//   path?: string | string[]
// ): MethodDecorator {
//   console.log(`Route: ${path}\n Method: ${method} \n Enabled: ${enabled}`);

//   if (!enabled) {
//     return () => {};
//   }

//   return RequestMapping({
//     method: methodMap[method],
//     path,
//   });
// }

export function ConditionalRoute(enabled: boolean): MethodDecorator {
  return (target, propertyKey, descriptor: any) => {
    if (enabled) {
      return;
    }

    console.log("Removed route: ", descriptor.value);

    Reflect.deleteMetadata(PATH_METADATA, descriptor.value);
    Reflect.deleteMetadata(METHOD_METADATA, descriptor.value);
  };
}
