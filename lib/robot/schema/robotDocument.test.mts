import assert from "node:assert/strict";
import test from "node:test";

import { createReferenceMechanismDocument } from "../fixtures/referenceMechanism.ts";
import { importRobotDocumentValue } from "./migration.ts";
import {
  parseRobotDocumentJson,
  parseRobotDocumentValue,
  RobotDocumentValidationError,
  serializeRobotDocument,
} from "./serialization.ts";
import type { RobotDocumentV3 } from "./types.ts";
import { validateRobotDocument } from "./validation.ts";

function cloneFixture(): RobotDocumentV3 {
  return structuredClone(createReferenceMechanismDocument());
}

function issueCodes(result: ReturnType<typeof validateRobotDocument>) {
  return new Set(result.issues.map((issue) => issue.code));
}

test("reference mechanism is a valid v3 robot document", () => {
  const result = validateRobotDocument(createReferenceMechanismDocument());
  assert.equal(result.success, true);
  assert.deepEqual(result.issues, []);
});

test("serialization round-trips the reference mechanism", () => {
  const fixture = createReferenceMechanismDocument();
  const json = serializeRobotDocument(fixture);
  const parsed = parseRobotDocumentJson(json);

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.document, fixture);
  }
});

test("parser normalizes quaternions and movable joint axes", () => {
  const fixture = cloneFixture();
  fixture.instances[0].transform.rotation = [0, 0, 0, 2];
  fixture.joints[0].axis = [0, 0, 4];

  const result = parseRobotDocumentValue(fixture);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.document.instances[0].transform.rotation, [0, 0, 0, 1]);
    assert.deepEqual(result.document.joints[0].axis, [0, 0, 1]);
    assert.deepEqual(result.issues, []);
  }
});

test("hardware names are case-sensitive but exact duplicates are rejected", () => {
  const differentCase = cloneFixture();
  differentCase.hardware.devices[1].name = "ArmMotor";
  assert.equal(validateRobotDocument(differentCase).success, true);

  const duplicate = cloneFixture();
  duplicate.hardware.devices[1].name = "armMotor";
  const duplicateResult = validateRobotDocument(duplicate);
  assert.equal(duplicateResult.success, false);
  assert.equal(issueCodes(duplicateResult).has("duplicate-hardware-name"), true);
});

test("duplicate module ports are rejected", () => {
  const fixture = cloneFixture();
  fixture.hardware.devices[1].port = "motor:0";

  const result = validateRobotDocument(fixture);
  assert.equal(result.success, false);
  assert.equal(issueCodes(result).has("duplicate-port"), true);
});

test("bounded joints require ordered limits containing the initial position", () => {
  const missingLimits = cloneFixture();
  delete missingLimits.joints[0].limits;
  const missingResult = validateRobotDocument(missingLimits);
  assert.equal(issueCodes(missingResult).has("missing-joint-limits"), true);

  const reversedLimits = cloneFixture();
  reversedLimits.joints[0].limits = { lower: 1, upper: -1 };
  const reversedResult = validateRobotDocument(reversedLimits);
  assert.equal(issueCodes(reversedResult).has("invalid-joint-range"), true);

  const outsideLimits = cloneFixture();
  outsideLimits.joints[0].initialPosition = 10;
  const outsideResult = validateRobotDocument(outsideLimits);
  assert.equal(issueCodes(outsideResult).has("joint-initial-out-of-range"), true);
});

test("all supported joint kinds validate with matching transmissions", () => {
  const fixed = cloneFixture();
  fixed.joints[0].kind = "fixed";
  delete fixed.joints[0].limits;
  fixed.transmissions = fixed.transmissions.filter((entry) => entry.jointId !== "joint-arm");
  assert.equal(validateRobotDocument(fixed).success, true);

  const continuous = cloneFixture();
  continuous.joints[0].kind = "continuous";
  delete continuous.joints[0].limits;
  assert.equal(validateRobotDocument(continuous).success, true);

  const prismatic = cloneFixture();
  prismatic.joints[0].kind = "prismatic";
  prismatic.joints[0].limits = { lower: 0, upper: 1 };
  prismatic.joints[0].initialPosition = 0.2;
  prismatic.transmissions[0].kind = "linear";
  prismatic.transmissions[0].jointUnitsPerActuatorRevolution = 0.008;
  assert.equal(validateRobotDocument(prismatic).success, true);
});

test("transmission kind must match the target joint", () => {
  const fixture = cloneFixture();
  fixture.transmissions[0].kind = "linear";

  const result = validateRobotDocument(fixture);
  assert.equal(result.success, false);
  assert.equal(issueCodes(result).has("transmission-kind-mismatch"), true);
});

test("references to missing instances, modules, devices, and joints are rejected", () => {
  const fixture = cloneFixture();
  fixture.connections[0].a.instanceId = "missing-instance";
  fixture.hardware.devices[0].moduleId = "missing-module";
  fixture.transmissions[0].actuatorDeviceId = "missing-device";
  fixture.transmissions[1].jointId = "missing-joint";

  const result = validateRobotDocument(fixture);
  const codes = issueCodes(result);
  assert.equal(result.success, false);
  assert.equal(codes.has("missing-instance"), true);
  assert.equal(codes.has("missing-module"), true);
  assert.equal(codes.has("missing-device"), true);
  assert.equal(codes.has("missing-joint"), true);
});

test("v2 imports stop at the explicit migration boundary", () => {
  const result = importRobotDocumentValue({ version: 2, name: "Legacy", parts: [] });
  assert.deepEqual(result, {
    status: "migration-required",
    fromVersion: 2,
    toVersion: 3,
    message: "Robot schema v2 requires an explicit migration to v3.",
  });
});

test("invalid JSON and unknown versions return structured errors", () => {
  const invalidJson = parseRobotDocumentJson("{");
  assert.equal(invalidJson.success, false);
  assert.equal(issueCodes(invalidJson).has("invalid-json"), true);

  const unknown = importRobotDocumentValue({ schemaVersion: 99 });
  assert.equal(unknown.status, "error");
  if (unknown.status === "error") {
    assert.equal(unknown.issues[0].code, "unsupported-schema-version");
  }
});

test("serializer rejects invalid documents with validation details", () => {
  const fixture = cloneFixture();
  fixture.hardware.modules = [];

  assert.throws(
    () => serializeRobotDocument(fixture),
    (caught) =>
      caught instanceof RobotDocumentValidationError &&
      caught.issues.some((issue) => issue.code === "missing-control-hub")
  );
});
