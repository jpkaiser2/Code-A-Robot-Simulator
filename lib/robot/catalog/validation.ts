import type {
  CatalogCollider,
  CatalogConnector,
  CatalogPartDefinition,
  PartCatalog,
} from "./types.ts";

export type CatalogValidationSeverity = "error" | "warning";

export interface CatalogValidationIssue {
  code: string;
  message: string;
  path: string;
  severity: CatalogValidationSeverity;
}

export type CatalogValidationResult =
  | { success: true; catalog: PartCatalog; issues: CatalogValidationIssue[] }
  | { success: false; catalog: null; issues: CatalogValidationIssue[] };

const PART_CATEGORIES = new Set([
  "structure",
  "fastener",
  "shaft",
  "bearing",
  "wheel",
  "motor",
  "servo",
  "sensor",
  "controller",
  "power",
  "mechanism",
  "custom",
]);
const LIFECYCLES = new Set(["active", "discontinued", "unknown"]);
const LICENSE_STATUSES = new Set(["approved", "permission-required", "restricted", "unknown"]);
const CONNECTOR_KINDS = new Set([
  "mountPoint",
  "mountPattern",
  "shaft",
  "bore",
  "servoSpline",
  "bearingSeat",
  "linearRail",
  "linearCarriage",
  "custom",
]);
const CONNECTOR_PROFILES = new Set([
  "round",
  "hex",
  "d",
  "rex8",
  "servo25t",
  "goBildaPattern",
  "revPattern",
  "custom",
]);
const DEVICE_KINDS = new Set([
  "dcMotor",
  "servo",
  "crServo",
  "imu",
  "distance",
  "touch",
  "color",
  "controlHub",
  "expansionHub",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addIssue(
  issues: CatalogValidationIssue[],
  severity: CatalogValidationSeverity,
  code: string,
  path: string,
  message: string
) {
  issues.push({ code, message, path, severity });
}

function error(issues: CatalogValidationIssue[], code: string, path: string, message: string) {
  addIssue(issues, "error", code, path, message);
}

function warning(issues: CatalogValidationIssue[], code: string, path: string, message: string) {
  addIssue(issues, "warning", code, path, message);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyString(
  value: unknown,
  path: string,
  issues: CatalogValidationIssue[]
): value is string {
  if (typeof value !== "string" || !value.trim()) {
    error(issues, "invalid-string", path, "Expected a non-empty string.");
    return false;
  }
  return true;
}

function positiveNumber(value: unknown, path: string, issues: CatalogValidationIssue[]) {
  if (!isFiniteNumber(value) || value <= 0) {
    error(issues, "invalid-positive-number", path, "Expected a finite number greater than zero.");
    return false;
  }
  return true;
}

function vec3(value: unknown, path: string, issues: CatalogValidationIssue[], positive = false) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(isFiniteNumber)) {
    error(issues, "invalid-vec3", path, "Expected three finite numbers.");
    return false;
  }
  if (positive && value.some((entry) => entry <= 0)) {
    error(issues, "invalid-bounds", path, "All dimensions must be greater than zero.");
    return false;
  }
  return true;
}

function quaternion(value: unknown, path: string, issues: CatalogValidationIssue[]) {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) {
    error(issues, "invalid-quaternion", path, "Expected four finite quaternion values.");
    return false;
  }
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (Math.abs(length - 1) > 0.001) {
    error(issues, "unnormalized-quaternion", path, "Catalog quaternions must be normalized.");
    return false;
  }
  return true;
}

function transform(value: unknown, path: string, issues: CatalogValidationIssue[]) {
  if (!isRecord(value)) {
    error(issues, "invalid-transform", path, "Expected a transform object.");
    return false;
  }
  const positionValid = vec3(value.position, `${path}.position`, issues);
  const rotationValid = quaternion(value.rotation, `${path}.rotation`, issues);
  return positionValid && rotationValid;
}

