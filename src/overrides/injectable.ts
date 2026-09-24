import { InjectablesKeys } from "@decaf-ts/injectable-decorators";
import { Inject, Injectable } from "@nestjs/common";
import { Decoration } from "@decaf-ts/decoration";

Decoration.for(InjectablesKeys.INJECTABLE)
  .extend((original: any) => Injectable()(original))
  .apply();

Decoration.for(InjectablesKeys.INJECT)
  .extend((...args: any[]) => {
    // Maybe require some update on the future...
    const token = args[1] as string;
    Inject(token);
  })
  .apply();
