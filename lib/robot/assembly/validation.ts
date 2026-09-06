import { areConnectorsCompatible, createCatalogIndex } from "../catalog/catalogIndex.ts";
import type { CatalogConnector, PartCatalog } from "../catalog/types.ts";
import type { ConnectionEndpoint, PartInstance, RobotDocumentV3 } from "../schema/types.ts";
import { computeSnappedInstanceTransform, quantizeConnectorRotation } from "./operations.ts";
import { transformsApproximatelyEqual } from "./transformMath.ts";

export interface AssemblyValidationIssue {
  code:
    | "catalog-version-mismatch"
    | "unknown-catalog-part"
    | "unknown-connector"
    | "incompatible-connectors"
    | "occupied-connector"
    | "rigid-cycle"
    | "invalid-rotation-offset"
    | "misaligned-connection";
  message: string;
  path: string;
}

export interface AssemblyValidationResult {
  success: boolean;
  issues: AssemblyValidationIssue[];
}

interface ResolvedEndpoint {
  instance: PartInstance;
  connector: CatalogConnector;
}

export function validateAssemblyAgainstCatalog(
  document: RobotDocumentV3,
  catalog: PartCatalog,
  alignmentToleranceM = 1e-6
): AssemblyValidationResult {
  const issues: AssemblyValidationIssue[] = [];
  const catalogIndex = createCatalogIndex(catalog);
  const instances = new Map(document.instances.map((instance) => [instance.id, instance]));
  const parents = new Map(document.instances.map((instance) => [instance.id, instance.id]));
  const occupiedEndpoints = new Map<string, string>();

  const findRoot = (id: string): string => {
    const parent = parents.get(id);
    if (!parent || parent === id) return id;
    const root = findRoot(parent);
    parents.set(id, root);
    return root;
  };
  const join = (a: string, b: string) => {
    const rootA = findRoot(a);
    const rootB = findRoot(b);
    if (rootA === rootB) return false;
    parents.set(rootB, rootA);
    return true;
  };

  if (document.catalogVersion !== catalog.version) {
    issues.push({
      code: "catalog-version-mismatch",
      path: "catalogVersion",
      message: `Robot uses catalog "${document.catalogVersion}" but "${catalog.version}" is loaded.`,
    });
  }

  document.instances.forEach((instance, index) => {
    if (!catalogIndex.getPart(instance.catalogPartId)) {
      issues.push({
        code: "unknown-catalog-part",
        path: `instances[${index}].catalogPartId`,
        message: `Unknown catalog part "${instance.catalogPartId}".`,
      });
    }
  });

  const resolveEndpoint = (
    endpoint: ConnectionEndpoint,
    path: string
  ): ResolvedEndpoint | undefined => {
    const instance = instances.get(endpoint.instanceId);
    if (!instance) return undefined; // Structural schema validation owns missing instance IDs.
    const connector = catalogIndex.getConnector(instance.catalogPartId, endpoint.connectorId);
    if (!connector) {
      issues.push({
        code: "unknown-connector",
        path: `${path}.connectorId`,
        message: `Part "${instance.catalogPartId}" has no connector "${endpoint.connectorId}".`,
      });
      return undefined;
    }
    return { instance, connector };
  };

  document.connections.forEach((connection, index) => {
    const path = `connections[${index}]`;
    const a = resolveEndpoint(connection.a, `${path}.a`);
    const b = resolveEndpoint(connection.b, `${path}.b`);

    for (const [side, endpoint] of [
      ["a", connection.a],
      ["b", connection.b],
    ] as const) {
      const key = `${endpoint.instanceId}\0${endpoint.connectorId}`;
      const priorPath = occupiedEndpoints.get(key);
      if (priorPath) {
        issues.push({
          code: "occupied-connector",
          path: `${path}.${side}`,
          message: `Connector is already used by ${priorPath}.`,
        });
      } else {
        occupiedEndpoints.set(key, `${path}.${side}`);
      }
    }

    if (!join(connection.a.instanceId, connection.b.instanceId)) {
      issues.push({
        code: "rigid-cycle",
        path,
        message: "Connection creates a cycle in the rigid assembly graph.",
      });
    }

    if (!a || !b) return;
    if (!areConnectorsCompatible(a.connector, b.connector)) {
      issues.push({
        code: "incompatible-connectors",
        path,
        message: "Connected catalog connectors are incompatible.",
      });
      return;
    }

    const quantized = quantizeConnectorRotation(
      connection.rotationOffsetRad,
      a.connector,
      b.connector
    );
    if (Math.abs(quantized - connection.rotationOffsetRad) > 1e-8) {
      issues.push({
        code: "invalid-rotation-offset",
        path: `${path}.rotationOffsetRad`,
        message: "Rotation offset is not one of the connector pair's allowed orientations.",
      });
    }
    const expectedB = computeSnappedInstanceTransform(
      a.instance.transform,
      a.connector,
      b.connector,
      connection.rotationOffsetRad,
      connection.translationOffsetM
    );
    if (!transformsApproximatelyEqual(expectedB, b.instance.transform, alignmentToleranceM)) {
      issues.push({
        code: "misaligned-connection",
        path,
        message: "Connected part transforms do not align their connector frames.",
      });
    }
  });

  return { success: issues.length === 0, issues };
}