function validateConnector(
  value: unknown,
  path: string,
  issues: CatalogValidationIssue[]
): value is CatalogConnector {
  if (!isRecord(value)) {
    error(issues, "invalid-connector", path, "Expected a connector object.");
    return false;
  }
  let valid = true;
  valid = nonEmptyString(value.id, `${path}.id`, issues) && valid;
  valid = nonEmptyString(value.name, `${path}.name`, issues) && valid;
  if (typeof value.kind !== "string" || !CONNECTOR_KINDS.has(value.kind)) {
    error(issues, "invalid-connector-kind", `${path}.kind`, "Unsupported connector kind.");
    valid = false;
  }
  if (
    value.profile !== undefined &&
    (typeof value.profile !== "string" || !CONNECTOR_PROFILES.has(value.profile))
  ) {
    error(issues, "invalid-connector-profile", `${path}.profile`, "Unsupported connector profile.");
    valid = false;
  }
  valid = transform(value.frame, `${path}.frame`, issues) && valid;
  if (value.gender !== "male" && value.gender !== "female" && value.gender !== "neutral") {
    error(issues, "invalid-connector-gender", `${path}.gender`, "Expected male, female, or neutral.");
    valid = false;
  }
  if (value.diameterM !== undefined) {
    valid = positiveNumber(value.diameterM, `${path}.diameterM`, issues) && valid;
  }
  if (!Array.isArray(value.accepts) || !value.accepts.every((entry) => typeof entry === "string")) {
    error(issues, "invalid-connector-accepts", `${path}.accepts`, "Expected an array of compatibility tokens.");
    valid = false;
  }
  if (
    value.rotationSteps !== undefined &&
    (typeof value.rotationSteps !== "number" ||
      !Number.isInteger(value.rotationSteps) ||
      value.rotationSteps < 1)
  ) {
    error(issues, "invalid-rotation-steps", `${path}.rotationSteps`, "Rotation steps must be a positive integer.");
    valid = false;
  }
  return valid;
}

function validateCollider(
  value: unknown,
  path: string,
  issues: CatalogValidationIssue[]
): value is CatalogCollider {
  if (!isRecord(value) || !new Set(["box", "cylinder", "sphere"]).has(String(value.kind))) {
    error(issues, "invalid-collider", path, "Expected a box, cylinder, or sphere collider.");
    return false;
  }
  let valid = vec3(value.center, `${path}.center`, issues);
  if (value.kind === "box") {
    valid = vec3(value.halfExtents, `${path}.halfExtents`, issues, true) && valid;
  } else if (value.kind === "cylinder") {
    valid = positiveNumber(value.radiusM, `${path}.radiusM`, issues) && valid;
    valid = positiveNumber(value.halfHeightM, `${path}.halfHeightM`, issues) && valid;
  } else {
    valid = positiveNumber(value.radiusM, `${path}.radiusM`, issues) && valid;
  }
  if (value.rotation !== undefined) {
    valid = quaternion(value.rotation, `${path}.rotation`, issues) && valid;
  }
  return valid;
}

