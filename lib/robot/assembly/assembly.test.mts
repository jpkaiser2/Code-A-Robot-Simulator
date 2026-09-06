import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogConnector, CatalogPartDefinition, PartCatalog } from "../catalog/types.ts";
import {
  ROBOT_DOCUMENT_SCHEMA_VERSION,
  type RigidTransform,
  type RobotDocumentV3,
} from "../schema/types.ts";
import { getRigidComponent } from "./assemblyGraph.ts";
import {
  AssemblyHistory,
  createConnectCommand,
  createDisconnectCommand,
  createMoveRigidComponentCommand,
} from "./history.ts";
import {
  AssemblyOperationError,
  computeSnappedInstanceTransform,
  connectInstances,
  quantizeConnectorRotation,
} from "./operations.ts";
import {
  axisAngleQuaternion,
  composeTransforms,
  invertTransform,
  transformsApproximatelyEqual,
} from "./transformMath.ts";
import { validateAssemblyAgainstCatalog } from "./validation.ts";

const identity: RigidTransform = { position: [0, 0, 0], rotation: [0, 0, 0, 1] };

function connector(id: string, position: [number, number, number]): CatalogConnector {
  return {
    id,
    name: id,
    kind: "mountPoint",
    profile: "custom",
    frame: { position, rotation: [0, 0, 0, 1] },
    gender: "neutral",
    accepts: ["kind:mountPoint"],
    rotationSteps: 4,
  };
}

function part(id: string): CatalogPartDefinition {
  return {
    id: `test:${id}`,
    vendor: "Code-A-Robot",
    sku: id,
    name: id,
    category: "structure",
    lifecycle: "active",
    source: {
      productUrl: "https://codearobot.org/",
      retrievedAt: "2026-09-05",
      licenseStatus: "approved",
    },
    visual: {
      kind: "procedural-placeholder",
      boundsM: [0.1, 0.1, 0.1],
      origin: { position: [...identity.position], rotation: [...identity.rotation] },
    },
    physical: {
      massKg: 1,
      colliders: [{ kind: "box", center: [0, 0, 0], halfExtents: [0.05, 0.05, 0.05] }],
    },
    connectors: [connector("attach", [0.5, 0, 0]), connector("group", [-0.5, 0, 0])],
    tags: ["test"],
  };
}

const catalog: PartCatalog = {
  version: "test.1",
  generatedAt: "2026-09-05T00:00:00.000Z",
  parts: [part("a"), part("b"), part("c")],
};

function document(): RobotDocumentV3 {
  return {
    schemaVersion: ROBOT_DOCUMENT_SCHEMA_VERSION,
    id: "assembly-test",
    name: "Assembly Test",
    units: "m",
    catalogVersion: catalog.version,
    instances: [
      {
        id: "a",
        catalogPartId: "test:a",
        name: "A",
        transform: { position: [1, 0, 0], rotation: axisAngleQuaternion([0, 0, 1], Math.PI / 2) },
      },
      {
        id: "b",
        catalogPartId: "test:b",
        name: "B",
        transform: { position: [5, 0, 0], rotation: [0, 0, 0, 1] },
      },
      {
        id: "c",
        catalogPartId: "test:c",
        name: "C",
        transform: { position: [6, 0, 0], rotation: [0, 0, 0, 1] },
      },
    ],
    connections: [],
    joints: [],
    transmissions: [],
    hardware: { modules: [], devices: [] },
    metadata: {
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
    },
  };
}

function expectOperationError(action: () => unknown, code: AssemblyOperationError["code"]) {
  assert.throws(action, (error) => error instanceof AssemblyOperationError && error.code === code);
}

test("rigid transform composition and inversion round-trip", () => {
  const transform = {
    position: [1, -2, 3] as [number, number, number],
    rotation: axisAngleQuaternion([1, 2, 3], 1.2),
  };
  assert.equal(
    transformsApproximatelyEqual(composeTransforms(transform, invertTransform(transform)), identity),
    true
  );
});

test("connector snapping aligns world frames and quantizes allowed rotation", () => {
  const stationary = catalog.parts[0].connectors[0];
  const moving = catalog.parts[1].connectors[0];
  const stationaryTransform = document().instances[0].transform;
  const snapped = computeSnappedInstanceTransform(
    stationaryTransform,
    stationary,
    moving,
    1.4,
    [0, 0, 0.02]
  );
  const actualMovingFrame = composeTransforms(snapped, moving.frame);
  const expectedMovingFrame = composeTransforms(
    composeTransforms(stationaryTransform, stationary.frame),
    { position: [0, 0, 0.02], rotation: axisAngleQuaternion([0, 0, 1], Math.PI / 2) }
  );

  assert.equal(quantizeConnectorRotation(1.4, stationary, moving), Math.PI / 2);
  assert.equal(transformsApproximatelyEqual(actualMovingFrame, expectedMovingFrame), true);
});

