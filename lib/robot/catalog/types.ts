import type {
  HardwareDeviceType,
  HardwareModuleType,
  Quaternion,
  RigidTransform,
  Vec3,
} from "../schema/types";

export type CatalogPartCategory =
  | "structure"
  | "fastener"
  | "shaft"
  | "bearing"
  | "wheel"
  | "motor"
  | "servo"
  | "sensor"
  | "controller"
  | "power"
  | "mechanism"
  | "custom";

export type CatalogLifecycle = "active" | "discontinued" | "unknown";
export type AssetLicenseStatus = "approved" | "permission-required" | "restricted" | "unknown";

export interface CatalogSource {
  productUrl: string;
  cadUrl?: string;
  retrievedAt: string;
  licenseStatus: AssetLicenseStatus;
  attribution?: string;
  notes?: string;
}

export type ConnectorKind =
  | "mountPoint"
  | "mountPattern"
  | "shaft"
  | "bore"
  | "servoSpline"
  | "bearingSeat"
  | "linearRail"
  | "linearCarriage"
  | "custom";

export type ConnectorProfile =
  | "round"
  | "hex"
  | "d"
  | "rex8"
  | "servo25t"
  | "goBildaPattern"
  | "revPattern"
  | "custom";

export interface CatalogConnector {
  id: string;
  name: string;
  kind: ConnectorKind;
  profile?: ConnectorProfile;
  frame: RigidTransform;
  gender: "male" | "female" | "neutral";
  diameterM?: number;
  accepts: string[];
  rotationSteps?: number;
}

export type CatalogCollider =
  | { kind: "box"; center: Vec3; halfExtents: Vec3; rotation?: Quaternion }
  | { kind: "cylinder"; center: Vec3; radiusM: number; halfHeightM: number; rotation?: Quaternion }
  | { kind: "sphere"; center: Vec3; radiusM: number };

export interface CatalogVisual {
  kind: "glb" | "procedural-placeholder";
  uri?: string;
  boundsM: Vec3;
  origin: RigidTransform;
  triangleCount?: number;
  byteSize?: number;
}

export interface CatalogPhysicalProperties {
  massKg?: number;
  centerOfMassM?: Vec3;
  colliders: CatalogCollider[];
}

export interface CatalogMotorCapabilities {
  kind: "dcMotor";
  nominalVoltage: number;
  noLoadRpm?: number;
  stallTorqueNm?: number;
  encoderTicksPerRevolution?: number;
}

export interface CatalogServoCapabilities {
  kind: "servo" | "crServo";
  minAngleRad?: number;
  maxAngleRad?: number;
  maxSpeedRadPerSecond?: number;
}

export interface CatalogSensorCapabilities {
  kind: Extract<HardwareDeviceType, "imu" | "distance" | "touch" | "color">;
}

export interface CatalogModuleCapabilities {
  kind: HardwareModuleType;
  ports: Array<{
    id: string;
    accepts: HardwareDeviceType[];
  }>;
}

export type CatalogDeviceCapabilities =
  | CatalogMotorCapabilities
  | CatalogServoCapabilities
  | CatalogSensorCapabilities
  | CatalogModuleCapabilities;

export interface CatalogPartDefinition {
  id: string;
  vendor: string;
  sku: string;
  name: string;
  category: CatalogPartCategory;
  lifecycle: CatalogLifecycle;
  source: CatalogSource;
  visual: CatalogVisual;
  physical: CatalogPhysicalProperties;
  connectors: CatalogConnector[];
  device?: CatalogDeviceCapabilities;
  tags: string[];
}

export interface PartCatalog {
  version: string;
  generatedAt: string;
  parts: CatalogPartDefinition[];
}
