"use client";

import { useCallback, useMemo, useState } from "react";

import RobotBuilderViewport from "@/components/simulator-builder/RobotBuilderViewport";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRobotBuilderEditor } from "@/lib/simulator/builder/editorStore";
import {
  PRIMITIVE_KINDS,
  normalizeRobotDefinition,
  serializeRobotDefinition,
  type JointDefinition,
  type JointType,
  type MountPoint,
  type PrimitiveKind,
  type RobotPart,
  type TransformMode,
  type Vec3,
} from "@/lib/simulator/builder/robotSchema";

const TRANSFORM_MODES: TransformMode[] = ["translate", "rotate", "scale"];
const JOINT_TYPES: JointType[] = ["fixed", "revolute", "prismatic"];

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function updateVec3(vec: Vec3, index: number, value: string): Vec3 {
  const next = [...vec] as Vec3;
  next[index] = parseNumber(value, vec[index]);
  return next;
}

function toTagText(tags: string[] | undefined) {
  return tags?.join(", ") ?? "";
}

function fromTagText(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createJointForType(type: JointType): JointDefinition {
  if (type === "revolute") {
    return {
      type,
      pivot: [0, 0, 0],
      axis: [0, 0, 1],
      limits: { min: -90, max: 90 },
      initialValue: 0,
    };
  }
  if (type === "prismatic") {
    return {
      type,
      axis: [1, 0, 0],
      limits: { min: 0, max: 1 },
      initialValue: 0,
    };
  }
  return { type: "fixed" };
}

function getDescendantPartIds(parts: RobotPart[], partId: string) {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    parts
      .filter((part) => part.parentId === parentId)
      .forEach((part) => {
        descendants.add(part.id);
        visit(part.id);
      });
  };

  visit(partId);
  return descendants;
}

