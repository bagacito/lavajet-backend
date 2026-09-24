import { Buffer } from "buffer";
import {
  Account,
  AccountConfig,
  AccountType,
  Audit,
  AuditOperations,
  Batch,
  Entity,
  GtinOwner,
  KeycloakClientConfig,
  KeycloakClientRoleConfig,
  KeycloakIdentityProviderConfig,
  KeycloakSetupConfig,
  KeycloakUser,
  KibanaSetupConfig,
  Leaflet,
  LeafletFile,
  LeafletResolver,
  LeafletType,
  LavajetModuleFeature,
  LavajetModule,
  Product,
  ProductImage,
  ProductMarket,
  ProductStrength,
  Token,
  UserGroup,
} from "@bagacito/lavajet-toolkit";
import { generateGtin, getBatch } from "./gtin-generator";
import { Environment } from "./environment";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toBase64 = (value: string) => Buffer.from(value).toString("base64");

const buildKeycloakUser = (id: string) =>
  new KeycloakUser({
    realm: Environment.keycloak?.realm ?? "bagacito",
    username: `user-${id}`,
    password: "Test123!@#",
  });

const buildKeycloakClientConfig = (id: string) =>
  new KeycloakClientConfig({
    clientId: `client-${id}`,
    secret: "client-secret",
    redirectUris: ["https://localhost"],
    roles: [
      new KeycloakClientRoleConfig({
        roleName: "manage",
        claimValue: "manage",
        description: "Manage resources",
      }),
    ],
  });

const buildKeycloakSetup = (id: string) =>
  new KeycloakSetupConfig({
    id: `kc-${id}`,
    host: "keycloak.lavajet.internal",
    protocol: "https",
    adminApiUser: buildKeycloakUser(`${id}-admin`),
    realmApiUser: buildKeycloakUser(`${id}-realm`),
    client: buildKeycloakClientConfig(id),
    identityProvider: new KeycloakIdentityProviderConfig({
      alias: "azure",
      displayName: "Azure",
      tenantId: "azure-tenant",
      clientId: "azure-client",
      clientSecret: "azure-secret",
      mapperClaimName: "groups",
    }),
  });

const buildKibanaSetup = (id: string) =>
  new KibanaSetupConfig({
    id: `kibana-${id}`,
    host: "kibana.lavajet.internal",
    protocol: "https",
    realm: Environment.keycloak?.realm ?? "bagacito",
  });

export const buildAccountPayload = (overrides: Partial<Account> = {}) => {
  const idSuffix = overrides.id ?? `account-${suffix()}`;
  return new Account({
    id: idSuffix,
    mspId: overrides.mspId ?? `msp-${suffix()}`,
    classification: overrides.classification ?? AccountType.MAH,
    token: overrides.token ?? `token-${suffix()}`,
    onPrem: overrides.onPrem ?? true,
    claimed: overrides.claimed ?? false,
    endpoint: overrides.endpoint ?? `https://account-${suffix()}.lavajet.internal`,
    keycloakSetupConfig:
      overrides.keycloakSetupConfig ?? buildKeycloakSetup(idSuffix),
    kibanaSetupConfig:
      overrides.kibanaSetupConfig ?? buildKibanaSetup(idSuffix),
    ...overrides,
  });
};

export const buildProductPayload = (overrides: Partial<Product> = {}) => {
  const productCode = overrides.productCode ?? generateGtin();
  return new Product({
    productCode,
    inventedName: overrides.inventedName ?? `Product ${productCode.slice(-6)}`,
    nameMedicinalProduct:
      overrides.nameMedicinalProduct ?? `Medicinal ${productCode.slice(-6)}`,
    owner: overrides.owner ?? `owner-${suffix()}`,
    productRecall: overrides.productRecall ?? false,
    strengths: overrides.strengths ?? [
      new ProductStrength({
        productCode,
        strength: "100mg",
        substance: "Ibuprofen",
      }),
      new ProductStrength({
        productCode,
        strength: "200mg",
        substance: "Ibuprofen",
      }),
    ],
    markets: overrides.markets ?? [
      new ProductMarket({
        productCode,
        marketId: "BR",
        nationalCode: "BR",
        mahName: "Pharma Brazil",
      }),
    ],
    ...overrides,
  });
};

const buildModuleFeature = (id: string) =>
  new LavajetModuleFeature({
    id: `feature-${id}`,
    name: `Feature ${id}`,
    description: "Module feature test",
    module: `module-${id}`,
  });

