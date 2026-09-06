import {
  areConnectorsCompatible,
  createCatalogIndex,
  type CatalogIndex,
} from "../catalog/catalogIndex.ts";
import type { CatalogConnector, PartCatalog } from "../catalog/types.ts";
import type {
  ConnectionEndpoint,
  PartInstance,
  RigidTransform,
  RobotDocumentV3,
  StructuralConnection,
} from "../schema/types.ts";
import { getRigidComponent } from "./assemblyGraph.ts";
import {
  axisAngleQuaternion,
  composeTransforms,
  invertTransform,
} from "./transformMath.ts";

export type AssemblyErrorCode =
  | "duplicate-connection-id"
  | "unknown-instance"
  | "unknown-catalog-part"
  | "unknown-connector"
  | "incompatible-connectors"
  | "occupied-connector"
  | "self-connection"
  | "would-create-cycle"
  | "unknown-connection";

export class AssemblyOperationError extends Error {
  constructor(
    readonly code: AssemblyErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AssemblyOperationError";
  }
}

export interface ConnectInstancesInput {
  id: string;
  name: string;
  stationary: ConnectionEndpoint;
  moving: ConnectionEndpoint;
  rotationOffsetRad?: number;
  translationOffsetM?: [number, number, number];
  fastenerCatalogPartId?: string;
}

export interface ConnectInstancesResult {
  document: RobotDocumentV3;
  connection: StructuralConnection;
  movedInstanceIds: string[];
}

function resolveEndpoint(
  document: RobotDocumentV3,
  catalogIndex: CatalogIndex,
  endpoint: ConnectionEndpoint
): { instance: PartInstance; connector: CatalogConnector } {
  const instance = document.instances.find((candidate) => candidate.id === endpoint.instanceId);
  if (!instance) {
    throw new AssemblyOperationError("unknown-instance", `Unknown instance "${endpoint.instanceId}".`);
  }
  const catalogPart = catalogIndex.getPart(instance.catalogPartId);
  if (!catalogPart) {
    throw new AssemblyOperationError(
      "unknown-catalog-part",
      `Instance "${instance.id}" references unknown catalog part "${instance.catalogPartId}".`
    );
  }
  const connector = catalogPart.connectors.find((candidate) => candidate.id === endpoint.connectorId);
  if (!connector) {
    throw new AssemblyOperationError(
      "unknown-connector",
      `Part "${catalogPart.id}" has no connector "${endpoint.connectorId}".`
    );
  }
  return { instance, connector };
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) [left, right] = [right, left % right];
  return left;
}

export function quantizeConnectorRotation(
  requestedRad: number,
  stationary: CatalogConnector,
  moving: CatalogConnector
) {
  const steps =
    stationary.rotationSteps && moving.rotationSteps
      ? greatestCommonDivisor(stationary.rotationSteps, moving.rotationSteps)
      : stationary.rotationSteps ?? moving.rotationSteps;
  if (!steps) return requestedRad;
  const increment = (Math.PI * 2) / steps;
  return Math.round(requestedRad / increment) * increment;
}

/**
 * Computes the instance transform that makes its connector coincide with the stationary connector.
 * Offsets are expressed in the stationary connector frame; rotation is around connector-local +Z.
 */
export function computeSnappedInstanceTransform(
  stationaryInstance: RigidTransform,
  stationaryConnector: CatalogConnector,
  movingConnector: CatalogConnector,
  rotationOffsetRad = 0,
  translationOffsetM: [number, number, number] = [0, 0, 0]
) {
  const quantizedRotation = quantizeConnectorRotation(
    rotationOffsetRad,
    stationaryConnector,
    movingConnector
  );
  const stationaryWorldFrame = composeTransforms(stationaryInstance, stationaryConnector.frame);
  const authoredOffset: RigidTransform = {
    position: translationOffsetM,
    rotation: axisAngleQuaternion([0, 0, 1], quantizedRotation),
  };
  const desiredMovingConnectorFrame = composeTransforms(stationaryWorldFrame, authoredOffset);
  return composeTransforms(desiredMovingConnectorFrame, invertTransform(movingConnector.frame));
}

