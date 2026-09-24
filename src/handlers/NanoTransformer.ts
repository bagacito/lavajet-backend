import { NanoFlavour } from "@decaf-ts/for-nano";
import {
  RequestToContextTransformer,
  requestToContextTransformer,
} from "@decaf-ts/for-http/server";

@requestToContextTransformer(NanoFlavour)
export class NanoTransformer implements RequestToContextTransformer<any> {
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