export const buildAccountConfigPayload = () => {
  const id = suffix();
  return new AccountConfig({
    account: `account-${id}`,
    modules: [
      new LavajetModule({ id: `module-${id}`, features: [buildModuleFeature(id)] }),
    ],
    features: [buildModuleFeature(`${id}-extra`)],
  });
};

export const buildAuditPayload = () =>
  new Audit({
    id: `audit-${suffix()}`,
    userId: `user-${suffix()}`,
    userGroup: UserGroup.ADMIN,
    model: "audit",
    transaction: "create",
    action: AuditOperations.ADD,
    diffs: { field: "value" },
  });

export const buildBatchPayload = (overrides: Partial<Batch> = {}) =>
  new Batch({
    id: overrides.id ?? `batch-${suffix()}`,
    productCode: overrides.productCode ?? generateGtin(),
    batchNumber: overrides.batchNumber ?? getBatch(),
    expiryDate:
      overrides.expiryDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    batchRecall: overrides.batchRecall ?? false,
    importLicenseNumber: overrides.importLicenseNumber,
    manufacturerName: overrides.manufacturerName,
    manufacturerAddress: overrides.manufacturerAddress,
    packagingSiteName: overrides.packagingSiteName,
    ...overrides,
  });

export const buildEntityPayload = () =>
  new Entity({
    id: `entity-${suffix()}`,
    endpoint: `https://entity-${suffix()}.lavajet.internal`,
  });

export const buildGtinOwnerPayload = () =>
  new GtinOwner({
    productCode: generateGtin(),
    ownedBy: `owner-${suffix()}`,
  });

export const buildKeycloakConfigPayload = () => buildKeycloakSetup(suffix());

export const buildKibanaConfigPayload = () => buildKibanaSetup(suffix());

export type LeafletPayloadOptions = Partial<Leaflet> & {
  productCode?: string;
  leafletType?: LeafletType;
  lang?: string;
  epiMarket?: string;
  batchNumber?: string;
  xmlFileContent?: LeafletFile;
  otherFilesContent?: string[];
};

export const buildLeafletPayload = (
  options: LeafletPayloadOptions = {}
): Leaflet => {
  const code = options.productCode ?? generateGtin();
  const type = options.leafletType ?? LeafletType.leaflet;
  const lang = options.lang ?? "en";
  const batchNumber = options.batchNumber ?? getBatch();
  const idParts = [code, batchNumber, type, lang].filter(Boolean);
  const id = options.id ?? idParts.join(":") ?? `leaflet-${suffix()}`;
  return new Leaflet({
    id,
    productCode: code,
    batchNumber: batchNumber,
    leafletType: type,
    lang,
    epiMarket: options.epiMarket ?? "BR",
    xmlFileContent:
      options.xmlFileContent ?? buildLeafletFilePayload({ leafletId: id }),
    ...options,
  });
};

export const buildLeafletFilePayload = (options: Partial<LeafletFile> = {}) =>
  new LeafletFile({
    id: options.id ?? `leaflet-file-${suffix()}`,
    leafletId: options.leafletId ?? `leaflet-${suffix()}`,
    fileName: options.fileName ?? "leaflet-file.xml",
    fileContent: options.fileContent ?? toBase64("file content"),
  });

export const buildLeafletResolverPayload = () =>
  new LeafletResolver({
    id: `resolver-${suffix()}`,
    urlString: `https://resolver.example/${suffix()}`,
  });

export const buildMarketPayload = () => {
  const code = generateGtin();
  return new ProductMarket({
    id: `market-${suffix()}`,
    productCode: code,
    marketId: `market-${suffix()}`,
    nationalCode: `NC-${suffix()}`,
    mahName: `Mah ${suffix()}`,
    legalEntityName: `Entity ${suffix()}`,
  });
};

export const buildModulePayload = () => {
  const id = suffix();
  return new LavajetModule({
    id: `module-${id}`,
    features: [buildModuleFeature(id)],
  });
};

export const buildModuleFeaturePayload = () => buildModuleFeature(suffix());

export const buildProductImagePayload = () =>
  new ProductImage({
    productCode: generateGtin(),
    content: toBase64("image-bytes"),
  });

export const buildProductStrengthPayload = () =>
  new ProductStrength({
    productCode: generateGtin(),
    strength: "100mg",
    substance: "Ibuprofen",
  });

export const buildTokenPayload = () =>
  new Token({
    id: `token-${suffix()}`,
    mspid: `msp-${suffix()}`,
    classification: AccountType.MAH,
    expiredAt: new Date(Date.now() + 86400 * 1000),
    active: true,
    claimed: false,
  });