export function transformRigidComponent(
  document: RobotDocumentV3,
  anchorInstanceId: string,
  targetTransform: RigidTransform
) {
  const anchor = document.instances.find((instance) => instance.id === anchorInstanceId);
  if (!anchor) {
    throw new AssemblyOperationError("unknown-instance", `Unknown instance "${anchorInstanceId}".`);
  }
  const componentIds = getRigidComponent(document, anchorInstanceId);
  const component = new Set(componentIds);
  const delta = composeTransforms(targetTransform, invertTransform(anchor.transform));
  return {
    document: {
      ...document,
      instances: document.instances.map((instance) =>
        component.has(instance.id)
          ? { ...instance, transform: composeTransforms(delta, instance.transform) }
          : instance
      ),
    },
    movedInstanceIds: componentIds,
  };
}

export function connectInstances(
  document: RobotDocumentV3,
  catalog: PartCatalog,
  input: ConnectInstancesInput
): ConnectInstancesResult {
  if (document.connections.some((connection) => connection.id === input.id)) {
    throw new AssemblyOperationError("duplicate-connection-id", `Connection "${input.id}" already exists.`);
  }
  if (input.stationary.instanceId === input.moving.instanceId) {
    throw new AssemblyOperationError("self-connection", "A part cannot connect to itself.");
  }
  const catalogIndex = createCatalogIndex(catalog);
  const stationary = resolveEndpoint(document, catalogIndex, input.stationary);
  const moving = resolveEndpoint(document, catalogIndex, input.moving);
  if (!areConnectorsCompatible(stationary.connector, moving.connector)) {
    throw new AssemblyOperationError("incompatible-connectors", "The selected connectors are incompatible.");
  }
  for (const endpoint of [input.stationary, input.moving]) {
    const occupied = document.connections.some(
      (connection) =>
        (connection.a.instanceId === endpoint.instanceId &&
          connection.a.connectorId === endpoint.connectorId) ||
        (connection.b.instanceId === endpoint.instanceId &&
          connection.b.connectorId === endpoint.connectorId)
    );
    if (occupied) {
      throw new AssemblyOperationError(
        "occupied-connector",
        `Connector "${endpoint.instanceId}:${endpoint.connectorId}" is already connected.`
      );
    }
  }

  const movingIds = getRigidComponent(document, input.moving.instanceId);
  if (movingIds.includes(input.stationary.instanceId)) {
    throw new AssemblyOperationError(
      "would-create-cycle",
      "The selected instances already belong to the same rigid assembly."
    );
  }

  const rotationOffsetRad = quantizeConnectorRotation(
    input.rotationOffsetRad ?? 0,
    stationary.connector,
    moving.connector
  );
  const translationOffsetM = input.translationOffsetM ?? [0, 0, 0];
  const target = computeSnappedInstanceTransform(
    stationary.instance.transform,
    stationary.connector,
    moving.connector,
    rotationOffsetRad,
    translationOffsetM
  );
  const transformed = transformRigidComponent(document, moving.instance.id, target);
  const connection: StructuralConnection = {
    id: input.id,
    name: input.name,
    a: { ...input.stationary },
    b: { ...input.moving },
    rotationOffsetRad,
    translationOffsetM: [...translationOffsetM],
    ...(input.fastenerCatalogPartId
      ? { fastenerCatalogPartId: input.fastenerCatalogPartId }
      : {}),
  };

  return {
    document: {
      ...transformed.document,
      connections: [...transformed.document.connections, connection],
    },
    connection,
    movedInstanceIds: transformed.movedInstanceIds,
  };
}

export function disconnectInstances(document: RobotDocumentV3, connectionId: string) {
  const connection = document.connections.find((candidate) => candidate.id === connectionId);
  if (!connection) {
    throw new AssemblyOperationError("unknown-connection", `Unknown connection "${connectionId}".`);
  }
  return {
    document: {
      ...document,
      connections: document.connections.filter((candidate) => candidate.id !== connectionId),
    },
    connection,
  };
}
