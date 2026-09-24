import { DecafRequestContext, DecafRequestHandler } from "@decaf-ts/for-nest";

export class ImpersonateHandler implements DecafRequestHandler<any> {
  async handle(context: DecafRequestContext<any>, req: Request): Promise<void> {
    const overrides = (req as any)?.overrides;
    if (overrides && typeof overrides === "object") {
      context.put(overrides);
    }
  }
}
