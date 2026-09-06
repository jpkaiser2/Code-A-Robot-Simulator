import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILT_IN_PART_CATALOG,
  REV_CONTROL_HUB_PART_ID,
} from "./builtInCatalog.ts";
import { areConnectorsCompatible, createCatalogIndex } from "./catalogIndex.ts";
import type { CatalogConnector, PartCatalog } from "./types.ts";
import { validatePartCatalog } from "./validation.ts";

function connector(
  kind: CatalogConnector["kind"],
  gender: CatalogConnector["gender"],
  profile: CatalogConnector["profile"],
  diameterM?: number
): CatalogConnector {
  return {
    id: `${kind}-${gender}`,
    name: `${kind} ${gender}`,
    kind,
    profile,
    frame: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    gender,
    diameterM,
    accepts: profile ? [`profile:${profile}`] : ["*"],
  };
}

test("built-in real-parts catalog is valid with only declared warnings", () => {
  const result = validatePartCatalog(BUILT_IN_PART_CATALOG);
  assert.equal(result.success, true);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["missing-mass"]);
});

test("catalog index resolves and searches the REV Control Hub", () => {
  const index = createCatalogIndex(BUILT_IN_PART_CATALOG);
  assert.equal(index.getPart(REV_CONTROL_HUB_PART_ID)?.sku, "REV-31-1595");
  assert.equal(
    index.getConnector(REV_CONTROL_HUB_PART_ID, "bottom-mount-pattern")?.profile,
    "revPattern"
  );
  assert.deepEqual(index.search("rev controller").map((part) => part.id), [REV_CONTROL_HUB_PART_ID]);
  assert.deepEqual(index.search("not-a-real-part"), []);
});

test("shaft compatibility requires complementary genders, accepted profiles, and close diameters", () => {
  const shaft = connector("shaft", "male", "rex8", 0.008);
  const matchingBore = connector("bore", "female", "rex8", 0.0081);
  const wrongSize = connector("bore", "female", "rex8", 0.009);
  const wrongProfile = connector("bore", "female", "hex", 0.008);
  const secondShaft = connector("shaft", "male", "rex8", 0.008);

  assert.equal(areConnectorsCompatible(shaft, matchingBore), true);
  assert.equal(areConnectorsCompatible(shaft, wrongSize), false);
  assert.equal(areConnectorsCompatible(shaft, wrongProfile), false);
  assert.equal(areConnectorsCompatible(shaft, secondShaft), false);
});

test("catalog index finds compatible connectors across parts", () => {
  const sourceConnector = connector("mountPattern", "neutral", "revPattern");
  const index = createCatalogIndex(BUILT_IN_PART_CATALOG);
  const matches = index.findCompatible(sourceConnector);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].part.id, REV_CONTROL_HUB_PART_ID);
  assert.equal(matches[0].connector.id, "bottom-mount-pattern");
});

test("distributed GLBs without approved permission are rejected", () => {
  const catalog = structuredClone(BUILT_IN_PART_CATALOG) as PartCatalog;
  catalog.parts[0].source.licenseStatus = "permission-required";

  const result = validatePartCatalog(catalog);
  assert.equal(result.success, false);
  assert.equal(
    result.issues.some((issue) => issue.code === "unapproved-distributed-asset"),
    true
  );
});

test("duplicate parts, connectors, and module ports are rejected", () => {
  const catalog = structuredClone(BUILT_IN_PART_CATALOG) as PartCatalog;
  catalog.parts.push(structuredClone(catalog.parts[0]));
  catalog.parts[0].connectors.push(structuredClone(catalog.parts[0].connectors[0]));
  if (catalog.parts[0].device?.kind === "controlHub") {
    catalog.parts[0].device.ports.push(structuredClone(catalog.parts[0].device.ports[0]));
  }

  const result = validatePartCatalog(catalog);
  const codes = new Set(result.issues.map((issue) => issue.code));
  assert.equal(result.success, false);
  assert.equal(codes.has("duplicate-part-id"), true);
  assert.equal(codes.has("duplicate-vendor-sku"), true);
  assert.equal(codes.has("duplicate-connector-id"), true);
  assert.equal(codes.has("duplicate-module-port"), true);
});
