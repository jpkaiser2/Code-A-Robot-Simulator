import {
  ROBOT_DOCUMENT_SCHEMA_VERSION,
  type AssetManifestEntry,
  type ConnectionEndpoint,
  type DrivetrainConfiguration,
  type HardwareConfiguration,
  type HardwareDevice,
  type HardwareModule,
  type MechanicalJoint,
  type MotionTransmission,
  type PartInstance,
  type Quaternion,
  type RigidTransform,
  type RobotDocumentV3,
  type StructuralConnection,
  type Vec3,
} from "./types.ts";

export type RobotValidationSeverity = "error" | "warning";

export interface RobotValidationIssue {
  code: string;
  message: string;
  path: string;
  severity: RobotValidationSeverity;
}

export type RobotValidationResult =
  | { success: true; document: RobotDocumentV3; issues: RobotValidationIssue[] }
  | { success: false; document: null; issues: RobotValidationIssue[] };

const JOINT_KINDS = new Set(["fixed", "revolute", "continuous", "prismatic"]);
const TRANSMISSION_KINDS = new Set(["rotary", "linear"]);
const MODULE_TYPES = new Set(["controlHub", "expansionHub"]);
const DEVICE_TYPES = new Set([
  "dcMotor",
  "servo",
  "crServo",
  "imu",
  "distance",
  "touch",
  "color",
]);
const DRIVETRAIN_KINDS = new Set(["differential", "mecanum"]);
const WHEEL_ROLES = new Set(["leftFront", "rightFront", "leftRear", "rightRear"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addIssue(
  issues: RobotValidationIssue[],
  severity: RobotValidationSeverity,
  code: string,
  path: string,
  message: string
) {
  issues.push({ code, message, path, severity });
}

function error(issues: RobotValidationIssue[], code: string, path: string, message: string) {
  addIssue(issues, "error", code, path, message);
}

function warning(issues: RobotValidationIssue[], code: string, path: string, message: string) {
  addIssue(issues, "warning", code, path, message);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateNonEmptyString(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is string {
  if (typeof value !== "string" || !value.trim()) {
    error(issues, "invalid-string", path, "Expected a non-empty string.");
    return false;
  }
  return true;
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is number {
  if (!isFiniteNumber(value)) {
    error(issues, "invalid-number", path, "Expected a finite number.");
    return false;
  }
  return true;
}

function validateVec3(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is Vec3 {
  if (!Array.isArray(value) || value.length !== 3) {
    error(issues, "invalid-vec3", path, "Expected an array of three finite numbers.");
    return false;
  }

  const valid = value.every(isFiniteNumber);
  if (!valid) {
    error(issues, "invalid-vec3", path, "Expected an array of three finite numbers.");
  }
  return valid;
}

function validateQuaternion(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is Quaternion {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) {
    error(issues, "invalid-quaternion", path, "Expected an [x, y, z, w] quaternion.");
    return false;
  }

  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length < 0.000001) {
    error(issues, "zero-quaternion", path, "Quaternion length must be greater than zero.");
    return false;
  }
  if (Math.abs(length - 1) > 0.001) {
    warning(issues, "unnormalized-quaternion", path, "Quaternion should be normalized.");
  }
  return true;
}

function validateTransform(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is RigidTransform {
  if (!isRecord(value)) {
    error(issues, "invalid-transform", path, "Expected a rigid transform object.");
    return false;
  }

  const positionValid = validateVec3(value.position, `${path}.position`, issues);
  const rotationValid = validateQuaternion(value.rotation, `${path}.rotation`, issues);
  return positionValid && rotationValid;
}

function validatePartInstance(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is PartInstance {
  if (!isRecord(value)) {
    error(issues, "invalid-instance", path, "Expected a part instance object.");
    return false;
  }

  let valid = true;
  valid = validateNonEmptyString(value.id, `${path}.id`, issues) && valid;
  valid = validateNonEmptyString(value.catalogPartId, `${path}.catalogPartId`, issues) && valid;
  valid = validateNonEmptyString(value.name, `${path}.name`, issues) && valid;
  valid = validateTransform(value.transform, `${path}.transform`, issues) && valid;

  if (value.parameters !== undefined) {
    if (!isRecord(value.parameters)) {
      error(issues, "invalid-parameters", `${path}.parameters`, "Expected a parameter object.");
      valid = false;
    } else {
      Object.entries(value.parameters).forEach(([key, entry]) => {
        if (!key.trim() || !["string", "number", "boolean"].includes(typeof entry)) {
          error(
            issues,
            "invalid-parameter",
            `${path}.parameters.${key}`,
            "Parameters must have non-empty keys and string, number, or boolean values."
          );
          valid = false;
        } else if (typeof entry === "number" && !Number.isFinite(entry)) {
          error(issues, "invalid-parameter", `${path}.parameters.${key}`, "Number must be finite.");
          valid = false;
        }
      });
    }
  }

  if (value.appearance !== undefined) {
    if (!isRecord(value.appearance)) {
      error(issues, "invalid-appearance", `${path}.appearance`, "Expected an appearance object.");
      valid = false;
    } else {
      if (value.appearance.color !== undefined && typeof value.appearance.color !== "string") {
        error(issues, "invalid-color", `${path}.appearance.color`, "Expected a color string.");
        valid = false;
      }
      if (
        value.appearance.opacity !== undefined &&
        (!isFiniteNumber(value.appearance.opacity) ||
          value.appearance.opacity < 0 ||
          value.appearance.opacity > 1)
      ) {
        error(issues, "invalid-opacity", `${path}.appearance.opacity`, "Opacity must be from 0 to 1.");
        valid = false;
      }
      if (value.appearance.visible !== undefined && typeof value.appearance.visible !== "boolean") {
        error(issues, "invalid-visible", `${path}.appearance.visible`, "Expected a boolean.");
        valid = false;
      }
    }
  }

  return valid;
}

function validateConnectionEndpoint(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is ConnectionEndpoint {
  if (!isRecord(value)) {
    error(issues, "invalid-connection-endpoint", path, "Expected a connection endpoint object.");
    return false;
  }
  const instanceValid = validateNonEmptyString(value.instanceId, `${path}.instanceId`, issues);
  const connectorValid = validateNonEmptyString(value.connectorId, `${path}.connectorId`, issues);
  return instanceValid && connectorValid;
}

function validateStructuralConnection(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is StructuralConnection {
  if (!isRecord(value)) {
    error(issues, "invalid-connection", path, "Expected a structural connection object.");
    return false;
  }
  let valid = true;
  valid = validateNonEmptyString(value.id, `${path}.id`, issues) && valid;
  valid = validateNonEmptyString(value.name, `${path}.name`, issues) && valid;
  valid = validateConnectionEndpoint(value.a, `${path}.a`, issues) && valid;
  valid = validateConnectionEndpoint(value.b, `${path}.b`, issues) && valid;
  valid = validateFiniteNumber(value.rotationOffsetRad, `${path}.rotationOffsetRad`, issues) && valid;
  valid = validateVec3(value.translationOffsetM, `${path}.translationOffsetM`, issues) && valid;
  if (
    value.fastenerCatalogPartId !== undefined &&
    !validateNonEmptyString(value.fastenerCatalogPartId, `${path}.fastenerCatalogPartId`, issues)
  ) {
    valid = false;
  }
  return valid;
}

function validateMechanicalJoint(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is MechanicalJoint {
  if (!isRecord(value)) {
    error(issues, "invalid-joint", path, "Expected a mechanical joint object.");
    return false;
  }
  let valid = true;
  valid = validateNonEmptyString(value.id, `${path}.id`, issues) && valid;
  valid = validateNonEmptyString(value.name, `${path}.name`, issues) && valid;
  if (typeof value.kind !== "string" || !JOINT_KINDS.has(value.kind)) {
    error(issues, "invalid-joint-kind", `${path}.kind`, "Unsupported mechanical joint kind.");
    valid = false;
  }
  valid = validateNonEmptyString(value.parentInstanceId, `${path}.parentInstanceId`, issues) && valid;
  valid = validateNonEmptyString(value.childInstanceId, `${path}.childInstanceId`, issues) && valid;
  valid = validateTransform(value.parentFrame, `${path}.parentFrame`, issues) && valid;
  valid = validateTransform(value.childFrame, `${path}.childFrame`, issues) && valid;
  const axisValid = validateVec3(value.axis, `${path}.axis`, issues);
  valid = axisValid && valid;

  if (value.limits !== undefined) {
    if (!isRecord(value.limits)) {
      error(issues, "invalid-joint-limits", `${path}.limits`, "Expected lower and upper limits.");
      valid = false;
    } else {
      const lowerValid = validateFiniteNumber(value.limits.lower, `${path}.limits.lower`, issues);
      const upperValid = validateFiniteNumber(value.limits.upper, `${path}.limits.upper`, issues);
      valid = lowerValid && upperValid && valid;
    }
  }

  if (!isRecord(value.dynamics)) {
    error(issues, "invalid-joint-dynamics", `${path}.dynamics`, "Expected joint dynamics.");
    valid = false;
  } else {
    valid = validateFiniteNumber(value.dynamics.damping, `${path}.dynamics.damping`, issues) && valid;
    valid = validateFiniteNumber(value.dynamics.friction, `${path}.dynamics.friction`, issues) && valid;
  }
  valid = validateFiniteNumber(value.initialPosition, `${path}.initialPosition`, issues) && valid;
  if (typeof value.collisionBetweenBodies !== "boolean") {
    error(issues, "invalid-joint-collision", `${path}.collisionBetweenBodies`, "Expected a boolean.");
    valid = false;
  }
  return valid;
}

function validateTransmission(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is MotionTransmission {
  if (!isRecord(value)) {
    error(issues, "invalid-transmission", path, "Expected a motion transmission object.");
    return false;
  }
  let valid = true;
  valid = validateNonEmptyString(value.id, `${path}.id`, issues) && valid;
  valid = validateNonEmptyString(value.name, `${path}.name`, issues) && valid;
  if (typeof value.kind !== "string" || !TRANSMISSION_KINDS.has(value.kind)) {
    error(issues, "invalid-transmission-kind", `${path}.kind`, "Expected rotary or linear.");
    valid = false;
  }
  valid = validateNonEmptyString(value.actuatorDeviceId, `${path}.actuatorDeviceId`, issues) && valid;
  valid = validateNonEmptyString(value.jointId, `${path}.jointId`, issues) && valid;
  valid =
    validateFiniteNumber(
      value.jointUnitsPerActuatorRevolution,
      `${path}.jointUnitsPerActuatorRevolution`,
      issues
    ) && valid;
  if (value.direction !== 1 && value.direction !== -1) {
    error(issues, "invalid-transmission-direction", `${path}.direction`, "Expected 1 or -1.");
    valid = false;
  }
  valid = validateFiniteNumber(value.efficiency, `${path}.efficiency`, issues) && valid;
  if (
    value.encoderTicksPerActuatorRevolution !== undefined &&
    !validateFiniteNumber(
      value.encoderTicksPerActuatorRevolution,
      `${path}.encoderTicksPerActuatorRevolution`,
      issues
    )
  ) {
    valid = false;
  }
  return valid;
}

function validateHardwareModule(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is HardwareModule {
  if (!isRecord(value)) {
    error(issues, "invalid-hardware-module", path, "Expected a hardware module object.");
    return false;
  }
  let valid = true;
  valid = validateNonEmptyString(value.id, `${path}.id`, issues) && valid;
  valid = validateNonEmptyString(value.name, `${path}.name`, issues) && valid;
  if (typeof value.type !== "string" || !MODULE_TYPES.has(value.type)) {
    error(issues, "invalid-module-type", `${path}.type`, "Unsupported hardware module type.");
    valid = false;
  }
  valid = validateNonEmptyString(value.partInstanceId, `${path}.partInstanceId`, issues) && valid;
  if (value.serialNumber !== undefined && typeof value.serialNumber !== "string") {
    error(issues, "invalid-serial-number", `${path}.serialNumber`, "Expected a string.");
    valid = false;
  }
  return valid;
}

function validateHardwareDevice(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is HardwareDevice {
  if (!isRecord(value)) {
    error(issues, "invalid-hardware-device", path, "Expected a hardware device object.");
    return false;
  }
  let valid = true;
  valid = validateNonEmptyString(value.id, `${path}.id`, issues) && valid;
  valid = validateNonEmptyString(value.name, `${path}.name`, issues) && valid;
  if (typeof value.type !== "string" || !DEVICE_TYPES.has(value.type)) {
    error(issues, "invalid-device-type", `${path}.type`, "Unsupported hardware device type.");
    valid = false;
  }
  valid = validateNonEmptyString(value.partInstanceId, `${path}.partInstanceId`, issues) && valid;
  valid = validateNonEmptyString(value.moduleId, `${path}.moduleId`, issues) && valid;
  valid = validateNonEmptyString(value.port, `${path}.port`, issues) && valid;
  if (value.direction !== undefined && value.direction !== "forward" && value.direction !== "reverse") {
    error(issues, "invalid-device-direction", `${path}.direction`, "Expected forward or reverse.");
    valid = false;
  }
  return valid;
}

function validateHardwareConfiguration(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is HardwareConfiguration {
  if (!isRecord(value)) {
    error(issues, "invalid-hardware", path, "Expected a hardware configuration object.");
    return false;
  }
  let valid = true;
  if (!Array.isArray(value.modules)) {
    error(issues, "invalid-hardware-modules", `${path}.modules`, "Expected a modules array.");
    valid = false;
  } else {
    value.modules.forEach((module, index) => {
      valid = validateHardwareModule(module, `${path}.modules[${index}]`, issues) && valid;
    });
  }
  if (!Array.isArray(value.devices)) {
    error(issues, "invalid-hardware-devices", `${path}.devices`, "Expected a devices array.");
    valid = false;
  } else {
    value.devices.forEach((device, index) => {
      valid = validateHardwareDevice(device, `${path}.devices[${index}]`, issues) && valid;
    });
  }
  return valid;
}

function validateDrivetrain(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is DrivetrainConfiguration {
  if (!isRecord(value)) {
    error(issues, "invalid-drivetrain", path, "Expected a drivetrain configuration object.");
    return false;
  }
  let valid = true;
  if (typeof value.kind !== "string" || !DRIVETRAIN_KINDS.has(value.kind)) {
    error(issues, "invalid-drivetrain-kind", `${path}.kind`, "Expected differential or mecanum.");
    valid = false;
  }
  valid = validateFiniteNumber(value.wheelBaseM, `${path}.wheelBaseM`, issues) && valid;
  valid = validateFiniteNumber(value.trackWidthM, `${path}.trackWidthM`, issues) && valid;
  if (!Array.isArray(value.wheels)) {
    error(issues, "invalid-drivetrain-wheels", `${path}.wheels`, "Expected a wheel bindings array.");
    valid = false;
  } else {
    value.wheels.forEach((wheel, index) => {
      const wheelPath = `${path}.wheels[${index}]`;
      if (!isRecord(wheel)) {
        error(issues, "invalid-wheel-binding", wheelPath, "Expected a wheel binding object.");
        valid = false;
        return;
      }
      if (typeof wheel.role !== "string" || !WHEEL_ROLES.has(wheel.role)) {
        error(issues, "invalid-wheel-role", `${wheelPath}.role`, "Unsupported drivetrain wheel role.");
        valid = false;
      }
      valid = validateNonEmptyString(wheel.deviceId, `${wheelPath}.deviceId`, issues) && valid;
      valid = validateNonEmptyString(wheel.jointId, `${wheelPath}.jointId`, issues) && valid;
      valid = validateFiniteNumber(wheel.radiusM, `${wheelPath}.radiusM`, issues) && valid;
    });
  }
  return valid;
}

function validateAsset(
  value: unknown,
  path: string,
  issues: RobotValidationIssue[]
): value is AssetManifestEntry {
  if (!isRecord(value)) {
    error(issues, "invalid-asset", path, "Expected an asset manifest entry.");
    return false;
  }
  let valid = true;
  valid = validateNonEmptyString(value.id, `${path}.id`, issues) && valid;
  valid = validateNonEmptyString(value.uri, `${path}.uri`, issues) && valid;
  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(value.sha256)) {
    error(issues, "invalid-asset-hash", `${path}.sha256`, "Expected a 64-character SHA-256 hash.");
    valid = false;
  }
  if (value.mimeType !== "model/gltf-binary") {
    error(issues, "invalid-asset-mime", `${path}.mimeType`, "Only model/gltf-binary is supported.");
    valid = false;
  }
  return valid;
}

function validateUniqueIds(
  entries: Array<{ id: string }>,
  path: string,
  issues: RobotValidationIssue[]
) {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) {
      error(issues, "duplicate-id", `${path}[${index}].id`, `Duplicate id "${entry.id}".`);
    }
    seen.add(entry.id);
  });
}

function validateSemantics(document: RobotDocumentV3, issues: RobotValidationIssue[]) {
  validateUniqueIds(document.instances, "instances", issues);
  validateUniqueIds(document.connections, "connections", issues);
  validateUniqueIds(document.joints, "joints", issues);
  validateUniqueIds(document.transmissions, "transmissions", issues);
  validateUniqueIds(document.hardware.modules, "hardware.modules", issues);
  validateUniqueIds(document.hardware.devices, "hardware.devices", issues);
  validateUniqueIds(document.customAssets ?? [], "customAssets", issues);

  const instanceIds = new Set(document.instances.map((entry) => entry.id));
  const jointsById = new Map(document.joints.map((entry) => [entry.id, entry]));
  const modulesById = new Map(document.hardware.modules.map((entry) => [entry.id, entry]));
  const devicesById = new Map(document.hardware.devices.map((entry) => [entry.id, entry]));

  document.connections.forEach((connection, index) => {
    if (!instanceIds.has(connection.a.instanceId)) {
      error(issues, "missing-instance", `connections[${index}].a.instanceId`, "Unknown part instance.");
    }
    if (!instanceIds.has(connection.b.instanceId)) {
      error(issues, "missing-instance", `connections[${index}].b.instanceId`, "Unknown part instance.");
    }
    if (connection.a.instanceId === connection.b.instanceId) {
      error(issues, "self-connection", `connections[${index}]`, "A part cannot connect to itself.");
    }
  });

  document.joints.forEach((joint, index) => {
    const path = `joints[${index}]`;
    if (!instanceIds.has(joint.parentInstanceId)) {
      error(issues, "missing-instance", `${path}.parentInstanceId`, "Unknown parent instance.");
    }
    if (!instanceIds.has(joint.childInstanceId)) {
      error(issues, "missing-instance", `${path}.childInstanceId`, "Unknown child instance.");
    }
    if (joint.parentInstanceId === joint.childInstanceId) {
      error(issues, "self-joint", path, "A joint must connect two different instances.");
    }

    const axisLength = Math.hypot(...joint.axis);
    if (joint.kind !== "fixed" && axisLength < 0.000001) {
      error(issues, "zero-joint-axis", `${path}.axis`, "A movable joint requires a non-zero axis.");
    } else if (joint.kind !== "fixed" && Math.abs(axisLength - 1) > 0.001) {
      warning(issues, "unnormalized-joint-axis", `${path}.axis`, "Joint axis should be normalized.");
    }

    if (joint.kind === "revolute" || joint.kind === "prismatic") {
      if (!joint.limits) {
        error(issues, "missing-joint-limits", `${path}.limits`, "Bounded joints require limits.");
      } else if (joint.limits.lower >= joint.limits.upper) {
        error(issues, "invalid-joint-range", `${path}.limits`, "Lower limit must be below upper limit.");
      } else if (
        joint.initialPosition < joint.limits.lower ||
        joint.initialPosition > joint.limits.upper
      ) {
        error(
          issues,
          "joint-initial-out-of-range",
          `${path}.initialPosition`,
          "Initial position must be inside the joint limits."
        );
      }
    } else if (joint.limits) {
      warning(issues, "unused-joint-limits", `${path}.limits`, `${joint.kind} joints ignore limits.`);
    }

    if (joint.dynamics.damping < 0 || joint.dynamics.friction < 0) {
      error(issues, "negative-joint-dynamics", `${path}.dynamics`, "Damping and friction cannot be negative.");
    }
  });

  const hardwareNames = new Set<string>();
  const occupiedPorts = new Set<string>();
  document.hardware.modules.forEach((module, index) => {
    if (!instanceIds.has(module.partInstanceId)) {
      error(
        issues,
        "missing-instance",
        `hardware.modules[${index}].partInstanceId`,
        "Hardware module must reference a placed part."
      );
    }
  });
  if (!document.hardware.modules.some((module) => module.type === "controlHub")) {
    error(issues, "missing-control-hub", "hardware.modules", "An FTC robot requires a Control Hub.");
  }

  document.hardware.devices.forEach((device, index) => {
    const path = `hardware.devices[${index}]`;
    if (hardwareNames.has(device.name)) {
      error(issues, "duplicate-hardware-name", `${path}.name`, `Duplicate hardware name "${device.name}".`);
    }
    hardwareNames.add(device.name);

    if (!instanceIds.has(device.partInstanceId)) {
      error(issues, "missing-instance", `${path}.partInstanceId`, "Device must reference a placed part.");
    }
    if (!modulesById.has(device.moduleId)) {
      error(issues, "missing-module", `${path}.moduleId`, "Device references an unknown hardware module.");
    }
    const portKey = `${device.moduleId}:${device.port}`;
    if (occupiedPorts.has(portKey)) {
      error(issues, "duplicate-port", `${path}.port`, `Hardware port ${portKey} is already assigned.`);
    }
    occupiedPorts.add(portKey);
  });

  document.transmissions.forEach((transmission, index) => {
    const path = `transmissions[${index}]`;
    const device = devicesById.get(transmission.actuatorDeviceId);
    const joint = jointsById.get(transmission.jointId);
    if (!device) {
      error(issues, "missing-device", `${path}.actuatorDeviceId`, "Transmission references an unknown device.");
    } else if (!new Set(["dcMotor", "servo", "crServo"]).has(device.type)) {
      error(issues, "non-actuator-device", `${path}.actuatorDeviceId`, "Transmission device is not an actuator.");
    }
    if (!joint) {
      error(issues, "missing-joint", `${path}.jointId`, "Transmission references an unknown joint.");
    } else if (joint.kind === "fixed") {
      error(issues, "fixed-joint-transmission", `${path}.jointId`, "A fixed joint cannot be driven.");
    } else if (transmission.kind === "linear" && joint.kind !== "prismatic") {
      error(issues, "transmission-kind-mismatch", `${path}.kind`, "Linear transmissions require prismatic joints.");
    } else if (transmission.kind === "rotary" && joint.kind === "prismatic") {
      error(issues, "transmission-kind-mismatch", `${path}.kind`, "Prismatic joints require linear transmissions.");
    }
    if (transmission.jointUnitsPerActuatorRevolution <= 0) {
      error(
        issues,
        "invalid-transmission-ratio",
        `${path}.jointUnitsPerActuatorRevolution`,
        "Joint units per actuator revolution must be greater than zero."
      );
    }
    if (transmission.efficiency <= 0 || transmission.efficiency > 1) {
      error(issues, "invalid-transmission-efficiency", `${path}.efficiency`, "Efficiency must be above 0 and at most 1.");
    }
    if (
      transmission.encoderTicksPerActuatorRevolution !== undefined &&
      transmission.encoderTicksPerActuatorRevolution <= 0
    ) {
      error(
        issues,
        "invalid-encoder-resolution",
        `${path}.encoderTicksPerActuatorRevolution`,
        "Encoder resolution must be greater than zero."
      );
    }
  });

  if (document.drivetrain) {
    const roles = new Set<string>();
    if (document.drivetrain.wheelBaseM <= 0 || document.drivetrain.trackWidthM <= 0) {
      error(issues, "invalid-drivetrain-dimensions", "drivetrain", "Wheelbase and track width must be positive.");
    }
    document.drivetrain.wheels.forEach((wheel, index) => {
      const path = `drivetrain.wheels[${index}]`;
      if (roles.has(wheel.role)) {
        error(issues, "duplicate-wheel-role", `${path}.role`, `Duplicate wheel role "${wheel.role}".`);
      }
      roles.add(wheel.role);
      const device = devicesById.get(wheel.deviceId);
      const joint = jointsById.get(wheel.jointId);
      if (!device || device.type !== "dcMotor") {
        error(issues, "invalid-drive-device", `${path}.deviceId`, "Drive wheel requires a configured DC motor.");
      }
      if (!joint || !new Set(["continuous", "revolute"]).has(joint.kind)) {
        error(issues, "invalid-wheel-joint", `${path}.jointId`, "Drive wheel requires a rotary joint.");
      }
      if (wheel.radiusM <= 0) {
        error(issues, "invalid-wheel-radius", `${path}.radiusM`, "Wheel radius must be greater than zero.");
      }
    });

    const requiredRoles =
      document.drivetrain.kind === "mecanum"
        ? ["leftFront", "rightFront", "leftRear", "rightRear"]
        : ["leftFront", "rightFront"];
    requiredRoles.forEach((role) => {
      if (!roles.has(role)) {
        error(issues, "missing-wheel-role", "drivetrain.wheels", `Missing required ${role} wheel binding.`);
      }
    });
  }
}

export function validateRobotDocument(value: unknown): RobotValidationResult {
  const issues: RobotValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      success: false,
      document: null,
      issues: [
        {
          code: "invalid-document",
          message: "Robot document must be an object.",
          path: "$",
          severity: "error",
        },
      ],
    };
  }

  let valid = true;
  if (value.schemaVersion !== ROBOT_DOCUMENT_SCHEMA_VERSION) {
    error(
      issues,
      "unsupported-schema-version",
      "schemaVersion",
      `Expected schema version ${ROBOT_DOCUMENT_SCHEMA_VERSION}.`
    );
    valid = false;
  }
  valid = validateNonEmptyString(value.id, "id", issues) && valid;
  valid = validateNonEmptyString(value.name, "name", issues) && valid;
  if (value.units !== "m") {
    error(issues, "unsupported-units", "units", "Robot document units must be meters.");
    valid = false;
  }
  valid = validateNonEmptyString(value.catalogVersion, "catalogVersion", issues) && valid;

  const arrayValidators: Array<{
    key: "instances" | "connections" | "joints" | "transmissions";
    validate: (entry: unknown, path: string, list: RobotValidationIssue[]) => boolean;
  }> = [
    { key: "instances", validate: validatePartInstance },
    { key: "connections", validate: validateStructuralConnection },
    { key: "joints", validate: validateMechanicalJoint },
    { key: "transmissions", validate: validateTransmission },
  ];

  arrayValidators.forEach(({ key, validate }) => {
    const entries = value[key];
    if (!Array.isArray(entries)) {
      error(issues, "invalid-array", key, `Expected ${key} to be an array.`);
      valid = false;
      return;
    }
    entries.forEach((entry, index) => {
      valid = validate(entry, `${key}[${index}]`, issues) && valid;
    });
  });

  valid = validateHardwareConfiguration(value.hardware, "hardware", issues) && valid;

  if (value.drivetrain !== undefined) {
    valid = validateDrivetrain(value.drivetrain, "drivetrain", issues) && valid;
  }

  if (value.customAssets !== undefined) {
    if (!Array.isArray(value.customAssets)) {
      error(issues, "invalid-assets", "customAssets", "Expected an asset manifest array.");
      valid = false;
    } else {
      value.customAssets.forEach((asset, index) => {
        valid = validateAsset(asset, `customAssets[${index}]`, issues) && valid;
      });
    }
  }

  if (!isRecord(value.metadata)) {
    error(issues, "invalid-metadata", "metadata", "Expected robot document metadata.");
    valid = false;
  } else {
    valid = validateNonEmptyString(value.metadata.createdAt, "metadata.createdAt", issues) && valid;
    valid = validateNonEmptyString(value.metadata.updatedAt, "metadata.updatedAt", issues) && valid;
    for (const field of ["description", "author"] as const) {
      if (value.metadata[field] !== undefined && typeof value.metadata[field] !== "string") {
        error(issues, "invalid-metadata-field", `metadata.${field}`, "Expected a string.");
        valid = false;
      }
    }
  }

  if (!valid || issues.some((issue) => issue.severity === "error")) {
    return { success: false, document: null, issues };
  }

  const document = value as unknown as RobotDocumentV3;
  validateSemantics(document, issues);
  if (issues.some((issue) => issue.severity === "error")) {
    return { success: false, document: null, issues };
  }
  return { success: true, document, issues };
}