function validatePart(
  value: unknown,
  path: string,
  issues: CatalogValidationIssue[]
): value is CatalogPartDefinition {
  if (!isRecord(value)) {
    error(issues, "invalid-part", path, "Expected a catalog part object.");
    return false;
  }
  let valid = true;
  for (const field of ["id", "vendor", "sku", "name"] as const) {
    valid = nonEmptyString(value[field], `${path}.${field}`, issues) && valid;
  }
  if (typeof value.category !== "string" || !PART_CATEGORIES.has(value.category)) {
    error(issues, "invalid-category", `${path}.category`, "Unsupported catalog category.");
    valid = false;
  }
  if (typeof value.lifecycle !== "string" || !LIFECYCLES.has(value.lifecycle)) {
    error(issues, "invalid-lifecycle", `${path}.lifecycle`, "Unsupported lifecycle status.");
    valid = false;
  }

  if (!isRecord(value.source)) {
    error(issues, "invalid-source", `${path}.source`, "Expected source provenance.");
    valid = false;
  } else {
    valid = nonEmptyString(value.source.productUrl, `${path}.source.productUrl`, issues) && valid;
    valid = nonEmptyString(value.source.retrievedAt, `${path}.source.retrievedAt`, issues) && valid;
    if (
      typeof value.source.licenseStatus !== "string" ||
      !LICENSE_STATUSES.has(value.source.licenseStatus)
    ) {
      error(issues, "invalid-license-status", `${path}.source.licenseStatus`, "Unsupported asset license status.");
      valid = false;
    }
  }

  if (!isRecord(value.visual)) {
    error(issues, "invalid-visual", `${path}.visual`, "Expected visual metadata.");
    valid = false;
  } else {
    if (value.visual.kind !== "glb" && value.visual.kind !== "procedural-placeholder") {
      error(issues, "invalid-visual-kind", `${path}.visual.kind`, "Expected glb or procedural-placeholder.");
      valid = false;
    }
    valid = vec3(value.visual.boundsM, `${path}.visual.boundsM`, issues, true) && valid;
    valid = transform(value.visual.origin, `${path}.visual.origin`, issues) && valid;
    if (value.visual.kind === "glb") {
      valid = nonEmptyString(value.visual.uri, `${path}.visual.uri`, issues) && valid;
      if (isRecord(value.source) && value.source.licenseStatus !== "approved") {
        error(
          issues,
          "unapproved-distributed-asset",
          `${path}.source.licenseStatus`,
          "A distributed GLB requires approved redistribution status."
        );
        valid = false;
      }
    }
    if (value.visual.triangleCount !== undefined) {
      valid = positiveNumber(value.visual.triangleCount, `${path}.visual.triangleCount`, issues) && valid;
    }
    if (value.visual.byteSize !== undefined) {
      valid = positiveNumber(value.visual.byteSize, `${path}.visual.byteSize`, issues) && valid;
    }
    if (
      value.visual.sha256 !== undefined &&
      (typeof value.visual.sha256 !== "string" || !SHA256_PATTERN.test(value.visual.sha256))
    ) {
      error(issues, "invalid-asset-hash", `${path}.visual.sha256`, "Expected a SHA-256 hash.");
      valid = false;
    }
  }

  if (!isRecord(value.physical)) {
    error(issues, "invalid-physical-properties", `${path}.physical`, "Expected physical properties.");
    valid = false;
  } else {
    if (value.physical.massKg !== undefined) {
      valid = positiveNumber(value.physical.massKg, `${path}.physical.massKg`, issues) && valid;
    } else {
      warning(issues, "missing-mass", `${path}.physical.massKg`, "Mass is not yet available.");
    }
    if (value.physical.centerOfMassM !== undefined) {
      valid = vec3(value.physical.centerOfMassM, `${path}.physical.centerOfMassM`, issues) && valid;
    }
    if (!Array.isArray(value.physical.colliders) || value.physical.colliders.length === 0) {
      error(issues, "missing-colliders", `${path}.physical.colliders`, "At least one collider is required.");
      valid = false;
    } else {
      value.physical.colliders.forEach((collider, index) => {
        valid = validateCollider(collider, `${path}.physical.colliders[${index}]`, issues) && valid;
      });
    }
  }

  if (!Array.isArray(value.connectors)) {
    error(issues, "invalid-connectors", `${path}.connectors`, "Expected a connectors array.");
    valid = false;
  } else {
    const connectorIds = new Set<string>();
    value.connectors.forEach((connector, index) => {
      valid = validateConnector(connector, `${path}.connectors[${index}]`, issues) && valid;
      if (isRecord(connector) && typeof connector.id === "string") {
        if (connectorIds.has(connector.id)) {
          error(issues, "duplicate-connector-id", `${path}.connectors[${index}].id`, `Duplicate connector id "${connector.id}".`);
          valid = false;
        }
        connectorIds.add(connector.id);
      }
    });
  }

  if (!Array.isArray(value.tags) || !value.tags.every((entry) => typeof entry === "string")) {
    error(issues, "invalid-tags", `${path}.tags`, "Expected a string tag array.");
    valid = false;
  }

  if (value.device !== undefined) {
    if (!isRecord(value.device) || typeof value.device.kind !== "string" || !DEVICE_KINDS.has(value.device.kind)) {
      error(issues, "invalid-device-capabilities", `${path}.device`, "Unsupported device capabilities.");
      valid = false;
    } else if (value.device.kind === "controlHub" || value.device.kind === "expansionHub") {
      if (!Array.isArray(value.device.ports) || value.device.ports.length === 0) {
        error(issues, "missing-module-ports", `${path}.device.ports`, "Hardware modules require ports.");
        valid = false;
      } else {
        const portIds = new Set<string>();
        value.device.ports.forEach((port, index) => {
          const portPath = `${path}.device.ports[${index}]`;
          if (!isRecord(port)) {
            error(issues, "invalid-module-port", portPath, "Expected a module port object.");
            valid = false;
            return;
          }
          valid = nonEmptyString(port.id, `${portPath}.id`, issues) && valid;
          if (typeof port.id === "string" && portIds.has(port.id)) {
            error(issues, "duplicate-module-port", `${portPath}.id`, `Duplicate port "${port.id}".`);
            valid = false;
          }
          if (typeof port.id === "string") portIds.add(port.id);
          if (!Array.isArray(port.accepts) || port.accepts.length === 0) {
            error(issues, "invalid-port-accepts", `${portPath}.accepts`, "Port needs at least one accepted device type.");
            valid = false;
          }
        });
      }
    } else if (value.device.kind === "dcMotor") {
      valid = positiveNumber(value.device.nominalVoltage, `${path}.device.nominalVoltage`, issues) && valid;
      for (const field of ["noLoadRpm", "stallTorqueNm", "encoderTicksPerRevolution"] as const) {
        if (value.device[field] !== undefined) {
          valid = positiveNumber(value.device[field], `${path}.device.${field}`, issues) && valid;
        }
      }
    } else if (value.device.kind === "servo" || value.device.kind === "crServo") {
      for (const field of ["minAngleRad", "maxAngleRad", "maxSpeedRadPerSecond"] as const) {
        if (value.device[field] !== undefined && !isFiniteNumber(value.device[field])) {
          error(issues, "invalid-servo-capability", `${path}.device.${field}`, "Expected a finite number.");
          valid = false;
        }
      }
    }
  }

  return valid;
}

