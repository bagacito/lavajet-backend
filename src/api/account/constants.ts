import { LavajetModule, LavajetModuleFeature } from "@bagacito/lavajet-toolkit";

export const epiFeatures = [
  {
    name: "recall",
    description: "supports signalling a product/batch is recalled",
    module: "epi",
  },
  {
    name: "expiry",
    description: "supports signalling the batch is expired",
    module: "epi",
  },
].map((f) => new LavajetModuleFeature(f));

export const EpiModule = new LavajetModule({
  id: "epi",
  features: epiFeatures,
});
