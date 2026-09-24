import {
  RequestToContextTransformer,
  requestToContextTransformer,
} from "@decaf-ts/for-http/server";
import { TypeORMFlavour } from "@decaf-ts/for-typeorm";

@requestToContextTransformer(TypeORMFlavour)
export class TypeORMTransformer implements RequestToContextTransformer<any> {
  async from(ctx: any): Promise<any> {
    const user =
      ctx?.getOrUndefined?.("user") ??
      ctx?.get?.("user") ??
      ctx?.user ??
      ctx?.request?.user;
    if (!user) {
      return {};
    }
    return {
      user,
    };
  }
}
