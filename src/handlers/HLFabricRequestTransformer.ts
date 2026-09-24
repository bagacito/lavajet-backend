import { FabricFlavour } from "@decaf-ts/for-fabric";
import {
  requestToContextTransformer,
  RequestToContextTransformer,
} from "@decaf-ts/for-http/server";

@requestToContextTransformer(FabricFlavour)
export class FabricTransformer implements RequestToContextTransformer<any> {
  async from(context: any): Promise<any> {
    const overrides = context?.getOrUndefined?.("overrides") ?? {};
    return {
      ...(context?.getOrUndefined?.("keyCertOrDirectoryPath")
        ? { keyCertOrDirectoryPath: context.getOrUndefined("keyCertOrDirectoryPath") }
        : {}),
      ...(context?.getOrUndefined?.("certCertOrDirectoryPath")
        ? { certCertOrDirectoryPath: context.getOrUndefined("certCertOrDirectoryPath") }
        : {}),
      ...(context?.getOrUndefined?.("roles") ? { roles: context.getOrUndefined("roles") } : {}),
      ...(context?.getOrUndefined?.("user") ? { user: context.getOrUndefined("user") } : {}),
      ...(context?.getOrUndefined?.("msp") ? { msp: context.getOrUndefined("msp") } : {}),
      ...(context?.getOrUndefined?.("ip") ? { ip: context.getOrUndefined("ip") } : {}),
      ...overrides,
    };
  }
}