test("connecting moves the complete moving rigid group and preserves internal poses", () => {
  const source = document();
  source.connections.push({
    id: "b-c",
    name: "Existing B-C group",
    a: { instanceId: "b", connectorId: "group" },
    b: { instanceId: "c", connectorId: "attach" },
    rotationOffsetRad: 0,
    translationOffsetM: [0, 0, 0],
  });
  const beforeB = source.instances[1].transform;
  const beforeC = source.instances[2].transform;
  const relativeBefore = composeTransforms(invertTransform(beforeB), beforeC);

  const result = connectInstances(source, catalog, {
    id: "a-b",
    name: "Attach assembly",
    stationary: { instanceId: "a", connectorId: "attach" },
    moving: { instanceId: "b", connectorId: "attach" },
  });
  const afterB = result.document.instances[1].transform;
  const afterC = result.document.instances[2].transform;

  assert.deepEqual(result.movedInstanceIds, ["b", "c"]);
  assert.deepEqual(source.instances[1].transform, beforeB);
  assert.equal(
    transformsApproximatelyEqual(composeTransforms(invertTransform(afterB), afterC), relativeBefore),
    true
  );
  assert.equal(
    transformsApproximatelyEqual(
      composeTransforms(result.document.instances[0].transform, catalog.parts[0].connectors[0].frame),
      composeTransforms(afterB, catalog.parts[1].connectors[0].frame)
    ),
    true
  );
});

test("rigid component traversal is stable and joints do not merge components", () => {
  const source = document();
  source.connections.push({
    id: "b-c",
    name: "B-C",
    a: { instanceId: "b", connectorId: "group" },
    b: { instanceId: "c", connectorId: "attach" },
    rotationOffsetRad: 0,
    translationOffsetM: [0, 0, 0],
  });
  source.joints.push({
    id: "a-b-joint",
    name: "A-B joint",
    kind: "continuous",
    parentInstanceId: "a",
    childInstanceId: "b",
    parentFrame: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    childFrame: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    axis: [0, 0, 1],
    dynamics: { damping: 0, friction: 0 },
    initialPosition: 0,
    collisionBetweenBodies: false,
  });

  assert.deepEqual(getRigidComponent(source, "b"), ["b", "c"]);
  assert.deepEqual(getRigidComponent(source, "a"), ["a"]);
});

test("connect rejects occupied connectors, incompatible connectors, and rigid cycles", () => {
  const occupied = document();
  occupied.connections.push({
    id: "existing",
    name: "Existing",
    a: { instanceId: "a", connectorId: "attach" },
    b: { instanceId: "b", connectorId: "attach" },
    rotationOffsetRad: 0,
    translationOffsetM: [0, 0, 0],
  });
  expectOperationError(
    () =>
      connectInstances(occupied, catalog, {
        id: "occupied",
        name: "Occupied",
        stationary: { instanceId: "a", connectorId: "attach" },
        moving: { instanceId: "c", connectorId: "attach" },
      }),
    "occupied-connector"
  );

  const incompatibleCatalog = structuredClone(catalog);
  incompatibleCatalog.parts[1].connectors[0].accepts = ["profile:rex8"];
  expectOperationError(
    () =>
      connectInstances(document(), incompatibleCatalog, {
        id: "bad",
        name: "Bad",
        stationary: { instanceId: "a", connectorId: "attach" },
        moving: { instanceId: "b", connectorId: "attach" },
      }),
    "incompatible-connectors"
  );

  const cyclic = document();
  cyclic.connections.push({
    id: "existing",
    name: "Existing",
    a: { instanceId: "a", connectorId: "group" },
    b: { instanceId: "b", connectorId: "group" },
    rotationOffsetRad: 0,
    translationOffsetM: [0, 0, 0],
  });
  expectOperationError(
    () =>
      connectInstances(cyclic, catalog, {
        id: "cycle",
        name: "Cycle",
        stationary: { instanceId: "a", connectorId: "attach" },
        moving: { instanceId: "b", connectorId: "attach" },
      }),
    "would-create-cycle"
  );
});

test("history performs deterministic connect, disconnect, move, undo, and redo", () => {
  const original = document();
  const history = new AssemblyHistory(original);
  const connected = history.execute(
    createConnectCommand(catalog, {
      id: "a-b",
      name: "A-B",
      stationary: { instanceId: "a", connectorId: "attach" },
      moving: { instanceId: "b", connectorId: "attach" },
    })
  );
  assert.equal(connected.connections.length, 1);

  const disconnected = history.execute(createDisconnectCommand("a-b"));
  assert.equal(disconnected.connections.length, 0);
  const moved = history.execute(
    createMoveRigidComponentCommand("b", {
      position: [8, 9, 10],
      rotation: [0, 0, 0, 1],
    })
  );
  assert.deepEqual(moved.instances[1].transform.position, [8, 9, 10]);

  assert.equal(history.undo(), disconnected);
  assert.equal(history.undo(), connected);
  assert.equal(history.undo(), original);
  assert.equal(history.canUndo, false);
  assert.equal(history.redo(), connected);
  assert.equal(history.redo(), disconnected);
  assert.equal(history.redo(), moved);
  assert.equal(history.canRedo, false);
});

test("catalog-aware validation accepts command output and catches tampered imports", () => {
  const connected = connectInstances(document(), catalog, {
    id: "a-b",
    name: "A-B",
    stationary: { instanceId: "a", connectorId: "attach" },
    moving: { instanceId: "b", connectorId: "attach" },
  }).document;
  assert.deepEqual(validateAssemblyAgainstCatalog(connected, catalog), {
    success: true,
    issues: [],
  });

  const tampered = structuredClone(connected);
  tampered.instances[1].transform.position[0] += 0.01;
  tampered.connections[0].rotationOffsetRad = 0.2;
  tampered.catalogVersion = "wrong-version";
  const result = validateAssemblyAgainstCatalog(tampered, catalog);
  const codes = new Set(result.issues.map((issue) => issue.code));
  assert.equal(result.success, false);
  assert.equal(codes.has("catalog-version-mismatch"), true);
  assert.equal(codes.has("invalid-rotation-offset"), true);
  assert.equal(codes.has("misaligned-connection"), true);
});
