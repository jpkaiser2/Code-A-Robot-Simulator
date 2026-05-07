import type { JointDefinition, RobotDefinition, RobotPart, Vec3 } from "./robotSchema";

export type PreviewJointState = {
  value: number;
  direction: 1 | -1;
};

export type PreviewState = {
  enabled: boolean;
  jointStates: Record<string, PreviewJointState>;
};

export type PreviewHardwareRole = "motor" | "servo" | "wheel" | "joint";

export type PreviewWarning = {
  partId: string;
  partName: string;
  message: string;
};

const EPSILON = 0.0001;
const DEFAULT_REVOLUTE_LIMITS = { min: -90, max: 90 };
const DEFAULT_PRISMATIC_LIMITS = { min: 0, max: 1 };
const WHEEL_SPIN_DEGREES_PER_SECOND = 220;
const MOTOR_SWEEP_DEGREES_PER_SECOND = 80;
const SERVO_SWEEP_DEGREES_PER_SECOND = 105;
const PRISMATIC_SWEEP_UNITS_PER_SECOND = 0.55;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function axisLength(axis: Vec3 | undefined) {
  return axis ? Math.hypot(axis[0], axis[1], axis[2]) : 0;
}

function partSearchText(part: RobotPart) {
  const mountTags = part.mountPoints.flatMap((point) => point.tags ?? []);
  return [part.id, part.name, part.kind, ...mountTags].join(" ").toLowerCase();
}

export function getPreviewHardwareRole(part: RobotPart): PreviewHardwareRole {
  const text = partSearchText(part);
  if (/\b(wheel|tire|tyre)\b/.test(text)) {
    return "wheel";
  }
  if (/\bservo\b/.test(text)) {
    return "servo";
  }
  if (/\b(motor|drive|actuator)\b/.test(text)) {
    return "motor";
  }
  return "joint";
}

export function isPreviewReversed(part: RobotPart) {
  return /\b(reverse|reversed|inverted)\b/.test(partSearchText(part));
}

export function getJointBaseValue(joint: JointDefinition) {
  return joint.type === "fixed" ? 0 : joint.initialValue ?? 0;
}

export function getPreviewLimits(joint: JointDefinition) {
  if (joint.type === "fixed") {
    return { min: 0, max: 0 };
  }

  const fallback = joint.type === "revolute" ? DEFAULT_REVOLUTE_LIMITS : DEFAULT_PRISMATIC_LIMITS;
  const limits = joint.limits ?? fallback;
  return {
    min: Math.min(limits.min, limits.max),
    max: Math.max(limits.min, limits.max),
  };
}

export function createPreviewState(robot: RobotDefinition): PreviewState {
  return {
    enabled: false,
    jointStates: Object.fromEntries(
      robot.parts
        .filter((part) => part.joint.type !== "fixed")
        .map((part) => [
          part.id,
          {
            value: getJointBaseValue(part.joint),
            direction: 1 as const,
          },
        ])
    ),
  };
}

export function resetPreviewState(robot: RobotDefinition, enabled = false): PreviewState {
  return {
    ...createPreviewState(robot),
    enabled,
  };
}

function stepBetweenLimits(
  state: PreviewJointState,
  limits: { min: number; max: number },
  deltaSeconds: number,
  unitsPerSecond: number
) {
  if (Math.abs(limits.max - limits.min) <= EPSILON) {
    return { ...state, value: limits.min };
  }

  let nextValue = state.value + unitsPerSecond * deltaSeconds * state.direction;
  let nextDirection = state.direction;

  if (nextValue >= limits.max) {
    nextValue = limits.max;
    nextDirection = -1;
  } else if (nextValue <= limits.min) {
    nextValue = limits.min;
    nextDirection = 1;
  }

  return {
    value: nextValue,
    direction: nextDirection,
  };
}

