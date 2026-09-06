import type { CatalogConnector, CatalogPartDefinition, PartCatalog } from "./types.ts";
import { validatePartCatalog } from "./validation.ts";

const SHAFT_KINDS = new Set(["shaft", "bore", "servoSpline", "bearingSeat"]);

function connectorTokens(connector: CatalogConnector) {
  return new Set([
    connector.kind,
    `kind:${connector.kind}`,
    ...(connector.profile ? [connector.profile, `profile:${connector.profile}`] : []),
  ]);
}

function acceptsConnector(candidate: CatalogConnector, other: CatalogConnector) {
  if (candidate.accepts.includes("*")) return true;
  const tokens = connectorTokens(other);
  return candidate.accepts.some((token) => tokens.has(token));
}

export function areConnectorsCompatible(a: CatalogConnector, b: CatalogConnector) {
  if (a.gender !== "neutral" && b.gender !== "neutral" && a.gender === b.gender) {
    return false;
  }
  if (!acceptsConnector(a, b) || !acceptsConnector(b, a)) {
    return false;
  }
  if (
    SHAFT_KINDS.has(a.kind) &&
    SHAFT_KINDS.has(b.kind) &&
    a.diameterM !== undefined &&
    b.diameterM !== undefined &&
    Math.abs(a.diameterM - b.diameterM) > 0.00025
  ) {
    return false;
  }
  return true;
}

export interface CatalogConnectorMatch {
  part: CatalogPartDefinition;
  connector: CatalogConnector;
}

export interface CatalogIndex {
  getPart: (partId: string) => CatalogPartDefinition | undefined;
  getConnector: (partId: string, connectorId: string) => CatalogConnector | undefined;
  search: (query: string) => CatalogPartDefinition[];
  findCompatible: (connector: CatalogConnector) => CatalogConnectorMatch[];
}

export function createCatalogIndex(catalog: PartCatalog): CatalogIndex {
  const result = validatePartCatalog(catalog);
  if (!result.success) {
    const summary = result.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    throw new Error(`Cannot index invalid part catalog. ${summary}`);
  }

  const partsById = new Map(catalog.parts.map((part) => [part.id, part]));
  const searchTextById = new Map(
    catalog.parts.map((part) => [
      part.id,
      [part.name, part.vendor, part.sku, part.category, ...part.tags].join(" ").toLowerCase(),
    ])
  );

  return {
    getPart(partId) {
      return partsById.get(partId);
    },
    getConnector(partId, connectorId) {
      return partsById.get(partId)?.connectors.find((connector) => connector.id === connectorId);
    },
    search(query) {
      const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return [...catalog.parts];
      return catalog.parts.filter((part) => {
        const text = searchTextById.get(part.id) ?? "";
        return tokens.every((token) => text.includes(token));
      });
    },
    findCompatible(connector) {
      return catalog.parts.flatMap((part) =>
        part.connectors
          .filter((candidate) => areConnectorsCompatible(connector, candidate))
          .map((candidate) => ({ part, connector: candidate }))
      );
    },
  };
}
