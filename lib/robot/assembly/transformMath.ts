import type { Quaternion, RigidTransform, Vec3 } from "../schema/types.ts";

export const IDENTITY_TRANSFORM: RigidTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
};

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scaleVec3(value: Vec3, scale: number): Vec3 {
  return [value[0] * scale, value[1] * scale, value[2] * scale];
}

export function normalizeQuaternion(value: Quaternion): Quaternion {
  const length = Math.hypot(...value);
  if (length < 1e-12) throw new Error("Cannot normalize a zero-length quaternion.");
  const normalized = value.map((component) => component / length) as Quaternion;
  // q and -q encode the same rotation. Canonicalizing keeps serialized command output stable.
  return normalized[3] < 0 ? (normalized.map((component) => -component) as Quaternion) : normalized;
}

export function multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return normalizeQuaternion([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}

export function inverseQuaternion(value: Quaternion): Quaternion {
  const normalized = normalizeQuaternion(value);
  return [-normalized[0], -normalized[1], -normalized[2], normalized[3]];
}

export function rotateVec3(rotation: Quaternion, value: Vec3): Vec3 {
  const [qx, qy, qz, qw] = normalizeQuaternion(rotation);
  const [vx, vy, vz] = value;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Applies child in parent space, equivalent to multiplying rigid transform matrices. */
export function composeTransforms(parent: RigidTransform, child: RigidTransform): RigidTransform {
  return {
    position: addVec3(parent.position, rotateVec3(parent.rotation, child.position)),
    rotation: multiplyQuaternions(parent.rotation, child.rotation),
  };
}

export function invertTransform(value: RigidTransform): RigidTransform {
  const rotation = inverseQuaternion(value.rotation);
  return {
    position: rotateVec3(rotation, scaleVec3(value.position, -1)),
    rotation,
  };
}

export function axisAngleQuaternion(axis: Vec3, angleRad: number): Quaternion {
  const length = Math.hypot(...axis);
  if (length < 1e-12) throw new Error("Cannot create a rotation around a zero-length axis.");
  const scale = Math.sin(angleRad / 2) / length;
  return normalizeQuaternion([
    axis[0] * scale,
    axis[1] * scale,
    axis[2] * scale,
    Math.cos(angleRad / 2),
  ]);
}

export function transformsApproximatelyEqual(
  a: RigidTransform,
  b: RigidTransform,
  tolerance = 1e-8
) {
  const positionError = Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2]
  );
  const qa = normalizeQuaternion(a.rotation);
  const qb = normalizeQuaternion(b.rotation);
  const dot = Math.abs(qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3]);
  return positionError <= tolerance && 1 - dot <= tolerance;
}