export function updatePreviewState(
  robot: RobotDefinition,
  previousState: PreviewState,
  deltaSeconds: number,
  speedMultiplier: number
): PreviewState {
  if (!previousState.enabled) {
    return previousState;
  }

  const scaledDelta = Math.max(0, deltaSeconds) * Math.max(0, speedMultiplier);
  const jointStates: Record<string, PreviewJointState> = {};

  robot.parts.forEach((part) => {
    if (part.joint.type === "fixed") {
      return;
    }

    const previousJointState = previousState.jointStates[part.id] ?? {
      value: getJointBaseValue(part.joint),
      direction: 1 as const,
    };
    const role = getPreviewHardwareRole(part);
    const limits = getPreviewLimits(part.joint);

    if (part.joint.type === "revolute" && role === "wheel") {
      const direction = isPreviewReversed(part) ? -1 : 1;
      jointStates[part.id] = {
        value: previousJointState.value + WHEEL_SPIN_DEGREES_PER_SECOND * scaledDelta * direction,
        direction: previousJointState.direction,
      };
      return;
    }

    if (
      part.joint.type === "revolute" &&
      (!part.joint.limits || Math.abs(limits.max - limits.min) <= EPSILON) &&
      role !== "servo"
    ) {
      jointStates[part.id] = {
        value: previousJointState.value + 75 * scaledDelta,
        direction: previousJointState.direction,
      };
      return;
    }

    if (part.joint.type === "revolute") {
      const unitsPerSecond = role === "servo" ? SERVO_SWEEP_DEGREES_PER_SECOND : MOTOR_SWEEP_DEGREES_PER_SECOND;
      jointStates[part.id] = stepBetweenLimits(previousJointState, limits, scaledDelta, unitsPerSecond);
      return;
    }

    jointStates[part.id] = stepBetweenLimits(
      previousJointState,
      limits,
      scaledDelta,
      PRISMATIC_SWEEP_UNITS_PER_SECOND
    );
  });

  return {
    enabled: true,
    jointStates,
  };
}

export function getPreviewJointValues(robot: RobotDefinition, previewState: PreviewState) {
  return Object.fromEntries(
    robot.parts
      .filter((part) => part.joint.type !== "fixed")
      .map((part) => [part.id, previewState.jointStates[part.id]?.value ?? getJointBaseValue(part.joint)])
  );
}

export function getPreviewWarnings(robot: RobotDefinition): PreviewWarning[] {
  const warnings: PreviewWarning[] = [];

  robot.parts.forEach((part) => {
    const role = getPreviewHardwareRole(part);

    if (part.joint.type !== "fixed" && axisLength(part.joint.axis) <= EPSILON) {
      warnings.push({
        partId: part.id,
        partName: part.name,
        message: "Joint axis is zero length.",
      });
    }

    if (role === "wheel" && part.joint.type !== "revolute") {
      warnings.push({
        partId: part.id,
        partName: part.name,
        message: "Wheel-like part should use a revolute joint.",
      });
    }

    if (role === "servo" && part.joint.type !== "fixed" && !part.joint.limits) {
      warnings.push({
        partId: part.id,
        partName: part.name,
        message: "Servo-like part should have min/max limits.",
      });
    }

    if ((role === "motor" || role === "servo" || role === "wheel") && part.joint.type === "fixed") {
      warnings.push({
        partId: part.id,
        partName: part.name,
        message: "Hardware-like part has no movable joint.",
      });
    }

    if (part.joint.type === "revolute") {
      const pivot = part.joint.pivot ?? [0, 0, 0];
      const halfExtent = Math.max(Math.abs(part.scale[0]), Math.abs(part.scale[1]), Math.abs(part.scale[2])) * 0.5;
      const pivotDistance = Math.hypot(pivot[0], pivot[1], pivot[2]);
      if (pivotDistance > Math.max(0.4, halfExtent * 1.75)) {
        warnings.push({
          partId: part.id,
          partName: part.name,
          message: "Joint pivot is far from this part's local bounds.",
        });
      }
    }
  });

  return warnings;
}
