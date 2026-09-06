export const ROBOT_DOCUMENT_SCHEMA_VERSION = 3 as const;

export type Vec3 = [number, number, number];
export type Quaternion = [number, number, number, number];

export interface RigidTransform {
  position: Vec3;
  rotation: Quaternion;
}

export type CatalogParameterValue = string | number | boolean;

export interface PartAppearanceOverride {
  color?: string;
  opacity?: number;
  visible?: boolean;
}

export interface PartInstance {
  id: string;
  catalogPartId: string;
  name: string;
  transform: RigidTransform;
  parameters?: Record<string, CatalogParameterValue>;
  appearance?: PartAppearanceOverride;
}

export interface ConnectionEndpoint {
  instanceId: string;
  connectorId: string;
}

export interface StructuralConnection {
  id: string;
  name: string;
  a: ConnectionEndpoint;
  b: ConnectionEndpoint;
  rotationOffsetRad: number;
  translationOffsetM: Vec3;
  fastenerCatalogPartId?: string;
}

export type MechanicalJointKind = "fixed" | "revolute" | "continuous" | "prismatic";

export interface JointLimits {
  lower: number;
  upper: number;
}

export interface JointDynamics {
  damping: number;
  friction: number;
}

export interface MechanicalJoint {
  id: string;
  name: string;
  kind: MechanicalJointKind;
  parentInstanceId: string;
  childInstanceId: string;
  parentFrame: RigidTransform;
  childFrame: RigidTransform;
  axis: Vec3;
  limits?: JointLimits;
  dynamics: JointDynamics;
  initialPosition: number;
  collisionBetweenBodies: boolean;
}

export type TransmissionKind = "rotary" | "linear";

export interface MotionTransmission {
  id: string;
  name: string;
  kind: TransmissionKind;
  actuatorDeviceId: string;
  jointId: string;
  /** Radians for rotary joints or meters for prismatic joints per actuator revolution. */
  jointUnitsPerActuatorRevolution: number;
  direction: 1 | -1;
  efficiency: number;
  encoderTicksPerActuatorRevolution?: number;
}

export type HardwareModuleType = "controlHub" | "expansionHub";

export interface HardwareModule {
  id: string;
  name: string;
  type: HardwareModuleType;
  partInstanceId: string;
  serialNumber?: string;
}

export type HardwareDeviceType =
  | "dcMotor"
  | "servo"
  | "crServo"
  | "imu"
  | "distance"
  | "touch"
  | "color";

export interface HardwareDevice {
  id: string;
  name: string;
  type: HardwareDeviceType;
  partInstanceId: string;
  moduleId: string;
  port: string;
  direction?: "forward" | "reverse";
}

export interface HardwareConfiguration {
  modules: HardwareModule[];
  devices: HardwareDevice[];
}

export type DrivetrainKind = "differential" | "mecanum";
export type DrivetrainWheelRole = "leftFront" | "rightFront" | "leftRear" | "rightRear";

export interface DrivetrainWheelBinding {
  role: DrivetrainWheelRole;
  deviceId: string;
  jointId: string;
  radiusM: number;
}

export interface DrivetrainConfiguration {
  kind: DrivetrainKind;
  wheelBaseM: number;
  trackWidthM: number;
  wheels: DrivetrainWheelBinding[];
}

export interface AssetManifestEntry {
  id: string;
  uri: string;
  sha256: string;
  mimeType: "model/gltf-binary";
}

export interface RobotDocumentMetadata {
  createdAt: string;
  updatedAt: string;
  description?: string;
  author?: string;
}

export interface RobotDocumentV3 {
  schemaVersion: typeof ROBOT_DOCUMENT_SCHEMA_VERSION;
  id: string;
  name: string;
  units: "m";
  catalogVersion: string;
  instances: PartInstance[];
  connections: StructuralConnection[];
  joints: MechanicalJoint[];
  transmissions: MotionTransmission[];
  hardware: HardwareConfiguration;
  drivetrain?: DrivetrainConfiguration;
  customAssets?: AssetManifestEntry[];
  metadata: RobotDocumentMetadata;
}
