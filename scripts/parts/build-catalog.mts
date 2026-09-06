import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUILT_IN_PART_CATALOG,
  REV_CONTROL_HUB_PART_ID,
} from "../../lib/robot/catalog/builtInCatalog.ts";
import type { CatalogPartDefinition, PartCatalog } from "../../lib/robot/catalog/types.ts";
import { validatePartCatalog } from "../../lib/robot/catalog/validation.ts";
import { generateControlHubAsset } from "./generateControlHubAsset.mts";

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const MAX_ASSET_BYTES = 500_000;
const MAX_ASSET_TRIANGLES = 10_000;

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const publicRoot = path.join(repositoryRoot, "public");
const manifestPath = path.join(publicRoot, "robot-parts", "catalog.json");

const generators = new Map<string, (outputPath: string) => Promise<void>>([
  [REV_CONTROL_HUB_PART_ID, generateControlHubAsset],
]);

interface GlbInfo {
  byteSize: number;
  sha256: string;
  triangleCount: number;
}

function resolvePublicAsset(uri: string) {
  if (!uri.startsWith("/robot-parts/") || !uri.toLowerCase().endsWith(".glb")) {
    throw new Error(`Catalog GLB URI must be under /robot-parts and end in .glb: ${uri}`);
  }
  const resolved = path.resolve(publicRoot, uri.slice(1));
  if (!resolved.startsWith(`${path.resolve(publicRoot)}${path.sep}`)) {
    throw new Error(`Catalog asset escapes the public directory: ${uri}`);
  }
  return resolved;
}

function inspectGlb(bytes: Buffer): GlbInfo {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("Asset is not a binary glTF file.");
  }
  if (bytes.readUInt32LE(4) !== 2) {
    throw new Error("Only glTF binary version 2 is supported.");
  }
  if (bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("GLB header length does not match the file size.");
  }
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== GLB_JSON_CHUNK || 20 + jsonLength > bytes.length) {
    throw new Error("GLB does not begin with a valid JSON chunk.");
  }

  const jsonText = bytes.subarray(20, 20 + jsonLength).toString("utf8").trim();
  const gltf = JSON.parse(jsonText) as {
    accessors?: Array<{ count?: number }>;
    meshes?: Array<{ primitives?: Array<{ mode?: number; indices?: number; attributes?: { POSITION?: number } }> }>;
  };
  const accessors = gltf.accessors ?? [];
  let triangleCount = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
      const elementCount = accessorIndex === undefined ? 0 : accessors[accessorIndex]?.count ?? 0;
      triangleCount += Math.floor(elementCount / 3);
    }
  }

  return {
    byteSize: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    triangleCount,
  };
}

async function buildPart(part: CatalogPartDefinition): Promise<CatalogPartDefinition> {
  if (part.visual.kind !== "glb" || !part.visual.uri) return part;

  const assetPath = resolvePublicAsset(part.visual.uri);
  const generator = generators.get(part.id);
  if (generator) await generator(assetPath);

  const info = inspectGlb(await readFile(assetPath));
  if (info.byteSize > MAX_ASSET_BYTES) {
    throw new Error(`${part.id} exceeds the ${MAX_ASSET_BYTES}-byte asset budget.`);
  }
  if (info.triangleCount > MAX_ASSET_TRIANGLES) {
    throw new Error(`${part.id} exceeds the ${MAX_ASSET_TRIANGLES}-triangle asset budget.`);
  }

  return {
    ...part,
    visual: {
      ...part.visual,
      ...info,
    },
  };
}

async function main() {
  const sourceValidation = validatePartCatalog(BUILT_IN_PART_CATALOG);
  if (!sourceValidation.success) {
    throw new Error(
      sourceValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")
    );
  }

  const catalog: PartCatalog = {
    ...BUILT_IN_PART_CATALOG,
    parts: await Promise.all(BUILT_IN_PART_CATALOG.parts.map(buildPart)),
  };
  const outputValidation = validatePartCatalog(catalog);
  if (!outputValidation.success) {
    throw new Error(
      outputValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")
    );
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const warnings = outputValidation.issues.filter((issue) => issue.severity === "warning");
  warnings.forEach((issue) => process.stdout.write(`warning ${issue.path}: ${issue.message}\n`));
  process.stdout.write(
    `Built ${catalog.parts.length} catalog part and wrote ${path.relative(repositoryRoot, manifestPath)}.\n`
  );
}

void main().catch((buildError) => {
  process.stderr.write(
    `${buildError instanceof Error ? buildError.message : String(buildError)}\n`
  );
  process.exitCode = 1;
});
