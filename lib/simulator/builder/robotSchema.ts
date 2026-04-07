export type PrimitiveKind = "box" | "cylinder" | "sphere" | "capsule";

export type Vec3 = [number, number, number];

export type TransformMode = "translate" | "rotate" | "scale";

export interface RobotPart {
  id: string;
  name: string;
  kind: PrimitiveKind;
  parentId: string | null;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  visible: boolean;
  // Future extension points: joints, hardware bindings, mount points, sensors,
  // drivetrain config, and imported mesh asset references should attach here.
}

export interface RobotDefinition {
  version: number;
  name: string;
  rootPartIds: string[];
  parts: RobotPart[];
  // Future extension points: robot-level drivetrain, control hub, asset manifest,
  // and lesson/runtime metadata should attach here.
}

export interface BuilderEditorState {
  robot: RobotDefinition;
  selectedPartId: string | null;
  transformMode: TransformMode;
}

export const PRIMITIVE_KINDS: PrimitiveKind[] = ["box", "cylinder", "sphere", "capsule"];

const DEFAULT_PART_COLORS: Record<PrimitiveKind, string> = {
  box: "#2563eb",
  cylinder: "#f59e0b",
  sphere: "#14b8a6",
  capsule: "#ec4899",
};

export function createPartId(kind: PrimitiveKind) {
  return `${kind}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRobotPart(kind: PrimitiveKind, existingParts: RobotPart[]): RobotPart {
  const kindCount = existingParts.filter((part) => part.kind === kind).length + 1;
  const xOffset = ((existingParts.length % 5) - 2) * 1.2;
  const zOffset = Math.floor(existingParts.length / 5) * 1.2;

  return {
    id: createPartId(kind),
    name: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${kindCount}`,
    kind,
    parentId: null,
    position: [Number(xOffset.toFixed(2)), 0.5, Number(zOffset.toFixed(2))],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: DEFAULT_PART_COLORS[kind],
    visible: true,
  };
}

export function createDefaultRobotDefinition(): RobotDefinition {
  const chassis: RobotPart = {
    id: "part-chassis",
    name: "Starter Chassis",
    kind: "box",
    parentId: null,
    position: [0, 0.35, 0],
    rotation: [0, 0, 0],
    scale: [2.6, 0.35, 1.8],
    color: "#2563eb",
    visible: true,
  };

  return {
    version: 1,
    name: "Primitive Lesson Robot",
    rootPartIds: [chassis.id],
    parts: [chassis],
  };
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function normalizeVec3(value: unknown, fallback: Vec3): Vec3 {
  return isVec3(value) ? value : fallback;
}

function isPrimitiveKind(value: unknown): value is PrimitiveKind {
  return typeof value === "string" && PRIMITIVE_KINDS.includes(value as PrimitiveKind);
}

function breakParentCycles(parts: RobotPart[]) {
  const partById = new Map(parts.map((part) => [part.id, part]));

  return parts.map((part) => {
    const visited = new Set<string>([part.id]);
    let parentId = part.parentId;

    while (parentId) {
      if (visited.has(parentId)) {
        return { ...part, parentId: null };
      }

      visited.add(parentId);
      parentId = partById.get(parentId)?.parentId ?? null;
    }

    return part;
  });
}

export function normalizeRobotDefinition(value: unknown): RobotDefinition {
  if (!value || typeof value !== "object") {
    throw new Error("Robot JSON must be an object.");
  }

  const candidate = value as Partial<RobotDefinition>;
  if (!Array.isArray(candidate.parts)) {
    throw new Error("Robot JSON must include a parts array.");
  }

  const seenIds = new Set<string>();
  const parts = candidate.parts.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Part ${index + 1} must be an object.`);
    }

    const part = entry as Partial<RobotPart>;
    if (!part.id || typeof part.id !== "string") {
      throw new Error(`Part ${index + 1} must include a string id.`);
    }
    if (seenIds.has(part.id)) {
      throw new Error(`Duplicate part id "${part.id}".`);
    }
    if (!isPrimitiveKind(part.kind)) {
      throw new Error(`Part "${part.id}" has an unsupported primitive kind.`);
    }

    seenIds.add(part.id);

    return {
      id: part.id,
      name: typeof part.name === "string" && part.name.trim() ? part.name : part.id,
      kind: part.kind,
      parentId: typeof part.parentId === "string" ? part.parentId : null,
      position: normalizeVec3(part.position, [0, 0.5, 0]),
      rotation: normalizeVec3(part.rotation, [0, 0, 0]),
      scale: normalizeVec3(part.scale, [1, 1, 1]),
      color:
        typeof part.color === "string" && part.color.trim()
          ? part.color
          : DEFAULT_PART_COLORS[part.kind],
      visible: typeof part.visible === "boolean" ? part.visible : true,
    };
  });

  const partIds = new Set(parts.map((part) => part.id));
  const normalizedParts = breakParentCycles(
    parts.map((part) => ({
      ...part,
      parentId: part.parentId && partIds.has(part.parentId) ? part.parentId : null,
    }))
  );
  const derivedRoots = normalizedParts
    .filter((part) => part.parentId === null)
    .map((part) => part.id);
  const rootPartIds = derivedRoots.length > 0 ? derivedRoots : parts[0] ? [parts[0].id] : [];
  const finalParts =
    derivedRoots.length > 0 || normalizedParts.length === 0
      ? normalizedParts
      : normalizedParts.map((part, index) => (index === 0 ? { ...part, parentId: null } : part));

  return {
    version: typeof candidate.version === "number" ? candidate.version : 1,
    name:
      typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name
        : "Imported Robot",
    rootPartIds,
    parts: finalParts,
  };
}

export function serializeRobotDefinition(robot: RobotDefinition) {
  return JSON.stringify(robot, null, 2);
}