export function validatePartCatalog(value: unknown): CatalogValidationResult {
  const issues: CatalogValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      success: false,
      catalog: null,
      issues: [{ code: "invalid-catalog", message: "Catalog must be an object.", path: "$", severity: "error" }],
    };
  }
  let valid = true;
  valid = nonEmptyString(value.version, "version", issues) && valid;
  valid = nonEmptyString(value.generatedAt, "generatedAt", issues) && valid;
  if (!Array.isArray(value.parts) || value.parts.length === 0) {
    error(issues, "empty-catalog", "parts", "Catalog must contain at least one part.");
    valid = false;
  } else {
    const ids = new Set<string>();
    const vendorSkus = new Set<string>();
    value.parts.forEach((part, index) => {
      valid = validatePart(part, `parts[${index}]`, issues) && valid;
      if (!isRecord(part)) return;
      if (typeof part.id === "string") {
        if (ids.has(part.id)) {
          error(issues, "duplicate-part-id", `parts[${index}].id`, `Duplicate part id "${part.id}".`);
          valid = false;
        }
        ids.add(part.id);
      }
      if (typeof part.vendor === "string" && typeof part.sku === "string") {
        const key = `${part.vendor.toLowerCase()}:${part.sku.toLowerCase()}`;
        if (vendorSkus.has(key)) {
          error(issues, "duplicate-vendor-sku", `parts[${index}].sku`, "Vendor/SKU pair must be unique.");
          valid = false;
        }
        vendorSkus.add(key);
      }
    });
  }

  if (!valid || issues.some((issue) => issue.severity === "error")) {
    return { success: false, catalog: null, issues };
  }
  return { success: true, catalog: value as unknown as PartCatalog, issues };
}
