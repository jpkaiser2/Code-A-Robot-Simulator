import type { Quaternion, RigidTransform, RobotDocumentV3, Vec3 } from "./types.ts";
import {
  validateRobotDocument,
  type RobotValidationIssue,
  type RobotValidationResult,
} from "./validation.ts";

export class RobotDocumentValidationError extends Error {
  readonly issues: RobotValidationIssue[];

  constructor(message: string, issues: RobotValidationIssue[]) {
    super(message);
    this.name = "RobotDocumentValidationError";
    this.issues = issues;
  }
}

function normalizeQuaternion(value: Quaternion): Quaternion {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  return value.map((entry) => entry / length) as Quaternion;
}

function normalizeAxis(value: Vec3): Vec3 {
  const length = Math.hypot(value[0], value[1], value[2]);
  return value.map((entry) => entry / length) as Vec3;
}

function normalizeTransform(transform: RigidTransform): RigidTransform {
  return {
    position: [...transform.position] as Vec3,
    rotation: normalizeQuaternion(transform.rotation),
  };
}

export function normalizeRobotDocument(document: RobotDocumentV3): RobotDocumentV3 {
  return {
    ...document,
    instances: document.instances.map((instance) => ({
      ...instance,
      transform: normalizeTransform(instance.transform),
      ...(instance.parameters ? { parameters: { ...instance.parameters } } : {}),
      ...(instance.appearance ? { appearance: { ...instance.appearance } } : {}),
    })),
    connections: document.connections.map((connection) => ({
      ...connection,
      a: { ...connection.a },
      b: { ...connection.b },
      translationOffsetM: [...connection.translationOffsetM] as Vec3,
    })),
    joints: document.joints.map((joint) => ({
      ...joint,
      parentFrame: normalizeTransform(joint.parentFrame),
      childFrame: normalizeTransform(joint.childFrame),
      axis: joint.kind === "fixed" ? ([...joint.axis] as Vec3) : normalizeAxis(joint.axis),
      ...(joint.limits ? { limits: { ...joint.limits } } : {}),
      dynamics: { ...joint.dynamics },
    })),
    transmissions: document.transmissions.map((transmission) => ({ ...transmission })),
    hardware: {
      modules: document.hardware.modules.map((module) => ({ ...module })),
      devices: document.hardware.devices.map((device) => ({ ...device })),
    },
    ...(document.drivetrain
      ? {
          drivetrain: {
            ...document.drivetrain,
            wheels: document.drivetrain.wheels.map((wheel) => ({ ...wheel })),
          },
        }
      : {}),
    ...(document.customAssets
      ? { customAssets: document.customAssets.map((asset) => ({ ...asset })) }
      : {}),
    metadata: { ...document.metadata },
  };
}

export function parseRobotDocumentValue(value: unknown): RobotValidationResult {
  const result = validateRobotDocument(value);
  if (!result.success) {
    return result;
  }

  const document = normalizeRobotDocument(result.document);
  const normalizedResult = validateRobotDocument(document);
  if (!normalizedResult.success) {
    return normalizedResult;
  }

  return {
    success: true,
    document,
    issues: result.issues.filter(
      (issue) => issue.code !== "unnormalized-quaternion" && issue.code !== "unnormalized-joint-axis"
    ),
  };
}

export function parseRobotDocumentJson(json: string): RobotValidationResult {
  try {
    return parseRobotDocumentValue(JSON.parse(json));
  } catch (parseError) {
    return {
      success: false,
      document: null,
      issues: [
        {
          code: "invalid-json",
          message:
            parseError instanceof Error ? parseError.message : "Robot document is not valid JSON.",
          path: "$",
          severity: "error",
        },
      ],
    };
  }
}

export function serializeRobotDocument(document: RobotDocumentV3): string {
  const result = parseRobotDocumentValue(document);
  if (!result.success) {
    throw new RobotDocumentValidationError(
      "Cannot serialize an invalid robot document.",
      result.issues
    );
  }
  return JSON.stringify(result.document, null, 2);
}
