import {
  ROBOT_DOCUMENT_SCHEMA_VERSION,
  type PartInstance,
  type RigidTransform,
  type RobotDocumentV3,
} from "../schema/types.ts";

const IDENTITY_TRANSFORM: RigidTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
};

function instance(
  id: string,
  catalogPartId: string,
  name: string,
  position: [number, number, number]
): PartInstance {
  return {
    id,
    catalogPartId,
    name,
    transform: {
      position,
      rotation: [0, 0, 0, 1],
    },
  };
}

/** Golden v3 fixture for the first builder-to-simulator mechanism slice. */
export function createReferenceMechanismDocument(): RobotDocumentV3 {
  return {
    schemaVersion: ROBOT_DOCUMENT_SCHEMA_VERSION,
    id: "robot-reference-mechanism",
    name: "Reference FTC Arm and Claw",
    units: "m",
    catalogVersion: "2026.09-fixture.1",
    instances: [
      instance("chassis", "codearobot:fixture-chassis", "Fixture Chassis", [0, 0.08, 0]),
      instance("control-hub", "rev:REV-31-1595", "REV Control Hub", [0, 0.14, 0]),
      instance("arm-motor", "gobilda:5203-2402-0014", "Arm Motor", [-0.09, 0.22, 0]),
      instance("arm", "codearobot:fixture-arm", "Arm", [0, 0.65, 0]),
      instance("claw-servo", "gobilda:proton-servo-speed", "Claw Servo", [0, 1.08, 0]),
      instance("claw", "codearobot:fixture-claw", "Claw", [0, 1.16, 0]),
    ],
    connections: [
      {
        id: "connection-chassis-hub",
        name: "Control Hub mounting bolts",
        a: { instanceId: "chassis", connectorId: "top-center" },
        b: { instanceId: "control-hub", connectorId: "bottom-mount-pattern" },
        rotationOffsetRad: 0,
        translationOffsetM: [0, 0, 0],
      },
      {
        id: "connection-chassis-arm-motor",
        name: "Arm motor mount",
        a: { instanceId: "chassis", connectorId: "arm-motor-mount" },
        b: { instanceId: "arm-motor", connectorId: "gearbox-mount" },
        rotationOffsetRad: 0,
        translationOffsetM: [0, 0, 0],
      },
      {
        id: "connection-arm-servo",
        name: "Claw servo mount",
        a: { instanceId: "arm", connectorId: "tip-servo-mount" },
        b: { instanceId: "claw-servo", connectorId: "body-mount" },
        rotationOffsetRad: 0,
        translationOffsetM: [0, 0, 0],
      },
    ],
    joints: [
      {
        id: "joint-arm",
        name: "Arm Pivot",
        kind: "revolute",
        parentInstanceId: "chassis",
        childInstanceId: "arm",
        parentFrame: {
          position: [0, 0.22, 0],
          rotation: [0, 0, 0, 1],
        },
        childFrame: {
          position: [0, -0.43, 0],
          rotation: [0, 0, 0, 1],
        },
        axis: [0, 0, 1],
        limits: { lower: -0.261799, upper: 1.48353 },
        dynamics: { damping: 0.15, friction: 0.03 },
        initialPosition: 0.20944,
        collisionBetweenBodies: false,
      },
      {
        id: "joint-claw",
        name: "Claw Servo Pivot",
        kind: "revolute",
        parentInstanceId: "claw-servo",
        childInstanceId: "claw",
        parentFrame: {
          position: [0, 0.05, 0],
          rotation: [0, 0, 0, 1],
        },
        childFrame: IDENTITY_TRANSFORM,
        axis: [0, 1, 0],
        limits: { lower: 0, upper: 3.298672 },
        dynamics: { damping: 0.08, friction: 0.01 },
        initialPosition: 0,
        collisionBetweenBodies: false,
      },
    ],
    transmissions: [
      {
        id: "transmission-arm",
        name: "Arm gearbox",
        kind: "rotary",
        actuatorDeviceId: "device-arm-motor",
        jointId: "joint-arm",
        jointUnitsPerActuatorRevolution: (2 * Math.PI) / 13.7,
        direction: 1,
        efficiency: 0.85,
        encoderTicksPerActuatorRevolution: 28,
      },
      {
        id: "transmission-claw",
        name: "Servo spline",
        kind: "rotary",
        actuatorDeviceId: "device-claw-servo",
        jointId: "joint-claw",
        jointUnitsPerActuatorRevolution: 2 * Math.PI,
        direction: 1,
        efficiency: 1,
      },
    ],
    hardware: {
      modules: [
        {
          id: "module-control-hub",
          name: "Control Hub",
          type: "controlHub",
          partInstanceId: "control-hub",
        },
      ],
      devices: [
        {
          id: "device-arm-motor",
          name: "armMotor",
          type: "dcMotor",
          partInstanceId: "arm-motor",
          moduleId: "module-control-hub",
          port: "motor:0",
          direction: "forward",
        },
        {
          id: "device-claw-servo",
          name: "clawServo",
          type: "servo",
          partInstanceId: "claw-servo",
          moduleId: "module-control-hub",
          port: "servo:0",
          direction: "forward",
        },
      ],
    },
    metadata: {
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      description: "Golden fixture for the first FTC builder-to-simulator vertical slice.",
    },
  };
}