function VectorEditor({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: Vec3;
  step: string;
  onChange: (value: Vec3) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-4">
      <div className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {(["x", "y", "z"] as const).map((axis, index) => (
          <div key={`${label}-${axis}`} className="space-y-1">
            <label className="text-xs uppercase text-zinc-500">{axis}</label>
            <Input
              type="number"
              step={step}
              value={value[index]}
              onChange={(event) => onChange(updateVec3(value, index, event.target.value))}
              className="border-white/10 bg-[#050505] text-zinc-100"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MountPointEditor({
  mountPoint,
  onChange,
  onRemove,
}: {
  mountPoint: MountPoint;
  onChange: (mountPoint: MountPoint) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">{mountPoint.name}</div>
          <div className="font-mono text-xs text-zinc-500">{mountPoint.id}</div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:border-white/20 hover:text-white"
        >
          Remove
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs uppercase text-zinc-500">Id</label>
          <Input
            value={mountPoint.id}
            onChange={(event) => onChange({ ...mountPoint, id: event.target.value })}
            className="border-white/10 bg-[#050505] font-mono text-zinc-100"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase text-zinc-500">Name</label>
          <Input
            value={mountPoint.name}
            onChange={(event) => onChange({ ...mountPoint, name: event.target.value })}
            className="border-white/10 bg-[#050505] text-zinc-100"
          />
        </div>
      </div>
      <VectorEditor
        label="Mount Local Position"
        value={mountPoint.position}
        step="0.1"
        onChange={(position) => onChange({ ...mountPoint, position })}
      />
      <VectorEditor
        label="Mount Local Rotation"
        value={mountPoint.rotation}
        step="5"
        onChange={(rotation) => onChange({ ...mountPoint, rotation })}
      />
      <div className="space-y-1">
        <label className="text-xs uppercase text-zinc-500">Tags</label>
        <Input
          value={toTagText(mountPoint.tags)}
          onChange={(event) => onChange({ ...mountPoint, tags: fromTagText(event.target.value) })}
          placeholder="structure, arm, sensor"
          className="border-white/10 bg-[#050505] text-zinc-100"
        />
      </div>
    </div>
  );
}

function JointEditor({
  part,
  previewValue,
  onJointChange,
  onPreviewChange,
  onPreviewReset,
}: {
  part: RobotPart;
  previewValue: number;
  onJointChange: (joint: JointDefinition) => void;
  onPreviewChange: (value: number) => void;
  onPreviewReset: () => void;
}) {
  const joint = part.joint;
  const limits = joint.limits ?? { min: 0, max: 0 };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black p-4">
      <div className="space-y-2">
        <label className="text-sm text-zinc-300">Joint type relative to parent</label>
        <select
          value={joint.type}
          onChange={(event) => onJointChange(createJointForType(event.target.value as JointType))}
          className="flex h-10 w-full rounded-md border border-white/10 bg-[#050505] px-3 py-2 text-sm text-zinc-100"
        >
          {JOINT_TYPES.map((type) => (
            <option key={type} value={type}>
              {toTitleCase(type)}
            </option>
          ))}
        </select>
      </div>

      {joint.type !== "fixed" ? (
        <>
          {joint.type === "revolute" ? (
            <VectorEditor
              label="Joint Pivot"
              value={joint.pivot ?? [0, 0, 0]}
              step="0.1"
              onChange={(pivot) => onJointChange({ ...joint, pivot })}
            />
          ) : null}
          <VectorEditor
            label="Joint Axis"
            value={joint.axis ?? (joint.type === "revolute" ? [0, 0, 1] : [1, 0, 0])}
            step="0.1"
            onChange={(axis) => onJointChange({ ...joint, axis })}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs uppercase text-zinc-500">Min</label>
              <Input
                type="number"
                step={joint.type === "revolute" ? "1" : "0.05"}
                value={limits.min}
                onChange={(event) =>
                  onJointChange({
                    ...joint,
                    limits: { min: parseNumber(event.target.value, limits.min), max: limits.max },
                  })
                }
                className="border-white/10 bg-[#050505] text-zinc-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-zinc-500">Max</label>
              <Input
                type="number"
                step={joint.type === "revolute" ? "1" : "0.05"}
                value={limits.max}
                onChange={(event) =>
                  onJointChange({
                    ...joint,
                    limits: { min: limits.min, max: parseNumber(event.target.value, limits.max) },
                  })
                }
                className="border-white/10 bg-[#050505] text-zinc-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-zinc-500">Initial</label>
              <Input
                type="number"
                step={joint.type === "revolute" ? "1" : "0.05"}
                value={joint.initialValue ?? 0}
                onChange={(event) =>
                  onJointChange({
                    ...joint,
                    initialValue: parseNumber(event.target.value, joint.initialValue ?? 0),
                  })
                }
                className="border-white/10 bg-[#050505] text-zinc-100"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#050505] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Preview {joint.type === "revolute" ? "Angle" : "Offset"}
                </div>
                <div className="mt-1 font-mono text-sm text-zinc-200">{previewValue}</div>
              </div>
              <button
                type="button"
                onClick={onPreviewReset}
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:border-white/20 hover:text-white"
              >
                Reset
              </button>
            </div>
            <input
              type="range"
              min={limits.min}
              max={limits.max}
              step={joint.type === "revolute" ? 1 : 0.01}
              value={previewValue}
              onChange={(event) => onPreviewChange(Number(event.target.value))}
              className="w-full"
            />
            <div className="mt-2 text-xs text-zinc-500">
              Preview is temporary editor state and does not overwrite the authored local transform.
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm text-zinc-400">
          Fixed joints keep this part rigidly attached to its parent.
        </div>
      )}
    </div>
  );
}

function PartListItem({
  part,
  depth,
  childrenByParent,
  selectedPartId,
  onSelect,
  onRemove,
}: {
  part: RobotPart;
  depth: number;
  childrenByParent: Map<string | null, RobotPart[]>;
  selectedPartId: string | null;
  onSelect: (partId: string) => void;
  onRemove: (partId: string) => void;
}) {
  const children = childrenByParent.get(part.id) ?? [];

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
          selectedPartId === part.id
            ? "border-white/25 bg-white/[0.06]"
            : "border-white/10 bg-black hover:border-white/20"
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        <button type="button" onClick={() => onSelect(part.id)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: part.color }}
            />
            <span className="truncate font-medium text-white">{part.name}</span>
          </div>
          <div className="mt-1 truncate font-mono text-xs text-zinc-500">{part.id}</div>
        </button>
        <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          {part.kind}
        </div>
        <button
          type="button"
          onClick={() => onRemove(part.id)}
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:border-white/20 hover:text-white"
        >
          Remove
        </button>
      </div>
      {children.map((child) => (
        <PartListItem
          key={child.id}
          part={child}
          depth={depth + 1}
          childrenByParent={childrenByParent}
          selectedPartId={selectedPartId}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

export default function SimulatorBuilderClient() {
  const { state, actions } = useRobotBuilderEditor();
  const [importText, setImportText] = useState("");
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);

  const { robot, selectedPartId, transformMode, jointPreviewValues } = state;
  const selectedPart = robot.parts.find((part) => part.id === selectedPartId) ?? null;
  const selectedParentPart = selectedPart?.parentId
    ? robot.parts.find((part) => part.id === selectedPart.parentId) ?? null
    : null;
  const selectedJointPreviewValue = selectedPart
    ? jointPreviewValues[selectedPart.id] ?? selectedPart.joint.initialValue ?? 0
    : 0;
  const exportedJson = useMemo(() => serializeRobotDefinition(robot), [robot]);
  const childrenByParent = useMemo(() => {
    const groups = new Map<string | null, RobotPart[]>();
    robot.parts.forEach((part) => {
      const key = part.parentId ?? null;
      groups.set(key, [...(groups.get(key) ?? []), part]);
    });
    return groups;
  }, [robot.parts]);
  const rootParts = robot.rootPartIds
    .map((partId) => robot.parts.find((part) => part.id === partId))
    .filter((part): part is RobotPart => Boolean(part));
  const selectedDescendantIds = selectedPart
    ? getDescendantPartIds(robot.parts, selectedPart.id)
    : new Set<string>();

  const selectPart = useCallback((partId: string | null) => actions.selectPart(partId), [actions]);
  const updateViewportTransform = useCallback(
    (partId: string, transform: Pick<RobotPart, "position" | "rotation" | "scale">) => {
      actions.updatePart(partId, (part) => ({ ...part, ...transform }));
    },
    [actions]
  );

  const updateSelectedPart = (updater: (part: RobotPart) => RobotPart) => {
    if (selectedPart) {
      actions.updatePart(selectedPart.id, updater);
    }
  };

  const handleImportRobot = () => {
    try {
      actions.setRobot(normalizeRobotDefinition(JSON.parse(importText)));
      setImportText("");
      setJsonStatus("Imported robot definition into the builder.");
    } catch (error) {
      setJsonStatus(error instanceof Error ? error.message : "Import failed.");
    }
  };

  return (
    <div className="min-h-screen bg-black px-5 py-8 text-white sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-6">
        <div className="rounded-[32px] border border-white/10 bg-[#050505] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-[11px] uppercase tracking-[0.34em] text-zinc-500">
                Robot Builder
              </p>
              <h1 className="mb-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Primitive assembly editor for lesson robots
              </h1>
              <p className="mb-0 max-w-2xl text-base text-zinc-400 sm:text-lg">
                Build robots from simple scene parts, keep the RobotDefinition JSON as the source of
                truth, and leave room for joints and hardware bindings later.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Parts</div>
                <div className="text-2xl font-semibold text-white">{robot.parts.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Schema</div>
                <div className="text-2xl font-semibold text-white">v{robot.version}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Selected</div>
                <div className="truncate text-sm font-medium text-white">
                  {selectedPart?.name ?? "None"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1.2fr)_390px]">
          <div className="flex flex-col gap-6">
            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Robot Setup</CardTitle>
                <CardDescription className="text-zinc-500">
                  Current in-memory robot definition for this builder session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300">Robot name</label>
                  <Input
                    value={robot.name}
                    onChange={(event) => actions.setRobotName(event.target.value)}
                    className="border-white/10 bg-black text-zinc-100"
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black p-4 text-sm text-zinc-400">
                  Primitive parts are the source of truth for this phase. Future joints, mount
                  points, sensors, and hardware bindings should extend the RobotDefinition schema.
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Add Primitive</CardTitle>
                <CardDescription className="text-zinc-500">
                  Start simple: boxes, cylinders, spheres, and capsules.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {PRIMITIVE_KINDS.map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    onClick={() => actions.addPart(kind)}
                    className="justify-between border border-white/10 bg-black text-zinc-100 hover:bg-white hover:text-black"
                  >
                    Add {toTitleCase(kind)}
                    <span className="text-xs opacity-60">Primitive</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <CardTitle className="text-xl text-white">3D Workspace</CardTitle>
                    <CardDescription className="text-zinc-500">
                      Orbit camera controls, viewport selection, and transform gizmos.
                    </CardDescription>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black p-1">
                    {TRANSFORM_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => actions.setTransformMode(mode)}
                        className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] transition ${
                          transformMode === mode
                            ? "bg-white text-black"
                            : "text-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        {mode === "translate" ? "Move" : toTitleCase(mode)}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <RobotBuilderViewport
                  robot={robot}
                  selectedPartId={selectedPartId}
                  transformMode={transformMode}
                  jointPreviewValues={jointPreviewValues}
                  onSelectPart={selectPart}
                  onPartTransform={updateViewportTransform}
                />
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Part Hierarchy</CardTitle>
                <CardDescription className="text-zinc-500">
                  Parent/child data is in the schema now; reparenting is intentionally minimal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rootParts.length > 0 ? (
                  rootParts.map((part) => (
                    <PartListItem
                      key={part.id}
                      part={part}
                      depth={0}
                      childrenByParent={childrenByParent}
                      selectedPartId={selectedPartId}
                      onSelect={actions.selectPart}
                      onRemove={actions.removePart}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black p-8 text-center text-zinc-500">
                    Add a primitive part to start the robot assembly.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Properties</CardTitle>
                <CardDescription className="text-zinc-500">
                  Edits here update the same RobotPart data rendered in the viewport.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPart ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-300">Part id</label>
                      <Input
                        value={selectedPart.id}
                        onChange={(event) => actions.updatePartId(selectedPart.id, event.target.value)}
                        className="border-white/10 bg-black font-mono text-zinc-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-300">Name</label>
                      <Input
                        value={selectedPart.name}
                        onChange={(event) =>
                          updateSelectedPart((part) => ({ ...part, name: event.target.value }))
                        }
                        className="border-white/10 bg-black text-zinc-100"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm text-zinc-300">Primitive type</label>
                        <select
                          value={selectedPart.kind}
                          onChange={(event) =>
                            updateSelectedPart((part) => ({
                              ...part,
                              kind: event.target.value as PrimitiveKind,
                            }))
                          }
                          className="flex h-10 w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm text-zinc-100"
                        >
                          {PRIMITIVE_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {toTitleCase(kind)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-zinc-300">Color</label>
                        <Input
                          type="color"
                          value={selectedPart.color}
                          onChange={(event) =>
                            updateSelectedPart((part) => ({ ...part, color: event.target.value }))
                          }
                          className="h-10 border-white/10 bg-black p-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-300">Parent</label>
                      <select
                        value={selectedPart.parentId ?? ""}
                        onChange={(event) =>
                          actions.reparentPart(selectedPart.id, event.target.value || null)
                        }
                        className="flex h-10 w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm text-zinc-100"
                      >
                        <option value="">Root part</option>
                        {robot.parts
                          .filter(
                            (part) =>
                              part.id !== selectedPart.id && !selectedDescendantIds.has(part.id)
                          )
                          .map((part) => (
                            <option key={part.id} value={part.id}>
                              {part.name}
                            </option>
                          ))}
                      </select>
                      <p className="text-xs text-zinc-500">
                        Position, rotation, scale, mount points, and joint fields below are local to
                        this part&apos;s parent.
                      </p>
                    </div>
                    {selectedParentPart ? (
                      <div className="space-y-3 rounded-2xl border border-white/10 bg-black p-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                            Attach To Parent Mount
                          </div>
                          <div className="mt-1 text-sm text-zinc-400">
                            Align this child to one of {selectedParentPart.name}&apos;s local mount
                            points.
                          </div>
                        </div>
                        {selectedParentPart.mountPoints.length > 0 ? (
                          <div className="grid gap-2">
                            {selectedParentPart.mountPoints.map((mountPoint) => (
                              <button
                                key={mountPoint.id}
                                type="button"
                                onClick={() =>
                                  actions.attachPartToMount(
                                    selectedPart.id,
                                    selectedParentPart.id,
                                    mountPoint.id
                                  )
                                }
                                className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-left text-sm text-zinc-300 hover:border-white/20 hover:text-white"
                              >
                                <span className="font-medium text-white">{mountPoint.name}</span>
                                <span className="ml-2 font-mono text-xs text-zinc-500">
                                  {mountPoint.id}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/10 bg-[#050505] px-3 py-2 text-sm text-zinc-500">
                            The parent does not have mount points yet.
                          </div>
                        )}
                      </div>
                    ) : null}
                    <VectorEditor
                      label="Local Position"
                      value={selectedPart.position}
                      step="0.1"
                      onChange={(position) => updateSelectedPart((part) => ({ ...part, position }))}
                    />
                    <VectorEditor
                      label="Local Rotation"
                      value={selectedPart.rotation}
                      step="5"
                      onChange={(rotation) => updateSelectedPart((part) => ({ ...part, rotation }))}
                    />
                    <VectorEditor
                      label="Local Scale"
                      value={selectedPart.scale}
                      step="0.05"
                      onChange={(scale) => updateSelectedPart((part) => ({ ...part, scale }))}
                    />
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black p-4 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={selectedPart.visible}
                        onChange={(event) =>
                          updateSelectedPart((part) => ({ ...part, visible: event.target.checked }))
                        }
                      />
                      Visible in viewport
                    </label>
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-black p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                            Mount Points
                          </div>
                          <div className="mt-1 text-sm text-zinc-400">
                            Named local attachment points for child parts.
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => actions.addMountPoint(selectedPart.id)}
                          className="border border-white/10 bg-white text-black hover:bg-zinc-200"
                        >
                          Add Mount
                        </Button>
                      </div>
                      {selectedPart.mountPoints.length > 0 ? (
                        selectedPart.mountPoints.map((mountPoint) => (
                          <MountPointEditor
                            key={mountPoint.id}
                            mountPoint={mountPoint}
                            onChange={(nextMountPoint) =>
                              actions.updateMountPoint(selectedPart.id, mountPoint.id, () => nextMountPoint)
                            }
                            onRemove={() => actions.removeMountPoint(selectedPart.id, mountPoint.id)}
                          />
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-[#050505] px-3 py-2 text-sm text-zinc-500">
                          No mount points on this part yet.
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                          Joint
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          Explicit mechanism metadata relative to this part&apos;s parent.
                        </div>
                      </div>
                      <JointEditor
                        part={selectedPart}
                        previewValue={selectedJointPreviewValue}
                        onJointChange={(joint) => actions.updateJoint(selectedPart.id, () => joint)}
                        onPreviewChange={(value) =>
                          actions.setJointPreviewValue(selectedPart.id, value)
                        }
                        onPreviewReset={() => actions.resetJointPreview(selectedPart.id)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black p-8 text-center text-zinc-500">
                    Select a part in the viewport or hierarchy to edit its RobotPart properties.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Import Robot JSON</CardTitle>
                <CardDescription className="text-zinc-500">
                  Paste a RobotDefinition to replace the current in-memory robot.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder='{"version":1,"name":"Demo Robot","rootPartIds":[],"parts":[]}'
                  className="min-h-[160px] border-white/10 bg-black font-mono text-xs text-zinc-100"
                />
                <Button
                  type="button"
                  onClick={handleImportRobot}
                  className="w-full border border-white/10 bg-white text-black hover:bg-zinc-200"
                >
                  Import RobotDefinition
                </Button>
                {jsonStatus ? (
                  <div className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-zinc-300">
                    {jsonStatus}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Export Robot JSON</CardTitle>
                <CardDescription className="text-zinc-500">
                  This RobotDefinition is the canonical export for the future simulator runtime.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  readOnly
                  value={exportedJson}
                  className="min-h-[360px] border-white/10 bg-black font-mono text-xs text-zinc-100"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
